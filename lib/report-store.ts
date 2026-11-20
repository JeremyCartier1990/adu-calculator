import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { withPropertyFacts, type ConfirmedProperty, type PropertyFacts, type ReportInputs, type ReportRecord } from "./report";
import { fetchPropertyFinancials, type PropertyFinancials } from "./propertyreach";

/**
 * Saved reports. Postgres (Neon) when DATABASE_URL is set; outside production
 * a JSON file under .data/ stands in, so the funnel works on a laptop.
 */

type NewReport = Omit<ReportRecord, "id" | "createdAt" | "updatedAt" | "inputs" | "financials">;

type Store = {
  create(report: ReportRecord, editHash: string): Promise<void>;
  setInputs(id: string, inputs: ReportInputs): Promise<boolean>;
  setProperty(id: string, property: ConfirmedProperty): Promise<void>;
  setFinancials(id: string, financials: PropertyFinancials): Promise<void>;
  setEditHash(id: string, editHash: string): Promise<void>;
  setEmail(id: string, email: string): Promise<void>;
  findByPhone(phone: string): Promise<ReportRecord | null>;
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
    `
      .then(() => sql`alter table adu_reports add column if not exists financials jsonb`)
      .then(() => sql`alter table adu_reports alter column email drop not null`)
      .then(() => sql`alter table adu_reports add column if not exists created_by text not null default 'homeowner'`));

  type Row = {
    id: string;
    edit_hash: string;
    created_at: string | Date;
    updated_at: string | Date;
    name: string;
    email: string | null;
    phone: string;
    phone_verified: boolean;
    property: ConfirmedProperty;
    inputs: ReportInputs | null;
    financials: PropertyFinancials | null;
    created_by: string | null;
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
    financials: row.financials ?? null,
    createdBy: row.created_by === "team" ? "team" : "homeowner",
  });

  return {
    async create(report, editHash) {
      await migrate();
      await sql`
        insert into adu_reports (id, edit_hash, created_at, updated_at, name, email, phone, phone_verified, property, created_by)
        values (${report.id}, ${editHash}, ${report.createdAt}, ${report.updatedAt}, ${report.name}, ${report.email},
                ${report.phone}, ${report.phoneVerified}, ${JSON.stringify(report.property)}::jsonb, ${report.createdBy})
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
    async setProperty(id, property) {
      await migrate();
      await sql`update adu_reports set property = ${JSON.stringify(property)}::jsonb, updated_at = now() where id = ${id}`;
    },
    async setFinancials(id, financials) {
      await migrate();
      await sql`update adu_reports set financials = ${JSON.stringify(financials)}::jsonb where id = ${id}`;
    },
    async setEmail(id, email) {
      await migrate();
      await sql`update adu_reports set email = ${email}, updated_at = now() where id = ${id}`;
    },
    async setEditHash(id, editHash) {
      await migrate();
      await sql`update adu_reports set edit_hash = ${editHash} where id = ${id}`;
    },
    async findByPhone(phone) {
      await migrate();
      const rows = (await sql`select * from adu_reports where phone = ${phone} and created_by <> 'team' order by created_at limit 1`) as Row[];
      return rows[0] ? toReport(rows[0]) : null;
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

/** Reports saved before a field existed get its default. */
function withDefaults(report: ReportRecord): ReportRecord {
  return { ...report, financials: report.financials ?? null, createdBy: report.createdBy ?? "homeowner" };
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
    async setProperty(id, property) {
      const data = await load();
      if (!data[id]) return;
      data[id].report = { ...data[id].report, property, updatedAt: new Date().toISOString() };
      await save(data);
    },
    async setFinancials(id, financials) {
      const data = await load();
      const entry = data[id];
      if (!entry) return;
      entry.report = { ...entry.report, financials };
      await save(data);
    },
    async setEmail(id, email) {
      const data = await load();
      if (!data[id]) return;
      data[id].report = { ...data[id].report, email, updatedAt: new Date().toISOString() };
      await save(data);
    },
    async setEditHash(id, editHash) {
      const data = await load();
      if (!data[id]) return;
      data[id].editHash = editHash;
      await save(data);
    },
    async findByPhone(phone) {
      const first = Object.values(await load())
        .map((entry) => entry.report)
        .filter((report) => report.phone === phone && report.createdBy !== "team")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      return first ? withDefaults(first) : null;
    },
    async get(id) {
      const entry = (await load())[id];
      return entry ? { ...entry, report: withDefaults(entry.report) } : null;
    },
    async list(limit) {
      return Object.values(await load())
        .map((entry) => withDefaults(entry.report))
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
  const report: ReportRecord = { ...input, id: newReportId(), createdAt: now, updatedAt: now, inputs: null, financials: null };
  const editKey = randomBytes(24).toString("base64url");
  await getStore().create(report, hashEditKey(editKey));
  return { report, editKey };
}

/** The phone's report, if it already has one: each phone number gets one address. */
export async function findReportByPhone(phone: string): Promise<ReportRecord | null> {
  return getStore().findByPhone(phone);
}

/** A fresh edit key for a returning homeowner who re-verified their phone. Older keys stop working. */
export async function reissueEditKey(id: string): Promise<string> {
  const editKey = randomBytes(24).toString("base64url");
  await getStore().setEditHash(id, hashEditKey(editKey));
  return editKey;
}

/** Saves the email a homeowner gave for the PDF. Same edit-key check as saving inputs. */
export async function saveReportEmail(id: string, editKey: string, email: string): Promise<ReportRecord | "not_found" | "forbidden"> {
  const found = await getStore().get(id);
  if (!found) return "not_found";
  if (!editKeyMatches(editKey, found.editHash)) return "forbidden";
  await getStore().setEmail(id, email);
  return { ...found.report, email };
}

export async function saveReportInputs(
  id: string,
  editKey: string,
  inputs: ReportInputs,
  facts: PropertyFacts | null = null,
): Promise<"saved" | "not_found" | "forbidden"> {
  const found = await getStore().get(id);
  if (!found) return "not_found";
  if (!editKeyMatches(editKey, found.editHash)) return "forbidden";
  if (facts) {
    const property = withPropertyFacts(found.report.property, facts);
    if (property !== found.report.property) await getStore().setProperty(id, property);
  }
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

/** Look up the lead's mortgage and equity and keep it with the report. Never throws: the lead is already saved. */
export async function attachFinancials(report: ReportRecord): Promise<void> {
  try {
    const { property } = report;
    const financials = await fetchPropertyFinancials(property.address, property.latitude, property.longitude);
    if (!financials) return;
    await getStore().setFinancials(report.id, financials);
    console.info(JSON.stringify({ event: "financials_attached", id: report.id, loans: financials.loans.length }));
  } catch (error) {
    console.error(JSON.stringify({ event: "financials_failed", id: report.id, error: String(error) }));
  }
}
