# Spec: Eliminate production explicit `any`

## Objective

Remove each ESLint-reported `@typescript-eslint/no-explicit-any` warning from
production TypeScript without weakening type safety. Prefer existing Drizzle
inferred row types and shared domain types. The resulting production lint run
must have zero warnings so the rule can become an error without exceptions.

## Commands

```bash
pnpm exec eslint <changed-file>
pnpm --filter @makanmasak/database typecheck
pnpm --filter @makanmasak/database exec vitest run <changed-test>
pnpm lint
pnpm typecheck
```

## Project Structure

- `packages/database/src/services/` — primary remediation target
- `packages/database/src/schema/` — Drizzle source-of-truth for row types
- `packages/shared-types/src/` — shared DTO and configuration types
- `packages/database/src/services/*.test.ts` — database service tests

## Code Style

```ts
type MenuItemRecord = typeof menuItems.$inferSelect;

function mapMenuItem(item: MenuItemRecord): MenuItem {
  return { id: item.id, name: item.name } as MenuItem;
}
```

Use named types at the narrowest reusable scope; do not replace `any` with an
unrelated assertion merely to silence lint.

## Testing Strategy

Typing-only substitutions are verified by targeted ESLint and TypeScript
checks. If a JSON shape needs a new type or changes runtime data handling, add
a focused round-trip test before implementation and run its owning suite.

## Boundaries

- Always: preserve runtime behavior, work one clean file per commit, and run
  targeted verification before committing.
- Ask first: database schema changes, dependencies, or a type that needs an
  externally visible contract decision.
- Never: blanket-disable the ESLint rule, add production `as any`, modify
  already-staged work owned by another session, or rewrite raw SQL during this
  remediation.

## Success Criteria

- Every production `no-explicit-any` warning is replaced by a real, checked
  type.
- Existing shared and Drizzle types are reused where they describe the value.
- The production lint run has no `no-explicit-any` warnings before the rule is
  changed from warning to error.
- Each commit is limited to one independently verified file (and its test when
  needed).

## Open Questions

The exact remaining warning count is intentionally dynamic while concurrent
work is landing; each batch is selected from a fresh ESLint result.
