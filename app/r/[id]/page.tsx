import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { ReportOwner } from "@/components/report/report-owner";
import { ReportView } from "@/components/report/report-view";
import { ADMIN_COOKIE_NAME, isAdminToken } from "@/lib/admin-auth";
import { getReport } from "@/lib/report-store";

export const metadata: Metadata = {
  title: "ADU ROI report",
  robots: { index: false, follow: false },
};

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, cookieStore] = await Promise.all([getReport(id), cookies()]);
  if (!report) notFound();
  const showContact = isAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  const view = <ReportView report={report} showContact={showContact} />;
  // The team's view always stays read-only, with the lead's contact details.
  return showContact ? view : <ReportOwner report={{ id: report.id, property: report.property, inputs: report.inputs }}>{view}</ReportOwner>;
}

export default function ReportPage({ params }: PageProps<"/r/[id]">) {
  return (
    <div className="min-h-svh">
      <header className="no-print border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/#start" className="text-sm font-medium text-ink-soft hover:text-ink">
            Run another address
          </Link>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-12 text-sm text-ink-soft">Loading report…</p>}>
        <Report params={params} />
      </Suspense>
    </div>
  );
}
