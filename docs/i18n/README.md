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

To check whether target locales still have fewer leaf keys than `zh-TW`:

```sh
pnpm run check:i18n-locales
```

The CI check emits warnings rather than failing because the target copy still
requires translator approval before it should replace the runtime stubs.
