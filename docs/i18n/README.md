# i18n Translator Handoff

`locale-translator-handoff.csv` is the source handoff for completing the
currently stubbed app locales:

- `apps/kitchen-display`: `zh-CN`, `vi-VN`, `ms-MY`, `id-ID`
- `apps/onboarding-app`: `zh-CN`, `vi-VN`, `ms-MY`, `id-ID`
- `apps/management-portal`: `zh-CN`, `vi-VN`, `ms-MY`, `id-ID`

Each row contains the app name, dot-path key, Traditional Chinese source text,
English source text, and one blank column for each target locale.

To regenerate the handoff after source copy changes:

```sh
pnpm exec tsx scripts/i18n-locale-coverage.ts --export-handoff
```

The export preserves any already-filled target cells for matching `app` + `key`
rows, so it is safe to rerun after source copy changes.

After the target columns have been reviewed and approved by translators, import
the approved CSV:

```sh
pnpm run i18n:check-handoff -- docs/i18n/locale-translator-handoff.csv
pnpm run i18n:import-handoff -- docs/i18n/locale-translator-handoff.csv
```

The check/import validates that every `zh-CN`, `vi-VN`, `ms-MY`, and `id-ID`
cell is filled for every current source key. The check command is read-only; the
import command performs the same validation before writing locale files. Both
commands also validate `locale-approval-manifest.json`, which records the
approved handoff SHA-256, approval date, reviewer, covered apps, and covered
locales.

To check whether target locales still have fewer leaf keys than `zh-TW`:

```sh
pnpm run check:i18n-locales
```

The CI check emits warnings rather than failing while target copy is still in
translator review. Once the approved CSV has been imported, use the strict gate
before declaring the work complete:

```sh
pnpm run check:i18n-locales:strict
```

A locale stub replacement can be declared complete only after:

1. The target columns in `locale-translator-handoff.csv` have explicit
   translator approval.
2. `locale-approval-manifest.json` records the approved handoff SHA-256 and
   reviewer metadata.
3. `pnpm run i18n:check-handoff -- docs/i18n/locale-translator-handoff.csv`
   passes.
4. `pnpm run i18n:import-handoff -- docs/i18n/locale-translator-handoff.csv`
   has generated the target locale files.
5. `pnpm run check:i18n-locales:strict` passes.
