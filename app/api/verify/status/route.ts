import { connection } from "next/server";
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
  });
}
