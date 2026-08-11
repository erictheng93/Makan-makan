# `apps/print-agent` — Local ESC/POS Print Daemon

> Part of the Backend-Rust-refactor documentation set. See [README.md](README.md).

## 1. Purpose & topology

`apps/print-agent` is the **only non-Cloudflare-Worker backend app in the
repo**: a plain Node.js process (run via `tsx src/index.ts` in dev,
`node dist/index.js` in prod — `apps/print-agent/package.json:7-9`) meant to
run **on a machine inside the restaurant**, next to the physical thermal
printers. It is not deployed to Cloudflare and has no `wrangler.toml`.

Topology, as evidenced by the code:

- It exposes an **HTTP API on port 3003** (Express) and a **WebSocket server
  on port 3004** (`ws`), both bound to `127.0.0.1` only
  (`LOOPBACK_HOST = "127.0.0.1"`, `LocalPrintService.ts:40,578,727`) — i.e.
  **loopback-only**, not reachable from the network. Something else running
  on the same machine (a local POS UI, a browser extension, an Electron
  shell, etc.) is expected to be the actual HTTP/WS client.
- It does **not poll the cloud API for jobs**. `CLOUD_API_ENDPOINT` is read
  into config (`src/config/defaults.ts:24`) and validated as a URL
  (`src/config/validation.ts:16`), but the two methods that would use it —
  `registerWithCloud()` and `sendHeartbeat()` — are **unimplemented stubs**
  that only `console.debug` a "not implemented, skipping" message
  (`LocalPrintService.ts:847-856`). No HTTP request is ever made to
  `cloudEndpoint` anywhere in this app or in `queue-core`. There is no
  outbound polling loop and no inbound WS-push subscription from the cloud
  side — the agent is presently **cloud-isolated**: it only talks to
  whatever local client calls its HTTP/WS ports directly.
- How a restaurant "runs" it: copy `.env.example` to `.env`, set a
  `PRINT_AGENT_API_KEY` (required — the process throws and the whole binary
  exits at startup if missing/blank, `src/config/defaults.ts:42-50` and
  `defaults.test.ts:42-58`), set `RESTAURANT_ID`, then `pnpm dev` (via tsx) or
  build+`node dist/index.js`. It installs signal handlers for graceful
  shutdown on `SIGINT`/`SIGTERM` (`src/index.ts:35-45`).

## 2. HTTP surface

All routes are mounted under `/api/v1` on an Express app
(`LocalPrintService.ts:565`). Every request (all routes, no exceptions) is
gated by `authenticateRequest` middleware
(`LocalPrintService.ts:192,858-877`), which requires the header
`x-api-key` to equal the configured `apiKey` — the response envelope for
auth failure is `{ success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } }`
(401). CORS is enabled via the `cors` package using `allowedOrigins` from
config (default `*`).

