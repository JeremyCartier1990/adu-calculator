import assert from "node:assert/strict";
import test from "node:test";
import { parseAttribution } from "./attribution";
import { leadPayload, sendLeadWebhook } from "./lead-webhook";
import type { ReportRecord } from "./report";

const report: ReportRecord = {
  id: "abc123",
  createdAt: "2026-11-20T18:00:00.000Z",
  updatedAt: "2026-11-20T18:00:00.000Z",
  name: "Maria de la Cruz",
  email: null,
  phone: "+13105550123",
  phoneVerified: true,
  property: {
    address: "123 Main St, Los Angeles, CA 90001",
    squareFootage: 1500,
    lotSize: 6000,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1952,
    propertyType: "Single Family",
    homeValue: 1_100_000,
    latitude: 34,
    longitude: -118,
    source: "rentcast",
    edited: ["homeValue"],
  },
  inputs: null,
  financials: null,
  createdBy: "homeowner",
} as ReportRecord;

test("attribution keeps only known keys, trimmed and bounded", () => {
  const parsed = parseAttribution({ utm_source: " facebook ", utm_campaign: "x".repeat(900), evil: "1", fbclid: "" });
  assert.deepEqual(Object.keys(parsed ?? {}).sort(), ["utm_campaign", "utm_source"]);
  assert.equal(parsed?.utm_source, "facebook");
  assert.equal(parsed?.utm_campaign?.length, 500);
  assert.equal(parseAttribution({}), null);
  assert.equal(parseAttribution("nope"), null);
});

test("the lead payload carries the lead, property, UTMs, and report link", () => {
  const payload = leadPayload(report, { utm_source: "facebook", utm_campaign: "adu-la", fbclid: "fb.1", rtkcid: "rt-9" });
  assert.equal(payload.redtrack_click_id, "rt-9");
  assert.equal(payload.report_url, "https://aduroicalculator.com/r/abc123");
  assert.equal(payload.lead.first_name, "Maria");
  assert.equal(payload.lead.last_name, "de la Cruz");
  assert.equal(payload.property.data_source, "public_records");
  assert.equal(payload.property.street, "123 Main St");
  assert.equal(payload.property.city, "Los Angeles");
  assert.equal(payload.property.state, "CA");
  assert.equal(payload.property.zipcode, "90001");
  assert.equal(payload.utm.utm_source, "facebook");
  assert.equal(payload.utm.utm_medium, null);
  assert.equal(payload.utm.fbclid, "fb.1");
  assert.ok(payload.estimate.build_cost > 0 && payload.estimate.value_added > 0);
});

test("the webhook posts JSON once on success and retries once on failure", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const realFetch = globalThis.fetch;
  process.env.LEAD_WEBHOOK_URL = "https://example.test/hook";
  let status = 500;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    return new Response(null, { status });
  }) as typeof fetch;
  try {
    await sendLeadWebhook(report, null);
    assert.equal(calls.length, 2);
    status = 200;
    calls.length = 0;
    await sendLeadWebhook(report, null);
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].body).report_id, "abc123");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.LEAD_WEBHOOK_URL;
  }
});
