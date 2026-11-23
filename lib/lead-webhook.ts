import { splitAddress } from "./address";
import { dayLabel, endTime, meetingType, TIME_ZONE, timeLabel, type Appointment } from "./appointment";
import { ATTRIBUTION_KEYS, type Attribution } from "./attribution";
import { bedroomsForSqft, projectTitle } from "./assumptions";
import { BRAND } from "./brand";
import { calculateEstimate, fallbackMonthlyRent } from "./calculate";
import { openingSetup } from "./optimize";
import type { ReportRecord } from "./report";

/** What the report opens on, priced with planning rents, so the team sees the pitch before opening it. */
function openingEstimate(report: ReportRecord) {
  const { property } = report;
  const size = { homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize };
  const setup = openingSetup(size, property.interest);
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
    adu_interest: property.interest ? projectTitle(property.interest) : "Not sure yet",
    estimate: openingEstimate(report),
    utm,
    // SARA "New Lead - ADU" reads redtrack_click_id. cmpid and sub1–sub8 are sent beside it.
    redtrack_click_id: attribution?.rtkcid ?? null,
    cmpid: attribution?.cmpid ?? null,
    sub1: attribution?.sub1 ?? null,
    sub2: attribution?.sub2 ?? null,
    sub3: attribution?.sub3 ?? null,
    sub4: attribution?.sub4 ?? null,
    sub5: attribution?.sub5 ?? null,
    sub6: attribution?.sub6 ?? null,
    sub7: attribution?.sub7 ?? null,
    sub8: attribution?.sub8 ?? null,
    landing_page: attribution?.landingPage ?? null,
    referrer: attribution?.referrer ?? null,
  };
}

/** POST a new lead to LEAD_WEBHOOK_URL. Runs after the response; one retry, never throws. */
export async function sendLeadWebhook(report: ReportRecord, attribution: Attribution | null): Promise<void> {
  await postWebhook(report.id, leadPayload(report, attribution));
}

export function appointmentPayload(report: ReportRecord, appointment: Appointment, attribution: Attribution | null) {
  const end = endTime(appointment.type, appointment.time);
  return {
    ...leadPayload(report, attribution),
    event: "appointment.requested",
    appointment: {
      date: appointment.date,
      day: dayLabel(appointment.date, "long"),
      meeting_type: appointment.type,
      meeting_location: appointment.type === "onsite" ? report.property.address : "Video call",
      duration_minutes: meetingType(appointment.type).minutes,
      start_time: appointment.time,
      end_time: end,
      time_label: `${timeLabel(appointment.time)} – ${timeLabel(end)} Pacific`,
      time_zone: TIME_ZONE,
      note: appointment.note,
      requested_at: new Date().toISOString(),
    },
  };
}

/** POST a meeting request to LEAD_WEBHOOK_URL, with the same lead fields as the new-lead event. */
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
