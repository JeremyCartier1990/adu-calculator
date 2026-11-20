"use client";

import { useSyncExternalStore } from "react";
import { AnalysisSection } from "@/components/funnel/analysis";
import { readEditKey } from "@/lib/report-keys";
import type { ReportRecord } from "@/lib/report";

/** Only what the calculator needs; never the lead's contact details, which would ship to every visitor. */
export type OwnedReport = Pick<ReportRecord, "id" | "property" | "inputs">;

const noSubscribe = () => () => {};

/**
 * The browser that created a report holds its edit key, so the owner gets the
 * live calculator with their saved settings; anyone else sees `children`, the
 * read-only report rendered on the server.
 */
export function ReportOwner({ report, team = false, children }: { report: OwnedReport; team?: boolean; children: React.ReactNode }) {
  const editKey = useSyncExternalStore(
    noSubscribe,
    () => readEditKey(report.id),
    () => null,
  );
  if (!editKey) return children;
  return (
    <AnalysisSection
      property={report.property}
      report={{ id: report.id, editKey }}
      saveNote={null}
      saved={report.inputs}
      onReportPage
      team={team}
    />
  );
}
