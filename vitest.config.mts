import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	oxc: { jsx: { runtime: 'automatic' } },
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
		setupFiles: ['./src/test/setup.ts'],
		css: false,
	},
})
