import type {
	Dependency,
	DueListener,
	EpisodeScript,
	WorkContext,
} from '../../../shared/contract.ts'

const ECOSYSTEMS = ['npm', 'pypi', 'cargo', 'go', 'rubygems'] as const
const SHOW_NAME = 'diffcast'
const MIN_SEGMENT_NAME = 5

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function privateProjectNames(contexts: readonly WorkContext[]): string[] {
	const names = new Set<string>()
	for (const { project } of contexts) {
		const full = project.trim().toLowerCase()
		if (full && full !== SHOW_NAME) names.add(full)
		const last = full.split('/').at(-1) ?? ''
		if (last.length >= MIN_SEGMENT_NAME && last !== SHOW_NAME) names.add(last)
	}
	return [...names]
}

function namePattern(name: string): RegExp {
	return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
}

export function mentionedNames(text: string, names: readonly string[]): string[] {
	return names.filter((name) => namePattern(name).test(text))
}

export function scriptPrivacyProblems(episode: EpisodeScript, names: readonly string[]): string[] {
	if (names.length === 0) return []
	const places: [string, string][] = [
		['title', episode.title],
		['summary', episode.summary],
		...episode.segments.flatMap((segment, index): [string, string][] => [
			[`segments.${index}.heading`, segment.heading],
			[`segments.${index}.challenges`, segment.challenges ?? ''],
		]),
		...episode.turns.map((turn, index): [string, string] => [`turns.${index}`, turn.text]),
	]
	return places.flatMap(([where, text]) =>
		mentionedNames(text, names).map(
			() =>
				`${where} names one of the listener's private projects; never say or write private project names, describe the work generically instead`
		)
	)
}

function redact(text: string, names: readonly string[], label: string): string {
	return names.reduce(
		(current, name) =>
			current.replace(
				new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, 'giu'),
				`$1${label}`
			),
		text
	)
}

export function briefWorkContext(contexts: readonly WorkContext[]) {
	const names = privateProjectNames(contexts)
	return contexts.map((context, index) => {
		const label = `private project ${index + 1}`
		return {
			project: label,
			packages: context.packages,
			topics: context.topics,
			summary: redact(context.summary, names, 'a private project'),
			updatedAt: context.updatedAt,
		}
	})
}

export function contextDependency(value: string): Dependency {
	const prefix = value.split(':', 1)[0] ?? ''
	const ecosystem = (ECOSYSTEMS as readonly string[]).includes(prefix)
		? (prefix as Dependency['ecosystem'])
		: null
	return ecosystem
		? { ecosystem, name: value.slice(prefix.length + 1) }
		: { ecosystem: 'other', name: value }
}

export function episodeStack(listener: Pick<DueListener, 'stack' | 'workContext'>): Dependency[] {
	const seen = new Set(listener.stack.map((dependency) => dependency.name.toLowerCase()))
	const added: Dependency[] = []
	for (const context of listener.workContext) {
		for (const raw of context.packages) {
			const dependency = contextDependency(raw)
			const key = dependency.name.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			added.push(dependency)
		}
	}
	return [...listener.stack, ...added]
}
