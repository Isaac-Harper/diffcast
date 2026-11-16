import { describe, expect, it } from 'vitest'
import type { DueListener, WorkContext } from '../../../shared/contract.ts'
import { buildBrief } from './brief.ts'
import { checkScript } from './script-rules.ts'
import {
	briefWorkContext,
	contextDependency,
	episodeStack,
	mentionedNames,
	privateProjectNames,
} from './work-context.ts'

const CONTEXT: WorkContext[] = [
	{
		project: 'acme/billing-engine',
		packages: ['npm:stripe', 'pypi:fastapi', 'react', 'go:github.com/acme/kit'],
		topics: ['Payments webhooks', 'Postgres row level security'],
		summary: 'Moving billing-engine webhooks to a queue',
		updatedAt: '2026-11-16T09:00:00Z',
	},
	{
		project: 'orbit',
		packages: [],
		topics: [],
		summary: '',
		updatedAt: '2026-11-15T09:00:00Z',
	},
]

function words(count: number): string {
	return Array.from({ length: count }, () => 'word').join(' ')
}

function script(extraTurn: string, title: string = 'Title') {
	return {
		title,
		summary: 'Summary.',
		storyCount: 1,
		segments: [
			{
				heading: 'Heading',
				kind: 'news',
				challenges: null,
				topics: [],
				packages: [],
				sources: [{ title: 'acme/billing-engine on GitHub', url: 'https://example.com' }],
			},
		],
		turns: [
			{ speaker: 'host', text: words(100) },
			{ speaker: 'cohost', text: `${words(95)} ${extraTurn}` },
		],
	}
}

describe('private project names', () => {
	it('uses the full project and a distinctive last segment, never the show name', () => {
		expect(privateProjectNames(CONTEXT)).toEqual(['acme/billing-engine', 'billing-engine', 'orbit'])
		expect(
			privateProjectNames([
				{ ...CONTEXT[1]!, project: 'diffcast' },
				{ ...CONTEXT[1]!, project: 'me/api' },
			])
		).toEqual(['me/api'])
	})

	it('matches whole words, case insensitive', () => {
		const names = privateProjectNames(CONTEXT)
		expect(mentionedNames('Big news for ORBIT today.', names)).toEqual(['orbit'])
		expect(mentionedNames('The orbital launch slipped.', names)).toEqual([])
		expect(mentionedNames('Your Billing-Engine work', names)).toEqual(['billing-engine'])
		expect(mentionedNames('Nothing private here.', names)).toEqual([])
	})

	it('fails a script that names a project anywhere a listener reads or hears it, and passes otherwise', () => {
		const names = privateProjectNames(CONTEXT)
		const spoken = checkScript(script('and that matters for Orbit.'), 3, 'daily', names)
		expect(spoken.ok).toBe(false)
		expect(spoken.ok ? [] : spoken.problems).toEqual([
			expect.stringMatching(/^turns\.1 names one of the listener's private projects/),
		])
		const titled = checkScript(script('word word word', 'Orbit gets faster'), 3, 'daily', names)
		expect(titled.ok ? [] : titled.problems).toEqual([expect.stringMatching(/^title names/)])
		expect(checkScript(script('word word word'), 3, 'daily', names).ok).toBe(true)
		expect(checkScript(script('and that matters for Orbit.'), 3, 'daily').ok).toBe(true)
	})
})

describe('work context in the brief', () => {
	const listener: DueListener = {
		listenerId: 1,
		date: '2026-11-17',
		format: 'daily',
		since: '2026-11-16',
		timezone: 'UTC',
		minutes: 10,
		stack: [{ name: 'react', ecosystem: 'npm' }],
		focus: '',
		interests: [{ topic: 'Security and privacy', take: null, note: null }],
		recent: [],
		feedback: [],
		workContext: CONTEXT,
	}

	it('merges context packages into the stack without duplicates', () => {
		expect(contextDependency('pypi:fastapi')).toEqual({ ecosystem: 'pypi', name: 'fastapi' })
		expect(contextDependency('left-pad')).toEqual({ ecosystem: 'other', name: 'left-pad' })
		expect(episodeStack(listener)).toEqual([
			{ name: 'react', ecosystem: 'npm' },
			{ name: 'stripe', ecosystem: 'npm' },
			{ name: 'fastapi', ecosystem: 'pypi' },
			{ name: 'github.com/acme/kit', ecosystem: 'go' },
		])
	})

	it('labels projects and redacts their names from summaries', () => {
		expect(briefWorkContext(CONTEXT).map((context) => [context.project, context.summary])).toEqual([
			['private project 1', 'Moving a private project webhooks to a queue'],
			['private project 2', ''],
		])
	})

	it('puts topics and packages in the brief as the strongest signal, and no project name', () => {
		const brief = buildBrief(listener)
		expect(brief).toContain('strongest signal')
		expect(brief).toContain('Payments webhooks; Postgres row level security')
		expect(brief).toContain('"name": "fastapi"')
		expect(mentionedNames(brief, privateProjectNames(CONTEXT))).toEqual([])
	})

	it('adds nothing when there is no context', () => {
		expect(buildBrief({ ...listener, workContext: [] })).not.toContain('Work context')
	})
})
