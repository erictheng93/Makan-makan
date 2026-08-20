// Per-package worker ceiling, spread into every package's vitest.config.ts.
//
// `turbo run test` starts one vitest per package, and each of those forks its
// own pool of workers, so the number of live node processes is a product:
//
//     (turbo concurrency) x (workers per package)
//
// Neither factor is bounded by default. vitest picks
// `max(availableParallelism() - 1, 1)` workers -- 23 on a 24-core host, 3 on a
// 4-core one -- and turbo's default concurrency is 10. Measured on a 24-core
// host: apps/kitchen-display alone peaked at 26 node processes, so a full
// `turbo run test` reaches ~260 against 16 GB of RAM. Capped at 2 workers the
// same package peaks at 5.
//
// The root vitest.config.ts already sets maxWorkers, but that only governs
// `pnpm exec vitest run` -- the workspace runner CI uses, and the one place a
// single process owns every project. A per-package vitest invocation reads that
// package's own config as its root and never sees the root file, which is why
// the ceiling has to live here and be spread into all of them.
//
// This is only half the fix. scripts/verify.sh caps the other factor with
// --concurrency; the PRODUCT is what has to stay near the core count, and
// issue #202 recorded that bounding turbo's concurrency alone still ran the
// machine out of memory. Do not remove one half on the grounds that the other
// exists.
//
// Raise it for a machine with room to spare: VITEST_MAX_WORKERS=8 pnpm verify:push
export const sharedTestConfig = {
  maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
  minWorkers: 1,
};
