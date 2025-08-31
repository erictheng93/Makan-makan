import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  verbose: true,
  strict: true,
  dbCredentials: {
    wranglerConfigPath: '../../wrangler.toml',
    dbName: 'makanmakan-local'
  }
} satisfies Config