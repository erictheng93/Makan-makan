# Spec: Lint Warning Remediation

## Objective

Make existing ESLint warnings actionable without changing product behaviour.
First protect the five workspaces already at zero warnings, then remove the
remaining warnings in `@makanmasak/database` and `makanmasak-admin-dashboard`.
Every replacement for `any` must either use the existing domain contract or
narrow an honestly unknown value before it is read.

## Commands

- `pnpm --filter <workspace> run lint`
- `pnpm --filter <workspace> run typecheck`
- `pnpm --filter <workspace> run test:run` (database)
- `pnpm --filter makanmasak-admin-dashboard run test -- --run`
- `pnpm lint`
- `pnpm typecheck`

## Project Structure

- `packages/database/src/` contains D1 schema, services, and query helpers.
- `apps/admin-dashboard/src/` contains Vue views, composables, and API clients.
- Each workspace owns its `package.json` lint command and, for Vue apps, its
  ESLint flat config.

## Code Style

Use an existing precise type wherever a value has a known contract. Use
`unknown` only at external or dynamic boundaries, and narrow it before reading.

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

No broad lint disables, mechanical `any` to `unknown` substitutions, or
unjustified type assertions are allowed.

## Testing Strategy

Configuration-only gate changes are verified with ESLint using
`--max-warnings 0`. For each source change, run its workspace lint and
typecheck, existing focused tests for affected services/components, and full
workspace tests when the batch is complete. The final gate is repository-wide
lint and typecheck.

## Boundaries

- Always: preserve behavior; keep each batch small; verify before committing.
- Ask first: schema changes, dependencies, rule disablements, or CI changes.
- Never: suppress a warning without a documented reason, introduce `any`, or
  replace a meaningful type with un-narrowed `unknown`.

## Success Criteria

1. `shared-types`, `utils`, `queue-core`, `customer-app`, and
   `kitchen-display` enforce zero warnings in their lint scripts.
2. `@makanmasak/database` reports zero warnings and then enforces that state.
3. `makanmasak-admin-dashboard` reports zero warnings and then enforces that
   state.
4. All changed workspaces pass lint, typecheck, and relevant tests.

## Delivery Plan

1. Add the zero-warning gates and correct kitchen's declaration-file ignore.
2. Clear database unused variables, then database services and utilities in
   small domain-focused batches.
3. Clear admin contracts/services, composables, UI, and tests in separate
   batches.
4. Perform a final five-axis review and run repository-wide validation.
