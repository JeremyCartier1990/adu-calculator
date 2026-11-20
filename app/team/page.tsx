import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLogin, SignOut } from "@/components/admin/session-controls";
import { Logo } from "@/components/brand";
import { TeamBuilder } from "@/components/team/team-builder";
import { hasTeamAccess, teamConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Team builder | ADU ROI Calculator",
  robots: { index: false, follow: false },
};

async function Builder() {
  // Session checks read the clock, so this renders per request.
  await connection();
  const cookieStore = await cookies();
  if (!hasTeamAccess(cookieStore)) {
    if (!teamConfigured()) {
      return <p className="mx-auto mt-16 max-w-md text-center text-sm text-ink-soft">Set TEAM_ACCESS_CODE (8+ characters) to enable the team builder.</p>;
    }
    return <AdminLogin endpoint="/api/team/session" title="Team builder" subtitle="Build ADU reports for clients." label="Access code" />;
  }
  return (
    <>
      <div className="no-print mx-auto flex max-w-[1400px] justify-end px-4 pt-3">
        <SignOut endpoint="/api/team/session" />
      </div>
      <TeamBuilder />
    </>
  );
}

/** Private team report builder: not linked anywhere, behind TEAM_ACCESS_CODE (or an admin session). */
export default function TeamPage() {
  return (
    <div className="min-h-svh pb-16">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4">
          <Link href="/team">
            <Logo />
          </Link>
          <span className="text-sm font-medium text-ink-soft">Team builder</span>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto mt-16 max-w-md text-center text-sm text-ink-soft">Loading…</p>}>
        <Builder />
      </Suspense>
    </div>
  );
}
