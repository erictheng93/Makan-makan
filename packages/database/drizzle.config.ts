import type { Config } from "drizzle-kit";

// `out` names the live platform track, but generating into it is not the
// workflow here — see CLAUDE.md, "Adding New Tables". The snapshot state under
// migrations_fresh/meta/ still describes the pre-squash lineage, so
// `drizzle-kit generate` would diff the schema against a state that has not
// existed since the squash and write the result straight into the track
// wrangler applies to production.
//
// `driver: "d1-http"` and a `dbCredentials` block used to sit here pointing at
// a root `wrangler.toml` that does not exist, in an option shape drizzle-kit
// no longer accepts (0.31 wants `{ accountId, databaseId, token }`, and
// `wranglerConfigPath` appears nowhere in the package). Nothing caught it
// because this file sits outside the typecheck project's include list; it is
// in that list now. Both are gone rather than repaired: `generate` is a pure
// schema→SQL diff that needs neither, and the commands that do need
// credentials need a token, which cannot live in a committed file.
export default {
  schema: "./src/schema/index.ts",
  out: "./migrations_fresh",
  dialect: "sqlite",
  verbose: true,
  strict: true,
} satisfies Config;
