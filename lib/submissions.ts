import "server-only";

import { database, localFile } from "./db";

// Every lead form submission is kept forever, including the ones we turned
// down, so no contact is ever lost and refusals can be reviewed.

export type SubmissionOutcome =
  | "created"
  | "returning"
  | "phone_used"
  | "invalid"
  | "verification_required"
  | "store_missing"
  | "pdf_email"
  | "team_created"
  | "appointment";

export type Submission = {
  outcome: SubmissionOutcome;
  reportId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  detail?: unknown;
};

const sql = database();
let ready: Promise<unknown> | null = null;
const migrate = () =>
  (ready ??= sql!`
    create table if not exists lead_submissions (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      outcome text not null,
      report_id text,
      name text,
      email text,
      phone text,
      address text,
      detail jsonb
    )
  `);
const file = sql ? null : localFile("submissions.json");

/** Never throws: logging must not cost the homeowner their report. */
export async function recordSubmission(entry: Submission): Promise<void> {
  try {
    if (sql) {
      await migrate();
      await sql`
        insert into lead_submissions (outcome, report_id, name, email, phone, address, detail)
        values (${entry.outcome}, ${entry.reportId ?? null}, ${entry.name ?? null}, ${entry.email ?? null},
                ${entry.phone ?? null}, ${entry.address ?? null}, ${JSON.stringify(entry.detail ?? null)}::jsonb)
      `;
      return;
    }
    if (!file) {
      console.info(JSON.stringify({ event: "submission", ...entry }));
      return;
    }
    const data = await file.load<Array<Submission & { createdAt: string }>>([]);
    data.push({ ...entry, createdAt: new Date().toISOString() });
    await file.save(data);
  } catch (error) {
    console.error(JSON.stringify({ event: "submission_log_failed", outcome: entry.outcome, error: String(error), entry }));
  }
}
