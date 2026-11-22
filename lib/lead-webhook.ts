import { splitAddress } from "./address";
import { dayLabel, TIME_ZONE, windowFor, type Appointment } from "./appointment";
import { ATTRIBUTION_KEYS, type Attribution } from "./attribution";
import { bedroomsForSqft, projectTitle } from "./assumptions";
import { BRAND } from "./brand";
import { calculateEstimate, fallbackMonthlyRent } from "./calculate";
import { bestSetup } from "./optimize";
import type { ReportRecord } from "./report";

/** What the report opens on, priced with planning rents, so the team sees the pitch before opening it. */
function openingEstimate(report: ReportRecord) {
  const { property } = report;
  const size = { homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize };
  const setup = bestSetup(size);
  const estimate = calculateEstimate({
    ...setup,
    monthlyRent: fallbackMonthlyRent(setup.sqft, bedroomsForSqft(setup.sqft)),
    rentLow: null,
    rentHigh: null,
    rentSource: "assumption",
    ...size,
    rentalUse: "long_term",
  });
  return {
    adu_type: projectTitle(setup.projectType),
    adu_sqft: setup.sqft,
    finish: setup.finish,
    build_cost: estimate.total,
    value_added: estimate.blendedUplift,
    home_value_after: estimate.newHomeValue,
    monthly_rent_long_term: estimate.scenarios.longTerm.monthlyGross,
    monthly_net_long_term: estimate.scenarios.longTerm.monthlyNet,
    monthly_net_short_term: estimate.scenarios.shortTerm.monthlyNet,
  };
}

export function leadPayload(report: ReportRecord, attribution: Attribution | null) {
  const [firstName, ...rest] = report.name.trim().split(/\s+/);
  const utm = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, attribution?.[key] ?? null]));
  const { property } = report;
  return {
    event: "lead.created",
    source: BRAND.domain,
    report_id: report.id,
    report_url: `${BRAND.url}/r/${report.id}`,
    report_pdf_url: `${BRAND.url}/r/${report.id}/pdf`,
    created_at: report.createdAt,
    lead: {
      name: report.name,
      first_name: firstName ?? "",
      last_name: rest.join(" "),
      phone: report.phone,
      phone_verified: report.phoneVerified,
      email: report.email,
    },
    property: {
      address: property.address,
      ...splitAddress(property.address),
      home_sqft: property.squareFootage,
      lot_sqft: property.lotSize,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      year_built: property.yearBuilt,
      property_type: property.propertyType,
      home_value: property.homeValue,
      latitude: property.latitude,
      longitude: property.longitude,
      data_source: property.source === "rentcast" ? "public_records" : "entered_by_homeowner",
      edited_fields: property.edited,
    },
    estimate: openingEstimate(report),
    utm,
    redtrack_click_id: attribution?.rtkcid ?? null,
    landing_page: attribution?.landingPage ?? null,
    referrer: attribution?.referrer ?? null,
  };
}

/** POST a new lead to LEAD_WEBHOOK_URL. Runs after the response; one retry, never throws. */
export async function sendLeadWebhook(report: ReportRecord, attribution: Attribution | null): Promise<void> {
  await postWebhook(report.id, leadPayload(report, attribution));
}

export function appointmentPayload(report: ReportRecord, appointment: Appointment, attribution: Attribution | null) {
  const window = windowFor(appointment.window);
  return {
    ...leadPayload(report, attribution),
    event: "appointment.requested",
    appointment: {
      date: appointment.date,
      day: dayLabel(appointment.date, "long"),
      window: window.id,
      window_label: `${window.label}, ${window.hours}`,
      start_time: window.start,
      end_time: window.end,
      time_zone: TIME_ZONE,
      note: appointment.note,
      requested_at: new Date().toISOString(),
    },
  };
}

/** POST a call request to LEAD_WEBHOOK_URL, with the same lead fields as the new-lead event. */
export async function sendAppointmentWebhook(report: ReportRecord, appointment: Appointment, attribution: Attribution | null): Promise<void> {
  await postWebhook(report.id, appointmentPayload(report, appointment, attribution));
}

async function postWebhook(id: string, payload: { event: string }): Promise<void> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  const body = JSON.stringify(payload);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        console.info(JSON.stringify({ event: "webhook_sent", type: payload.event, id, status: response.status }));
        return;
      }
      console.error(JSON.stringify({ event: "webhook_failed", type: payload.event, id, status: response.status, attempt }));
    } catch (error) {
      console.error(JSON.stringify({ event: "webhook_failed", type: payload.event, id, error: String(error), attempt }));
    }
  }
}
