import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type { ConfirmedProperty, ReportInputs, ReportRecord } from "./report";

/**
 * Saved reports. Postgres (Neon) when DATABASE_URL is set; outside production
 * a JSON file under .data/ stands in, so the funnel works on a laptop.
 */

type NewReport = Omit<ReportRecord, "id" | "createdAt" | "updatedAt" | "inputs">;

type Store = {
  create(report: ReportRecord, editHash: string): Promise<void>;
  setInputs(id: string, inputs: ReportInputs): Promise<boolean>;
  get(id: string): Promise<{ report: ReportRecord; editHash: string } | null>;
  list(limit: number): Promise<ReportRecord[]>;
};

export class StoreNotConfiguredError extends Error {}

/** 128 random bits; the id is the report URL, so it must not be guessable. */
export function newReportId(): string {
  return randomBytes(16).toString("base64url");
}

export function hashEditKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function editKeyMatches(key: string, hash: string): boolean {
  const left = Buffer.from(hashEditKey(key));
  const right = Buffer.from(hash);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isReportId(value: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(value);
}

function postgresStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const migrate = () =>
    (ready ??= sql`
      create table if not exists adu_reports (
        id text primary key,
        edit_hash text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        name text not null,
        email text not null,
        phone text not null,
        phone_verified boolean not null default false,
        property jsonb not null,
        inputs jsonb
      )
    `);

  type Row = {
    id: string;
    edit_hash: string;
    created_at: string | Date;
    updated_at: string | Date;
    name: string;
    email: string;
    phone: string;
    phone_verified: boolean;
    property: ConfirmedProperty;
    inputs: ReportInputs | null;
  };
  const toReport = (row: Row): ReportRecord => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    name: row.name,
    email: row.email,
    phone: row.phone,
    phoneVerified: row.phone_verified,
    property: row.property,
    inputs: row.inputs,
  });

  return {
    async create(report, editHash) {
      await migrate();
      await sql`
        insert into adu_reports (id, edit_hash, created_at, updated_at, name, email, phone, phone_verified, property)
        values (${report.id}, ${editHash}, ${report.createdAt}, ${report.updatedAt}, ${report.name}, ${report.email},
                ${report.phone}, ${report.phoneVerified}, ${JSON.stringify(report.property)}::jsonb)
      `;
    },
    async setInputs(id, inputs) {
      await migrate();
      const rows = await sql`
        update adu_reports set inputs = ${JSON.stringify(inputs)}::jsonb, updated_at = now()
        where id = ${id} returning id
      `;
      return rows.length > 0;
    },
    async get(id) {
      await migrate();
      const rows = (await sql`select * from adu_reports where id = ${id}`) as Row[];
      return rows[0] ? { report: toReport(rows[0]), editHash: rows[0].edit_hash } : null;
    },
    async list(limit) {
      await migrate();
      const rows = (await sql`select * from adu_reports order by created_at desc limit ${limit}`) as Row[];
      return rows.map(toReport);
    },
  };
}

function fileStore(): Store {
  const file = path.join(process.cwd(), ".data", "reports.json");
  type Saved = Record<string, { report: ReportRecord; editHash: string }>;
  const load = async (): Promise<Saved> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Saved;
    } catch {
      return {};
    }
  };
  const save = async (data: Saved) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2));
  };
  return {
    async create(report, editHash) {
      const data = await load();
      data[report.id] = { report, editHash };
      await save(data);
    },
    async setInputs(id, inputs) {
      const data = await load();
      const entry = data[id];
      if (!entry) return false;
      entry.report = { ...entry.report, inputs, updatedAt: new Date().toISOString() };
      await save(data);
      return true;
    },
    async get(id) {
      return (await load())[id] ?? null;
    },
    async list(limit) {
      return Object.values(await load())
        .map((entry) => entry.report)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
  };
}

let store: Store | null = null;

function getStore(): Store {
  if (store) return store;
  const url = process.env.DATABASE_URL?.trim();
  if (url) return (store = postgresStore(url));
  if (process.env.NODE_ENV === "production") throw new StoreNotConfiguredError("DATABASE_URL is not set.");
  return (store = fileStore());
}

export async function createReport(input: NewReport): Promise<{ report: ReportRecord; editKey: string }> {
  const now = new Date().toISOString();
  const report: ReportRecord = { ...input, id: newReportId(), createdAt: now, updatedAt: now, inputs: null };
  const editKey = randomBytes(24).toString("base64url");
  await getStore().create(report, hashEditKey(editKey));
  return { report, editKey };
}

export async function saveReportInputs(id: string, editKey: string, inputs: ReportInputs): Promise<"saved" | "not_found" | "forbidden"> {
  const found = await getStore().get(id);
  if (!found) return "not_found";
  if (!editKeyMatches(editKey, found.editHash)) return "forbidden";
  await getStore().setInputs(id, inputs);
  return "saved";
}

export async function getReport(id: string): Promise<ReportRecord | null> {
  if (!isReportId(id)) return null;
  return (await getStore().get(id))?.report ?? null;
}

export async function listReports(limit = 200): Promise<ReportRecord[]> {
  return getStore().list(limit);
}