| Method | Path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/print` | `x-api-key` | Create a print job | body: `PrintRequest` (shared-types) | `PrintResponse`; HTTP 200/400/503/500 via `httpStatusForPrintResult` (see below) |
| GET | `/api/v1/print/:jobId` | `x-api-key` | Get job status | — | `{success:true,data:PrintJob}` or 404 `JOB_NOT_FOUND` |
| DELETE | `/api/v1/print/:jobId` | `x-api-key` | Cancel a pending job | — | `{success:true,message:"Job cancelled"}` or 404 `JOB_NOT_FOUND` |
| GET | `/api/v1/devices` | `x-api-key` | List registered printers | — | `{success:true,data:PrinterDevice[]}` |
| GET | `/api/v1/devices/:deviceId` | `x-api-key` | Get one printer | — | `{success:true,data:PrinterDevice}` or 404 `DEVICE_NOT_FOUND` |
| POST | `/api/v1/devices` | `x-api-key` | Manually add/detect+register a printer | body: `{connectionType, address, brand}` (`brand` is read but unused — detection ignores it) | `{success:true,data:device}` or 400 `DEVICE_NOT_DETECTED` / 500 `DEVICE_REGISTER_FAILED` |
| DELETE | `/api/v1/devices/:deviceId` | `x-api-key` | Unregister a printer | — | `{success:true,message:"Device removed successfully"}` (always 200, even if device didn't exist — `unregisterPrinter` is a no-op on unknown id) |
| POST | `/api/v1/devices/:deviceId/test` | `x-api-key` | Print a synthetic test order to a device | — | Same envelope as `/print`; 404 `DEVICE_NOT_FOUND` if device missing |
| GET | `/api/v1/health` | `x-api-key` | Health check | — | `{success:true,data:{status, services, devices, queue, service:"running", uptime, memory, version:"2.0.0"}}`; HTTP 503 if `status==="unhealthy"`, else 200 |
| GET | `/api/v1/statistics` | `x-api-key` | Print statistics | — | `{success:true,data:{uptime,memory,printing:PrintStatistics}}` |
| POST | `/api/v1/discover` | `x-api-key` | One-off printer scan | body: `{connectionTypes?: string[]}` (default `["usb","network"]`) | `{success:true,data:PrinterDevice[],message:"Found N printer(s)"}` |

Error format used throughout this app is `{ success: false, error: { code, message } }`
— this predates and does **not** exactly match the root `CLAUDE.md`
"unified error format" used by `apps/api` (no `details` field is ever
populated here, and the codes are app-local strings like
`DEVICE_NOT_DETECTED`, not the ApiError factory taxonomy). Treat this app's
error contract as its own local convention, not the API's shared one.

`httpStatusForPrintResult` (`LocalPrintService.ts:208-221`) maps
`PrintResponse` outcomes to HTTP status: success → 200; error code
`VALIDATION_ERROR` → 400; `NO_PRINTER_AVAILABLE` → 503; anything else → 500.

The global Express error handler (`errorHandler`,
`LocalPrintService.ts:879-894`) always returns a generic
`{success:false,error:{code:"INTERNAL_ERROR",message:"Internal server error"}}`
regardless of the thrown error — it does not leak error details, but also
does not distinguish error types when it fires (route handlers mostly catch
their own errors already, so this handler is a last-resort net).

## 3. WebSocket surface

A `ws` `WebSocketServer` listens on `127.0.0.1:<wsPort>` (default 3004),
separate from the Express HTTP server (`LocalPrintService.ts:572-625`).

- **Auth on connect**: `verifyClient` checks the `x-api-key` request header
  against the configured `apiKey` (`verifyWebSocketClient`,
  `LocalPrintService.ts:627-634`) — connections without a matching header are
  rejected during the WS handshake (no explicit close code documented, `ws`
  library default).
- **On successful connect**, the server immediately sends a `welcome`
  message: `{type:"welcome", data:{service, restaurantId, timestamp}}`
  (`LocalPrintService.ts:592-601`).
- **Client → server messages** (JSON, parsed with a type guard requiring a
  string `type` field — malformed JSON or missing `type` gets an
  `{type:"error", error:"Invalid message format"}` reply):
  - `{type:"ping"}` → server replies `{type:"pong", timestamp}`.
  - `{type:"subscribe"}` → accepted but **is a no-op**; the comment says
    "實作事件訂閱邏輯" (implement event subscription logic) but no filtering
    is implemented (`LocalPrintService.ts:657-660`) — all connected clients
    receive all broadcast events regardless of any "subscribe" call.
  - Any other `type` → logged as unknown, no reply.
- **Server → client push (broadcast, not targeted)**: every connected client
  receives every event, wrapped as `{type:"event", event:PrinterEvent}`
  (`broadcastEvent`, `LocalPrintService.ts:706-717`). Events are re-emitted
  from `PrintAgentService`'s internal event emitter for: `device_connected`,
  `device_disconnected`, `job_completed`, `job_failed`
  (`LocalPrintService.ts:671-704`). Note `job_started` and
  `device_status_changed`/`device_error` are emitted internally by
  `queue-core`'s services but are **not** among the four types this app
  re-broadcasts over WebSocket — only the four wired in `setupEventHandlers`
  reach WS clients.
- **Reconnect behavior**: none is implemented server-side beyond accepting
  new connections — there is no session/resume concept, no message replay,
  no heartbeat ping *from* the server (only client-initiated `ping`/`pong`).
  On `close` or `error` the socket is simply removed from
  `connectedClients` (`LocalPrintService.ts:613-623`). Any reconnect logic
  must live entirely in the client.
- On `stop()`, all connected client sockets are force-closed
  (`connectedClients.forEach((ws) => ws.close())`,
  `LocalPrintService.ts:163`).

## 4. Printing pipeline

### 4.1 Request → job flow

`POST /api/v1/print` → `LocalPrintService` → `PrintAgentService.createPrintJob`
(`apps/print-agent/src/services/PrintAgentService.ts:103-148`), which:
1. Lazily calls `initialize()` if not yet initialized.
2. Validates the request shape locally (`country`, `type`, `data`,
   `data.order` all required — `validatePrintRequest`,
   `PrintAgentService.ts:382-407`); validation failures return
   `{success:false, error:{code:"VALIDATION_ERROR", message}}` (mapped to
   HTTP 400).
3. Delegates to `queue-core`'s `PrinterService.print(request)`
   (`packages/queue-core/src/print/services/PrinterService.ts:216-264`),
   which:
   - Picks a target printer via `selectPrinter` (explicit `deviceId` from
     the request, else `getDefaultDevice()` — first device marked
     `isDefault`, else the first device with status `online`, else the
     first device registered at all). Returns `NO_PRINTER_AVAILABLE` (→ HTTP
     503) if none exists.
   - Formats the receipt via `ReceiptFormattingService.formatReceipt(request)`
     → produces a `PrintContent` object (see 4.3).
   - Creates a `PrintJob` via `PrintJobManager.createJob(...)` and returns
     `{success:true, jobId, estimatedTime}` where `estimatedTime` is a fake
     heuristic (`3000ms + 200ms/item, × copies` —
     `PrinterService.ts:400-406`), not a measured value.

### 4.2 ESC/POS command generation (`queue-core`)

- `ESCPOSCommands` (`packages/queue-core/src/print/commands/ESCPOSCommands.ts`)
  is a static class of pure string builders emitting real ESC/POS byte
  sequences as JS strings (e.g. `initialize()` = `ESC @`, `setBold()` =
  `ESC E n`, `cutPaper()` = `GS V n`, `qrCode()` = the standard `GS ( k`
  QR sequence, `printBarcode()` = `GS k`). This part is a faithful,
  reusable ESC/POS command encoder independent of any transport.
- `CommandBuilder` (`.../commands/CommandBuilder.ts`) is a higher-level
  fluent builder (`addText`, `addBarcode`, `addQRCode`, `addCut`, `addFeed`,
  `addRaw`) that composes `ESCPOSCommands` calls into one command string via
  `buildESCPOS()`. `CommandBuilder.fromPrintContent(content)` is the
  receipt-specific layout: it walks a `PrintContent` object (header →
  transaction info → items (+modifiers) → summary (subtotal/tax/service
  charge/tip/discount) → total → payment/change → footer (thank-you, QR,
  barcode, contact info, legal notice) → feed + cut) and emits the full
  ESC/POS byte string for an 80mm/32-column receipt.
- **This command-generation layer is real and portable** — it has no I/O,
  only string construction, and is the one part of the printing pipeline
  that a Rust port can translate close to 1:1 (byte-for-byte ESC/POS
  sequence construction).

### 4.3 Receipt formatting / templates

- `ReceiptFormattingService` (`.../formatters/ReceiptFormattingService.ts`)
  turns a `PrintRequest` into a `PrintContent` via
  `ReceiptFormatterFactory.createFormatter(country, region)` — one formatter
  class per `CountryCode` (`TWReceiptFormatter`, `MYReceiptFormatter`,
  `VNReceiptFormatter`, all defined and statically registered in
  `.../formatters/ReceiptFormatterFactory.ts:104,226,338,452-463`). Only
  `TW`/`MY`/`VN` have formatters; any other country code throws
  (`ReceiptFormatterFactory.createFormatter` allowlists by map lookup).
  ⚠️ Do not confuse this with the similarly-named
  `.../formatters/RegionFormatters.ts` — that file holds a separate
  `TWRegionFormatter`/`MYRegionFormatter`/`VNRegionFormatter` +
  `RegionFormatterFactory` abstraction (locale string helpers for
  phone/tax-number/currency) whose concrete factory class is **never
  imported anywhere** — dead code; the live receipt logic is in
  `ReceiptFormatterFactory.ts`.
- Region-specific behavior baked into each formatter: tax name/rate (TW 5%
  營業稅, MY 6% SST, VN 10% VAT inclusive), currency symbol/position,
  payment-method translation strings, legal notice text, and a QR code
  pointing at `https://makanmakan.com/receipt/{orderId}` — the **same `.com`
  domain in all three formatters** (`ReceiptFormatterFactory.ts:180,292,405`),
  **hardcoded**, not read from config. (The `.my`/`.vn` domains appear only
  as fallback values for the separate footer `contactInfo.website` field,
  lines 300/413 — not in the QR code.)
- `PrintContent` shape (from `@makanmasak/shared-types`,
  `packages/shared-types/src/printer.ts:108-234`) has four sections:
  `header` (`restaurantInfo` + `transactionInfo` + optional `logo`), `items[]`
  (name, qty, unit/total price, modifiers, tax rate), `summary`
  (subtotal, `tax[]` breakdown, discount, service charge, tip, total,
  `payment[]`, change), `footer` (thank-you message(s), QR/barcode,
  contact info, legal notice).
- `ReceiptTemplate`/`TemplateLayout` types exist (section ordering,
  spacing, alignment, font styles) and `ReceiptFormattingService` maintains
  an in-memory `templates` map with lookup fallback (specific
  `{country}_{type}` → `{country}_default` → `default_{type}` →
  `default_receipt`), but **only one template is ever registered by default**
  (`default_receipt`, cloned per supported country in
  `loadDefaultTemplates()`), and nothing in the actual receipt-building path
  (`CommandBuilder.fromPrintContent`) reads the template's `layout`/`styles`
  fields — the ESC/POS layout is hardcoded in `CommandBuilder`, not
  driven by the `ReceiptTemplate` data structure. Templates are effectively
  unused/vestigial today; do not assume template edits change printed
  output.

### 4.4 Printer discovery / connection — **stubbed, not real I/O**

This is the most important finding for a Rust rewrite: **none of the
driver connect/print/status code in `queue-core` talks to real hardware.**
Every method that would perform actual USB/serial/network I/O is a
simulated placeholder:

- `EpsonDriver.connect()` (`.../drivers/EpsonDriver.ts:38-55`): comment says
  "this would typically involve opening a connection ... For now, simulate
  successful connection" — sets `connected = true` unconditionally, no
  socket/handle is opened.
- `EpsonDriver.sendCommands()` (`EpsonDriver.ts:118-127`): `await new
  Promise(resolve => setTimeout(resolve, commands.length * 2))` — a fake
  delay proportional to string length; the ESC/POS bytes are **never
  written anywhere** (no socket, no file, no serial port).
- `StarDriver` and `CitizenDriver` are hardware-free simulations too, with
  slightly different flavors: `CitizenDriver.connect()` carries the literal
  comment "Simulate connection logic" (`CitizenDriver.ts:40`) and its
  `sendCommands` (`CitizenDriver.ts:108-137`) `setTimeout`s **and**
  `console.log`s the would-be print lines; `StarDriver.connect()`
  (`StarDriver.ts:40-58`) goes through an `initializeStarPrinter()` →
  `sendStarCommands()` sequence first, and `sendStarCommands`
  (`StarDriver.ts:202-211`) is `setTimeout`-only (no logging). Neither
  emits a single byte to real hardware.
- `PrinterDriverFactory.queryDeviceInfo()`
  (`.../drivers/PrinterDriverFactory.ts:325-341`) — the function that is
  supposed to probe a printer at a given address — does not open any
  connection at all; it pattern-matches the **address string itself** for
  substrings like `"epson"`, `"tm-"`, `"star"`, `"tsp"`, `"citizen"`,
  `"ct-"` and returns a hardcoded fake model string, or `null` if nothing
  matches. Brand identification (`identifyBrand`) is regex/substring
  matching on that same fake string, not any queried device response.
- `scanUSBPrinters()` (`PrinterDriverFactory.ts:396-398`) **always returns an
  empty array** — no `usb`/`node-usb`/HID enumeration exists anywhere in the
  dependency tree (`queue-core`'s only deps are `zod` and
  `@makanmasak/shared-types` — confirmed via `package.json`; no `usb`,
  `serialport`, `escpos`, or `node-hid` packages anywhere in the repo).
- `scanNetworkPrinters()` (`PrinterDriverFactory.ts:400-430`) iterates a
  fixed set of subnets (`192.168.1.`, `192.168.0.`, `10.0.0.`) and host
  suffixes `100`–`110` on port `9100`, calling the same string-matching
  `detectPrinter` — it never opens a TCP socket to test reachability, so
  in practice `scanNetworkPrinters` returns nothing (the fake address
  strings like `192.168.1.105:9100` never match `"epson"`/`"tm-"`/etc.,
  and no real network probe replaces that check).
- `scanSerialPrinters()` (`PrinterDriverFactory.ts:432-453`) checks fixed
  path candidates (`/dev/ttyUSB0`, `/dev/ttyUSB1`, `COM1`, `COM2`) — again
  no filesystem/serial-port existence check, purely string matching.
- **Net effect**: `AUTO_DISCOVERY`/`/api/v1/discover` will essentially never
  find a real device in production as written; `POST /api/v1/devices` with
  an explicit `address` containing a brand hint (e.g. `"...epson..."`) is
  the only path that produces a registered (fake) device today. Any printer
  that does get "registered" is not actually connected to anything — jobs
  routed to it appear to succeed after a fake delay.

### 4.5 Job queue / retry — **the executor is never wired up**

`PrintJobManager` (`packages/queue-core/src/print/services/PrintJobManager.ts`)
implements a real in-memory FIFO/priority queue: `createJob` enqueues,
a `setInterval(processNextJobs, 1000)` polls for pending jobs up to
`maxConcurrentJobs` concurrently, `processJob` marks `printing` → calls
`executePrintJob(job)` → on success marks `completed`, on failure applies
retry policy (`job.attempts < job.maxAttempts` → re-queue after
`retryDelay` ms, else mark `failed`). Priority ordering
(`urgent > high > normal > low`, tie-broken by creation time) and per-device
pause/resume (on device offline/online) are implemented.

However: `executePrintJob` is a **placeholder that always throws** —
"`executePrintJob method must be implemented by PrinterService for job
${job.id}`" (`PrintJobManager.ts:333-339`) — and is meant to be replaced via
`setJobExecutor(executor)` (`PrintJobManager.ts:467-470`). **`grep` across
the entire `queue-core` package confirms `setJobExecutor` is never called
anywhere** — `PrinterService` (the only consumer of `PrintJobManager`)
constructs it in its constructor
(`PrinterService.ts:39`) but never injects an executor. **Every job created
through the normal `print()` path will be picked up by the 1-second
processing loop, immediately throw, and — because `attempts(1) <
maxAttempts(3)` by default — be silently rescheduled as `pending` after
`retryDelay` (5s), looping through `pending → printing → (throw) → pending`
forever until max attempts, then finally land in `failed`.** This means the
job lifecycle as shipped never actually reaches the drivers'
`print()` methods at all (those are only invoked directly by
`EpsonDriver`/etc. if some other code path called `driver.print()`
directly, which nothing in this app does). Confirm/fix this wiring gap
before treating the current TS behavior as a spec for the Rust rewrite —
it is very likely a genuine bug, not intended behavior, but the rewrite
should preserve retry/priority/pause semantics regardless of whether the
executor gap gets fixed first.

### 4.6 Health / statistics

- `PrinterHealthMonitor` (`.../utils/PrinterHealthMonitor.ts`) is a simple
  in-memory map of `deviceId → {status, lastSeen, errorCount,
  averageResponseTime}` with event emission on update; it is driven only by
  explicit `updateHealth()` calls from `PrinterService.registerPrinter`
  (sets `"online"` right after driver `connect()` — which, per §4.4, always
  "succeeds") — there is no periodic re-poll of actual device health.
- `PrintStatisticsCollector` (`.../utils/PrintStatisticsCollector.ts`) keeps
  an in-memory array of per-job metrics (duration, success/failure) and
  derives aggregate stats (totalJobs, successfulJobs, failedJobs,
  averagePrintTime, errorRate); `deviceUptime` and `busyHours` in the
  shared-types `PrintStatistics` shape are explicitly `// TODO` and always
  return `0`/`[]` (`PrinterService.ts:295-309`).
- Agent-level `/api/v1/health` status semantics (documented explicitly in
  code comments, `PrintAgentService.ts:274-286`): `unhealthy` only if the
  service failed to initialize; `degraded` if initialized but zero
  registered devices or zero online devices (this will be the **default
  state** given §4.4); otherwise defers to `queue-core`'s own
  healthy/degraded/unhealthy assessment.

## 5. State & persistence

**Nothing in this app persists to disk or a database.** All state is
in-process:

- `PrintJobManager.jobs` — `Map<string, PrintJob>`, cleared on `shutdown()`.
  A `cleanupCompletedJobs(olderThanHours=24)` method exists to prune old
  completed/cancelled jobs but is **never called automatically** (no
  scheduled invocation found anywhere) — it would need to be called
  externally via some future maintenance route.
- `PrinterService.drivers` — `Map<string, PrinterDriver>` of in-memory
  driver instances (cleared on shutdown, each `disconnect()`ed first).
- `PrinterHealthMonitor.healthData`, `PrintStatisticsCollector.metrics`/
  `statistics` — plain in-memory maps/arrays, cleared on shutdown.
- `LocalPrintService.connectedClients` — `Set<WebSocket>`, cleared when
  servers stop.
- **Nothing survives a process restart.** Registered devices, queued jobs,
  health history, and statistics are all lost on restart; the agent starts
  from a completely empty state every time (auto-discovery, if it ever
  finds anything per §4.4, is the only way devices repopulate).
- `@makanmasak/database` is listed as a dependency in
  `apps/print-agent/package.json:18` but **is not imported or used anywhere**
  in `apps/print-agent/src/**` — confirmed by reading every non-test source
  file; this appears to be a vestigial/future dependency, not a live one.
- Configuration itself comes only from environment variables/`.env` file
  (loaded once via `dotenv` at startup, `src/index.ts:14`) — no config
  file store, no KV, no D1.

## 6. Rust rewrite notes

This app is explicitly called out by the user's instructions as the most
natural Rust target — a native binary with direct hardware access — and
the code confirms that framing, but with an important caveat: **there is
currently no real hardware I/O to port**. The Rust rewrite is not a
transliteration of an existing driver layer; it is a from-scratch
implementation of the driver layer, guided by the (currently unused)
ESC/POS command-encoding logic and the shape of the existing HTTP/WS
contract.

### Node dependencies and their Rust equivalents

| Node dependency | Role here | Rust equivalent |
| --- | --- | --- |
| `express` (`apps/print-agent/package.json:23`) | HTTP routing, JSON body parsing, CORS, custom auth middleware | `axum` or `actix-web`; `tower-http::cors::CorsLayer` for CORS |
| `ws` (`package.json:24`) | WebSocket server on a second port, with `verifyClient`-style auth-at-handshake | `tokio-tungstenite`, or `axum`'s built-in WS upgrade (lets you share one Tokio runtime/port story with the HTTP server, unlike today's two-port split) |
| `cors` | CORS middleware | `tower-http::cors` |
| `dotenv` | `.env` loading | `dotenvy` |
| `zod` (used only for config validation, `src/config/validation.ts`) | Config schema validation | `serde` + `validator`, or hand-rolled checks (the validation here is small: port ranges, min string lengths, a couple of cross-field checks) |
| — (no `usb`/`serialport`/`escpos-*` package exists today) | N/A — discovery/connect/print are all simulated (§4.4) | This is where the actual net-new Rust work is: `rusb` (libusb bindings) or `nusb` for USB printers; `serialport-rs` for serial/COM ports; plain `tokio::net::TcpStream` to port 9100 for network (JetDirect/RAW) printers, which is by far the most common real-world thermal-printer transport and the simplest to implement correctly first |
| `tsx` / `node dist/index.js` (dev/prod run) | Process entry | Plain native binary; no bundler/transpiler step needed |

