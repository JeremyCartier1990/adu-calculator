import assert from "node:assert/strict";
import test from "node:test";
import { validateLead } from "./lead";

const estimate = {
  projectType: "detached_adu",
  projectLabel: "Detached ADU",
  sqft: 800,
  bedrooms: 2,
  finish: "premium",
  totalCost: 475000,
  monthlyRent: 3900,
  annualNet: 28000,
  breakEvenYears: 12.4,
  equity: 120000,
};

test("lead payload is sanitized and the estimate snapshot is kept", () => {
  const result = validateLead({
    name: "  Jane\nDoe <b> ",
    phone: "(310) 555-0100",
    email: "Jane.Doe@Example.com",
    address: "4 Ozone Ave, Venice, CA 90291",
    companyWebsite: "",
    estimate,
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.dropped) return;
  assert.equal(result.lead.name, "Jane Doe b");
  assert.equal(result.lead.phone, "+13105550100");
  assert.equal(result.lead.email, "jane.doe@example.com");
  assert.equal(result.lead.address, "4 Ozone Ave, Venice, CA 90291");
  assert.equal(result.lead.estimate?.sqft, 800);
  assert.equal(result.lead.name.includes("\n"), false);
  assert.equal(result.lead.name.includes("<"), false);
});

test("invalid contact fields are rejected together", () => {
  const result = validateLead({
    name: "J",
    phone: "555",
    email: "not-an-email",
    address: "hi",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.name);
  assert.ok(result.errors.phone);
  assert.ok(result.errors.email);
  assert.ok(result.errors.address);
});

test("a filled honeypot is dropped without a lead", () => {
  const result = validateLead({
    name: "Bot Person",
    phone: "3105550100",
    email: "bot@example.com",
    address: "1 Main St, Los Angeles, CA 90001",
    companyWebsite: "https://spam.example",
  });
  assert.deepEqual(result, { ok: true, dropped: true });
});

test("a broken estimate snapshot does not reject a valid lead", () => {
  const result = validateLead({
    name: "Ada Lovelace",
    phone: "3105550199",
    email: "ada@example.com",
    address: "4 Ozone Ave, Venice, CA 90291",
    estimate: { projectType: "spaceship", sqft: "huge" },
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.dropped) return;
  assert.equal(result.lead.estimate, null);
});
