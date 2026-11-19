import { describe, expect, it } from 'vitest'
import { parseBrowserEvent, publicAnalyticsUrl } from './events'

describe('browser events', () => {
	it('accepts only the kinds a browser may record', () => {
		expect(parseBrowserEvent({ kind: 'landing_view' })).toBe('landing_view')
		expect(parseBrowserEvent({ kind: 'sample_play' })).toBe('sample_play')
		expect(parseBrowserEvent({ kind: 'paid' })).toBeNull()
		expect(parseBrowserEvent({ kind: 'nope' })).toBeNull()
		expect(parseBrowserEvent(null)).toBeNull()
		expect(parseBrowserEvent('landing_view')).toBeNull()
	})
})

describe('analytics urls', () => {
	it('keeps public pages without their query and drops everything private', () => {
		expect(publicAnalyticsUrl('https://diffcast.fm/')).toBe('https://diffcast.fm/')
		expect(publicAnalyticsUrl('https://diffcast.fm/start?canceled=1')).toBe(
			'https://diffcast.fm/start'
		)
		expect(publicAnalyticsUrl('https://diffcast.fm/signin?next=%2Faccount')).toBe(
			'https://diffcast.fm/signin'
		)
		expect(publicAnalyticsUrl(`https://diffcast.fm/l/${'a'.repeat(64)}`)).toBeNull()
		expect(publicAnalyticsUrl('https://diffcast.fm/signin/confirm?token=x')).toBeNull()
		expect(publicAnalyticsUrl('https://diffcast.fm/welcome?session_id=cs_1')).toBeNull()
		expect(publicAnalyticsUrl('https://diffcast.fm/account')).toBeNull()
		expect(publicAnalyticsUrl('https://diffcast.fm/oauth/authorize?client_id=x')).toBeNull()
	})
})
