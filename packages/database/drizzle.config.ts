import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'better-sqlite',
  verbose: true,
  strict: true
} satisfies Config