import { existsSync, readFileSync } from "node:fs";
import { generateReportSchemaDocument } from "./report-schema-renderer.js";

type CheckReason = "ok" | "missing" | "diff";

export interface ReportSchemaCheckResult {
  upToDate: boolean;
  reason: CheckReason;
  generated: string;
  current?: string;
}

export function checkReportSchemaUpToDate(targetPath: string): ReportSchemaCheckResult {
  const generated = generateReportSchemaDocument();

  if (!existsSync(targetPath)) {
    return {
      upToDate: false,
      reason: "missing",
      generated,
    };
  }

  const current = readFileSync(targetPath, "utf-8");
  if (current !== generated) {
    return {
      upToDate: false,
      reason: "diff",
      generated,
      current,
    };
  }

  return {
    upToDate: true,
    reason: "ok",
    generated,
    current,
  };
}