No Node ESC/POS driver library (e.g. `escpos`, `node-thermal-printer`) is
used anywhere in this codebase — the command-byte generation
(`ESCPOSCommands`/`CommandBuilder`) is hand-rolled TypeScript. A Rust port
can either hand-roll the same byte sequences (recommended — they're simple
and already enumerated in `packages/queue-core/src/print/commands/ESCPOSCommands.ts`,
easy to unit-test 1:1 against the existing `.test.ts` file) or adopt a crate
like `escpos-rs` if its command coverage matches; either way, treat
`ESCPOSCommands.ts`/`CommandBuilder.ts` as the executable spec for the byte
sequences to reproduce, since it is the one layer of this system that is
real and tested today.

### Cross-platform concerns

- Real implementations will need to branch per OS: USB via `rusb`/`nusb`
  works cross-platform but needs udev rules on Linux and driver signing
  concerns on Windows for raw USB access; serial ports differ in naming
  (`/dev/ttyUSB*`/`/dev/ttyACM*` on Linux, `/dev/cu.*` on macOS, `COM*` on
  Windows) — the current TS code's hardcoded candidate list
  (`PrinterDriverFactory.ts:433`) hints at this but doesn't actually probe
  either.
- Network (port 9100 JetDirect) printers are the simplest cross-platform
  starting point and should likely be the first real transport implemented
  in Rust, since USB/serial require platform-specific permission handling
  restaurants' local machines may not have configured.
