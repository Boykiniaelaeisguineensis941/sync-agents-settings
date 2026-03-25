---
name: report-schema
description: Print or write markdown documentation for JSON report schema
---

Generate report schema markdown from code metadata (`COMMAND_REQUIRED_FIELDS`) and print to stdout or write to file.

## Usage

```bash
# Print to stdout
npx sync-agents-settings report-schema

# Write to docs file
npx sync-agents-settings report-schema --write docs/report-schema.md

# CI check: fail if docs/report-schema.md is stale or missing
npx sync-agents-settings report-schema --check
```

## Notes

- Use this command after changing report payload fields or parser validation rules.
- The generated file should include the "Required Fields (Generated)" section.
- `--check` exits with code `1` when target schema file is missing or outdated.
