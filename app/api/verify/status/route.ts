import { cookies } from "next/headers";
import { connection } from "next/server";
import { hasTeamAccess } from "@/lib/admin-auth";
import { verificationConfigured, verifiedPhoneFromRequest } from "@/lib/verify-cookie";

export async function GET(request: Request): Promise<Response> {
  await connection();
  const phone = verifiedPhoneFromRequest(request);
  return Response.json({
    ok: true,
    twilio: verificationConfigured(),
    airroi: Boolean(process.env.AIRROI_API_KEY?.trim()),
    verified: Boolean(phone),
    phone,
    /** Team sessions load AirROI without a phone check. */
    team: hasTeamAccess(await cookies()),
  });
}
