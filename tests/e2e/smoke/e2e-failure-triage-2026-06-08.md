# E2E Failure Triage - 2026-06-08

## Command

```powershell
$env:SMOKE_AUTH_USERNAME='grandmaShop'
$env:SMOKE_AUTH_PASSWORD='password123'
rtk pnpm test:e2e
```

Before the full run, Playwright browsers were installed with:

```powershell
rtk pnpm exec playwright install
```

## Result

- Total: 115 tests
- Passed: 48
- Failed: 65
- Skipped: 2
- Duration: about 4.4 minutes
- Exit code: 1

The report is generated at `playwright-report/results.json`.

## Failure Buckets

### Authentication Instability

The smoke credentials are valid when tested directly against the local API:

- Username: `grandmaShop`
- Password: `password123`
- Endpoint: `POST http://localhost:8787/api/v1/auth/login`
- Direct status: 200

However, the full E2E run produced multiple `owner login status 401` failures. This points to full-suite environment or timing instability rather than a permanently invalid credential.

### Menu Management Selectors

`owner-menu-management.spec.ts` expects an `Add Category` button, but the current UI renders the category action as `Add`. The page itself loads and shows mocked menu data, so the failure is a stale selector or stale copy expectation.

There is also a strict mode failure for `Add Item` because the locator matches two buttons.

### POS Selectors

`owner-pos-usage-state.spec.ts` has repeated failures waiting for headings:

- `Today's Performance`
- `Today's Revenue`

The current POS UI no longer exposes these headings in the expected form, or the route lands in a different state than the test assumes.

### Owner Overview And Navigation

Several overview/order tests navigate to `/login` or fail URL assertions after quick actions. These likely cascade from the authentication instability and should be rechecked after the login/session setup is made deterministic.

### Backoffice Service Bookings

`owner-backoffice-pages.spec.ts` fails on the service booking scenario because `Private Tasting` is not visible. The route loads, but the mock data or the UI assertion is out of sync.

### Runtime API Compatibility

One smoke test fails with `page.clock is not a function`. That test needs to use a Playwright-supported clock API for the installed runtime, or avoid the clock helper.

## Skipped Tests

Two smoke tests were skipped:

- Admin realtime WebSocket smoke
- Layer 3 guest happy path round-trip

They require additional environment variables such as `SMOKE_ADMIN_URL`, `SMOKE_RESTAURANT_ID`, and `SMOKE_MENU_ITEM_ID`.

Follow-up change: local smoke runs now discover the Layer 3 fixture IDs when `SMOKE_API_URL` points at localhost and `SMOKE_AUTH_USERNAME` / `SMOKE_AUTH_PASSWORD` are set. The discovery logs in, reads the user's `restaurantId`, and selects the first available item from `/api/v1/menu/:id`. For deployed production URLs, `SMOKE_RESTAURANT_ID` and `SMOKE_MENU_ITEM_ID` remain explicit requirements. `SMOKE_ADMIN_URL` defaults to `http://localhost:3001` only for localhost; deployed runs still need an intentional admin URL.
