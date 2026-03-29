# AGENTS.md

## Project

smtp-relay is a configurable SMTP relay server written in TypeScript. It supports filtering (whitelist, auth, HTTP-based), multiple output processors (AWS, GCP, file, nodemailer), and Prometheus metrics.

## Build & Test

```bash
npm run build          # Compile TypeScript (tsc-esm)
npm test               # Build + run tests with coverage (c8 mocha)
npm run typecheck      # Type-check without emitting
```

## Code Quality Requirements

- **TypeScript strict mode is enabled** — do not use `// @ts-ignore` or weaken type checks.
- **100% test coverage is required.** Before committing, run `npm test` and verify that line, branch, function, and statement coverage are all at 100%. If your changes introduce uncovered lines, add or update tests before committing.
- Use `npm run typecheck` to verify compilation before pushing.

## Style

- Formatting is enforced by Prettier (`npm run lint` to check).
- Tests use `@testdeck/mocha` with `assert` (not chai/expect). Test files are co-located as `*.spec.ts`.
- No `console.log` — use `this.logger.log()` with appropriate levels (ERROR, INFO, DEBUG).
