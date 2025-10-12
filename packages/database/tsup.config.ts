import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  tsconfig: './tsconfig.build.json',
  // Include all source files for proper type generation
  outDir: 'dist',
  // Ensure proper handling of TypeScript composite projects
  skipNodeModulesBundle: true,
  // Enable tree-shaking for better output
  treeshake: true
})