- The existing subnet-sweep approach to discovery
  (`scanNetworkPrinters`, hardcoded `/24`-ish ranges + a small host range)
  is a weak substitute for real discovery; consider mDNS/SSDP or an
  explicit-IP-entry UI instead of porting the sweep as-is.

### Wire contract that MUST be preserved

Whatever the Rust binary looks like internally, these are the parts other
systems may depend on and should be treated as a stable interface unless a
coordinated client-side change ships too:

1. **Ports**: HTTP on `PRINT_AGENT_PORT` (default 3003), WS on
   `PRINT_AGENT_WS_PORT` (default 3004), both loopback-only.
2. **Auth**: `x-api-key` header, exact string match against
   `PRINT_AGENT_API_KEY`, required on every HTTP route and at the WS
   handshake. No token expiry/rotation logic exists to replicate — it's a
   single static shared secret.
3. **HTTP routes and response envelope** exactly as listed in §2 — path,
   method, `{success, data|error}` shape, and the specific `error.code`
   strings (`VALIDATION_ERROR`, `NO_PRINTER_AVAILABLE`, `JOB_NOT_FOUND`,
   `DEVICE_NOT_FOUND`, `DEVICE_NOT_DETECTED`, etc.) — a caller may be
   matching on these strings.
4. **HTTP status mapping**: 400 for validation errors, 503 for
   "no printer available" / degraded health, 401 for bad API key, 404 for
   missing job/device, 500 as the generic catch-all, 200 otherwise — see
   `httpStatusForPrintResult` and the `/health` handler's 503-on-unhealthy
   logic.
