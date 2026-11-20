import "server-only";

import { database, localFile } from "./db";

// Every answer bought from a data partner (RentCast, PropertyReach, AirROI) is
// kept forever, keyed by the request, so the same lookup is never paid twice.
// Failures aren't stored: `load` throws, and the next request tries again.

type Provider = "rentcast" | "propertyreach" | "airroi";

const sql = database();
let ready: Promise<unknown> | null = null;
const migrate = () =>
  (ready ??= sql!`
    create table if not exists partner_responses (
      provider text not null,
      request_key text not null,
      payload jsonb,
      fetched_at timestamptz not null default now(),
      primary key (provider, request_key)
    )
  `);
const file = sql ? null : localFile("partner-responses.json");
type Saved = Record<string, { payload: unknown; fetchedAt: string }>;

async function stored(provider: Provider, key: string): Promise<{ payload: unknown } | null> {
  if (sql) {
    await migrate();
    const rows = (await sql`
      select payload from partner_responses where provider = ${provider} and request_key = ${key}
    `) as Array<{ payload: unknown }>;
    return rows[0] ?? null;
  }
  return (await file?.load<Saved>({}))?.[`${provider}|${key}`] ?? null;
}

async function store(provider: Provider, key: string, payload: unknown): Promise<void> {
  if (sql) {
    await migrate();
    await sql`
      insert into partner_responses (provider, request_key, payload)
      values (${provider}, ${key}, ${JSON.stringify(payload ?? null)}::jsonb)
      on conflict (provider, request_key) do nothing
    `;
    return;
  }
  if (!file) return;
  const data = await file.load<Saved>({});
  data[`${provider}|${key}`] = { payload, fetchedAt: new Date().toISOString() };
  await file.save(data);
}

/** The stored answer for this request, or `load()`'s answer, saved for good. Storage errors never block a lookup. */
export async function permanent<T>(provider: Provider, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await stored(provider, key).catch((error: unknown) => {
    console.error(JSON.stringify({ event: "partner_store_read_failed", provider, error: String(error) }));
    return null;
  });
  if (hit) {
    console.info(JSON.stringify({ event: "partner_reused", provider }));
    return hit.payload as T;
  }
  const payload = await load();
  await store(provider, key, payload).catch((error: unknown) => {
    console.error(JSON.stringify({ event: "partner_store_write_failed", provider, error: String(error) }));
  });
  return payload;
}
