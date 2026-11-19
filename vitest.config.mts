import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	oxc: { jsx: { runtime: 'automatic' } },
	test: {
		include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
		setupFiles: ['./src/test/setup.ts'],
		css: false,
	},
})
