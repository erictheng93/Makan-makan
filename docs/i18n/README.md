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
pnpm run i18n:import-handoff -- docs/i18n/locale-translator-handoff.csv
```

The import validates that every `zh-CN`, `vi-VN`, `ms-MY`, and `id-ID` cell is
filled for every current source key before writing locale files.

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
