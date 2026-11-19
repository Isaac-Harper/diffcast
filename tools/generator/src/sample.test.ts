import { describe, expect, it } from 'vitest'
import { dueResponseSchema } from '../../../shared/contract.ts'
import { readFileSync } from 'node:fs'
import { parseRunOptions } from './arguments.ts'
import { createServices, selectListeners } from './services.ts'

describe('--sample', () => {
	it('stands alone except for --date and --now', () => {
		expect(parseRunOptions(['--sample']).sample).toBe(true)
		expect(parseRunOptions(['--sample', '--date', '2026-11-18']).date).toBe('2026-11-18')
		expect(() => parseRunOptions(['--sample', '--dry-run'])).toThrow('stands alone')
		expect(() => parseRunOptions(['--sample', '--listener', '1'])).toThrow('stands alone')
	})

	it('needs only the gateway key and runs a generic listener with no personal data', async () => {
		const options = parseRunOptions(['--sample', '--date', '2026-11-18'])
		await expect(createServices(options, {})).rejects.toThrow('missing env: AI_GATEWAY_API_KEY')
		const services = await createServices(options, { AI_GATEWAY_API_KEY: 'key' })
		const [listener] = await selectListeners(options, services.jobs, '/unused')
		expect(listener).toMatchObject({
			listenerId: 999999,
			date: '2026-11-18',
			stack: [],
			workContext: [],
			recent: [],
			feedback: [],
		})
		expect(listener?.interests.every((interest) => !interest.take && !interest.note)).toBe(true)
	})

	it('has a valid fixture', () => {
		const text = readFileSync(new URL('../fixtures/sample-due.json', import.meta.url), 'utf8')
		expect(dueResponseSchema.parse(JSON.parse(text)).listeners).toHaveLength(1)
	})
})
