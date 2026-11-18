# Home First Remodel — ADU calculator

A single-page marketing site and planning calculator for homeowners considering a garage conversion or ADU in the Los Angeles area. It estimates construction cost, rental income, payback, and the value the new space may add.

The figures are **estimates, not quotes**. Rates live in one file so the team can tune them: [`lib/assumptions.ts`](lib/assumptions.ts).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Deploy target: Vercel
- Property value and rent data: [RentCast](https://www.rentcast.io/) (`https://api.rentcast.io/v1`)

Google Places autocomplete is intentionally not required. The address field is a plain text input.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your key to `.env.local`:

```bash
RENTCAST_API_KEY=your_key_here
```

The key is read only on the server from `process.env.RENTCAST_API_KEY`. It is sent to RentCast as the `X-Api-Key` header. It is never sent to the browser and must not be committed. `.env*` is gitignored; `.env.example` lists the variable name only.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run lint
npm run build
```

## Without a RentCast key

The page still works. Lookups return a clear message and the calculator uses editable fields plus Los Angeles planning rates for rent and for price per square foot. **Preview a Venice sample** fills illustrative round numbers for `4 Ozone Ave, Venice, CA 90291`. Those numbers are not that home's real records.

## What a lookup calls

A homeowner presses **Look up home**. The server then calls, in parallel:

- `GET /v1/properties?address=...`
- `GET /v1/avm/value?address=...&compCount=5`

Changing the ADU size requests rent once per 50 sqft step, after an 800ms pause, not on every slider tick:

- `GET /v1/avm/rent/long-term?address=...&propertyType=Apartment&bedrooms=N&bathrooms=1&squareFootage=S&compCount=5&lookupSubjectAttributes=false`

`lookupSubjectAttributes=false` keeps the rent model on the ADU size you send, instead of substituting the existing house. Bedrooms are derived from size (studio under 450 sqft, 1 bed under 700, 2 beds under 1,000, otherwise 3).

Responses are cached for 24 hours:

1. In memory on the server instance, including in-flight dedupe so two identical calls share one request.
2. Next.js `unstable_cache` (Vercel data cache, including across deployments) with a 24-hour revalidate.

The RentCast plan this was built for allows about 50 requests a month. Repeating an address or size inside the window does not call RentCast again. Missing fields and API errors leave the inputs editable.

Do not hammer the sample address against a live key. A full pass is two property calls plus one rent call. Tests use mocked responses and do not touch the network.

Short-term rental income is not a RentCast call. The fallback is a planning model in `lib/assumptions.ts`: nightly rate = long-term monthly rent ÷ 30.4 × 2.4, occupancy defaults to 65%, and the gross is nightly rate × 30.4 × occupancy. Platform fees, management, cleaning, supplies, utilities, and a higher insurance rate are taken out so the comparison with a 12-month lease is not one-sided. The homeowner can edit the nightly rate and occupancy. Payback and the income approach follow whichever scenario is selected.

Real short-term comps come from AirROI `GET /calculator/estimate` with header `X-API-KEY` (`AIRROI_API_KEY`). That call runs only after the visitor verifies a phone by SMS through Twilio Verify (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`). A signed httpOnly cookie (`VERIFY_COOKIE_SECRET`, 12 hours) is what `/api/str` checks. Results are cached for 24 hours. If those env vars are missing, the page keeps the planning estimate and still builds. RentCast stays available without phone verification.

## Lead form

`POST /api/lead` checks the name, phone, email, and address, drops a filled honeypot, and logs a sanitized payload. Nothing is stored. The route is marked `TODO(crm)` for a later handoff to HubSpot, GoHighLevel, or the company pipeline.

## Deploy on Vercel

Import the repo, set `RENTCAST_API_KEY` in the project environment variables, and deploy. No other secrets are required. Do not prefix the key with `NEXT_PUBLIC_`.

## Project map

| Path | Role |
| --- | --- |
| `app/page.tsx` | Marketing page |
| `components/estimator.tsx` | Calculator UI |
| `lib/assumptions.ts` | Every tunable rate |
| `lib/calculate.ts` | Cost, rent, payback, value |
| `app/api/property/route.ts` | Property + value lookup |
| `app/api/rent/route.ts` | ADU rent lookup |
| `app/api/lead/route.ts` | Consultation request log |
