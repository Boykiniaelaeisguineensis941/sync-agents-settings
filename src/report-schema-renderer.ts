import { KNOWN_REPORT_COMMANDS, COMMAND_REQUIRED_FIELDS } from "./report-parser.js";

export function renderReportRequiredFieldsMarkdown(): string {
  const lines: string[] = [];
  lines.push("## Required Fields (Generated)");
  lines.push("");
  lines.push("Generated from `src/report-parser.ts` `COMMAND_REQUIRED_FIELDS`.");
  lines.push("");

  for (const command of KNOWN_REPORT_COMMANDS) {
    lines.push(`### \`${command}\``);
    const specs = COMMAND_REQUIRED_FIELDS[command];
    for (const spec of specs) {
      lines.push(`- \`${spec.field}\` (${spec.type})`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function generateReportSchemaDocument(): string {
  const sections: string[] = [
    "# Report Schema",
    "",
    "This document defines the machine-readable JSON payloads returned by commands with `--report json`.",
    "",
    "## Common Contract",
    "",
    "- Every report payload includes `schemaVersion`.",
    "- Current value: `schemaVersion: 1`.",
    "- Consumers should reject unknown major schema versions.",
    "- Use `src/report-parser.ts` (`parseJsonReport`) as the canonical parser helper for downstream integrations.",
    "- For strict typed consumption, use `parseKnownJsonReport` + `KnownJsonReport` (discriminated union by `command`).",
    "- Parser error codes:",
    "  - `INVALID_JSON`",
    "  - `MISSING_SCHEMA_VERSION`",
    "  - `UNSUPPORTED_SCHEMA_VERSION`",
    "  - `INVALID_COMMAND_PAYLOAD` (schema version is valid but required fields for the `command` payload are missing or wrong type)",
    "  - `UNKNOWN_COMMAND`",
    "- Command payload checks are implemented via a single validator map (`COMMAND_PAYLOAD_VALIDATORS`) in `src/report-parser.ts`.",
    "",
    "## Commands",
    "",
    "### `sync --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "sync"`',
    "- `sourceCount: number`",
    "- `dryRun: boolean`",
    "- `skipOAuth: boolean`",
    "- `targets: Array<{ target, added, skipped, configPath? }>`",
    "",
    "### `diff --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "diff"`',
    "- `sourceCount: number`",
    "- `sourceNames: string[]`",
    "- `targets: Array<{ target, shared, onlyInSource, onlyInTarget, note? }>`",
    "",
    "### `doctor --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "doctor"`',
    "- `resultCount: number`",
    "- `sourceCount: number`",
    "- `sourceNames: string[]`",
    "- `hasDrift: boolean`",
    "- `hasErrors: boolean`",
    "- `results: Array<{ target, status, missing, extra, note? }>`",
    "",
    "Exit codes:",
    "- `0`: no drift",
    "- `1`: drift found",
    "- `2`: target parse error",
    "",
    "### `validate --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "validate"`',
    "- `issues: Array<{ target, server, severity, code, message }>`",
    "- `errorCount: number`",
    "- `warningCount: number`",
    "",
    "Exit codes:",
    "- `0`: no validation errors (warnings allowed)",
    "- `2`: validation errors found",
    "",
    "### `reconcile --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "reconcile"`',
    '- `status: "validation_failed" | "doctor_failed" | "noop" | "reconciled"`',
    "- `validation: { issues, errorCount, warningCount }`",
    "- `doctor?: { ...doctor payload subset }`",
    "- `syncResults: Array<{ target, missing, added, skipped }>`",
    "- `backupDir?: string`",
    "",
    "### `sync-instructions --report json`",
    "",
    "Top-level fields:",
    "- `schemaVersion: number`",
    '- `command: "sync-instructions"`',
    "- `unsupportedGlobalTargets: string[]`",
    "- `global?: { synced, skipped, appended }`",
    "- `local?: { synced, skipped, appended }`",
    "",
    "Notes:",
    "- To keep JSON output clean in non-dry-run mode, use `--on-conflict` and `--no-backup`.",
    "- In JSON mode, the CLI uses a non-interactive conflict strategy.",
    "",
    "## Minimal Examples",
    "",
    "```json",
    '{ "schemaVersion": 1, "command": "validate", "issues": [], "errorCount": 0, "warningCount": 0 }',
    "```",
    "",
    "```json",
    '{ "schemaVersion": 1, "command": "doctor", "resultCount": 1, "hasDrift": false, "hasErrors": false, "results": [] }',
    "```",
    "",
    renderReportRequiredFieldsMarkdown().trim(),
    "",
  ];

  return sections.join("\n").trim() + "\n";
}
