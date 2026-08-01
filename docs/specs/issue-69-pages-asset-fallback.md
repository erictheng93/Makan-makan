# Spec: Pages Asset Fallback Guard

## Objective

Prevent missing Vite assets from being served as `200 text/html` by
Cloudflare Pages SPA fallback while preserving existing assets and client-side
route navigation for all five Pages applications.

## Tech Stack

- Cloudflare Pages file-based Functions
- Wrangler direct upload with automatic `functions/` discovery
- Vitest for deterministic Worker response tests

## Commands

- Test: `pnpm exec vitest run tests/unit/pages-asset-guard.test.ts`
- Build: `pnpm --filter <app-package> run build`
- Local runtime:
  `pnpm exec wrangler pages dev <app-dist> --port <port>`
- Preview deploy:
  `pnpm exec wrangler pages deploy <app-dist> --project-name <name> --branch issue-69-validation`

## Project Structure

- `apps/*/functions/assets/[[path]].js`: asset-only fallback guard
- `tests/unit/pages-asset-guard.test.ts`: response-level regression coverage

## Code Style

```js
const response = await env.ASSETS.fetch(request);

if (isHtmlResponse(response)) {
  return assetNotFoundResponse();
}

return response;
```

Use small named predicates, Web Platform APIs, and no runtime dependencies.

## Testing Strategy

- Unit tests execute every deployed asset Function with a fake ASSETS binding
  and assert response behavior, not file contents.
- Wrangler's generated routing is verified through the local Pages runtime.
- `wrangler pages dev` verifies missing assets, real assets, and SPA deep links
  through Cloudflare's local Pages runtime.
- A Cloudflare preview deployment verifies the same behavior on the actual
  Pages platform before production rollout.

## Boundaries

- Always: return `404` with `Cache-Control: no-store` for asset HTML fallback.
- Always: preserve valid static asset responses unchanged.
- Always: preserve Pages SPA fallback for non-asset routes.
- Ask first: migrate custom domains from Pages to Workers.
- Never: add a top-level `404.html` that breaks unenumerated SPA deep links.
- Never: rely on a configuration-shape assertion as production proof.

## Success Criteria

1. Missing `/assets/<random>.js` returns `404`, never `200 text/html`.
2. The missing-asset response has an empty body and `Cache-Control: no-store`.
3. Existing JavaScript and CSS assets retain their original content type/body.
4. SPA deep links continue to return and render `index.html`.
5. All five Pages applications provide an asset-only Function and no manually
   maintained `_routes.json`.
6. Unit, build, local Pages runtime, and Cloudflare preview checks pass.

## Open Questions

None. A future Pages-to-Workers migration is intentionally outside this fix.