5. **WS message shapes**: `{type:"welcome", data:{service, restaurantId,
   timestamp}}` on connect; `{type:"pong", timestamp}` reply to
   `{type:"ping"}`; `{type:"event", event:PrinterEvent}` broadcasts for
   `device_connected`/`device_disconnected`/`job_completed`/`job_failed`.
   `PrinterEvent` shape is `{type, timestamp, deviceId?, jobId?, data?,
   message?}` (`packages/shared-types/src/printer.ts:492-499`).
6. **`PrintRequest`/`PrintResponse`/`PrinterDevice`/`PrintJob` shapes** —
   defined in `packages/shared-types/src/printer.ts` and shared with
   whatever produces `PrintRequest` payloads today (presumably
   `apps/api` or `apps/admin-dashboard`, outside this app's scope). These
   type definitions, not this app's internal classes, are the actual
   cross-service contract and should be the Rust port's `serde` struct
   source of truth (mirror field names/optionality exactly, including the
   `Date` fields which arrive as ISO strings over JSON).
7. **Region/receipt formatting semantics** (TW/MY/VN tax rates and labels,
   currency symbol placement, payment-method translation strings, legal
   notice text) in `packages/queue-core/src/print/formatters/RegionFormatters.ts`
   and `ReceiptFormatterFactory.ts` — these encode real business/legal
   requirements (Taiwan 統一編號, government e-invoice flag, etc.) and must
   be preserved even though the hardcoded receipt QR domain
   (`makanmakan.com/receipt/...`) looks like it should probably become
   config-driven in the rewrite rather than copied verbatim.

### Known bugs/gaps to resolve (not silently replicate) during the rewrite

- The job executor is never wired to the drivers (§4.5) — every print job
  as shipped today loops through retries and then fails; this is very
  likely unintentional. Decide explicitly whether the Rust rewrite fixes
  this (recommended) rather than treating "always fails after retries" as
  the target behavior.
- Discovery/connect/print for all three brand drivers are hardware-free
  simulations (§4.4) — the Rust rewrite is the natural place to implement
  real transports; there is no working TS baseline to diff against for
  correctness, only the ESC/POS byte-encoding layer.
- `registerWithCloud()`/`sendHeartbeat()` are TODO stubs — if the product
  intent is for local agents to report status to the cloud API, that
  integration doesn't exist yet in either language and needs a design
  decision (poll vs. push, auth scheme, retry/backoff) before porting.
- `@makanmasak/database` is an unused dependency in this app's
  `package.json` — drop it rather than pulling in a D1/Drizzle equivalent
  for the Rust build unless a real use is identified.
- Receipt "templates" (`ReceiptTemplate`/`TemplateLayout`) are modeled but
  not actually consulted by the ESC/POS builder (§4.3) — decide whether the
  Rust rewrite makes templates real (driving actual layout) or removes the
  unused abstraction.
