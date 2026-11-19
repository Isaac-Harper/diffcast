import { describe, expect, it } from 'vitest'
import { describeNextEpisode, nextEpisode } from './next-episode'

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]
const LA = 'America/Los_Angeles'

describe('next episode', () => {
	it('is tomorrow morning for an evening signup', () => {
		const now = new Date('2026-11-18T20:00:00-08:00')
		const next = nextEpisode(now, LA, EVERY_DAY, null)
		expect(next.date).toBe('2026-11-19')
		expect(next.format).toBe('daily')
		expect(next.readyBy.toISOString()).toBe('2026-11-19T14:00:00.000Z')
		expect(describeNextEpisode(now, next, LA)).toBe(
			'Tomorrow, Thursday, November 19, by 6:00 AM PST (daily news)'
		)
	})

	it('is today when the last generator run of the window is still ahead', () => {
		const now = new Date('2026-11-19T04:30:00-08:00')
		const next = nextEpisode(now, LA, EVERY_DAY, null)
		expect(next.date).toBe('2026-11-19')
		expect(describeNextEpisode(now, next, LA)).toBe(
			'Today, Thursday, November 19, by 6:00 AM PST (daily news)'
		)
	})

	it('skips today once the last run has started or the episode exists', () => {
		const late = new Date('2026-11-19T05:00:00-08:00')
		expect(nextEpisode(late, LA, EVERY_DAY, null).date).toBe('2026-11-20')
		const early = new Date('2026-11-19T01:00:00-08:00')
		expect(nextEpisode(early, LA, EVERY_DAY, '2026-11-19').date).toBe('2026-11-20')
		expect(nextEpisode(early, LA, EVERY_DAY, '2026-11-18').date).toBe('2026-11-19')
	})

	it('waits for the next picked day and names its format', () => {
		const thursdayEvening = new Date('2026-11-19T20:00:00-08:00')
		const weekend = nextEpisode(thursdayEvening, LA, [6, 7], null)
		expect(weekend.date).toBe('2026-11-21')
		expect(weekend.format).toBe('weekly_recap')
		expect(describeNextEpisode(thursdayEvening, weekend, LA)).toBe(
			'Saturday, November 21, by 6:00 AM PST (week in review)'
		)
		const mondayOnly = nextEpisode(new Date('2026-11-23T20:00:00-08:00'), LA, [1], null)
		expect(mondayOnly.date).toBe('2026-11-30')
	})

	it('uses the listener time zone, not the server one', () => {
		const now = new Date('2026-11-18T23:30:00Z')
		const next = nextEpisode(now, 'Asia/Tokyo', EVERY_DAY, null)
		expect(next.date).toBe('2026-11-20')
		expect(next.readyBy.toISOString()).toBe('2026-11-19T21:00:00.000Z')
		expect(describeNextEpisode(now, next, 'Asia/Tokyo')).toBe(
			'Tomorrow, Friday, November 20, by 6:00 AM GMT+9 (daily news)'
		)
	})

	it('refuses an empty schedule', () => {
		expect(() => nextEpisode(new Date(), LA, [], null)).toThrow()
	})
})
