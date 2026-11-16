import type { Dependency } from '@shared/contract'

export const STACK_FORMATS = [
	'auto',
	'package.json',
	'requirements.txt',
	'pyproject.toml',
	'Cargo.toml',
	'go.mod',
	'Gemfile',
	'lines',
] as const

export type StackFormat = (typeof STACK_FORMATS)[number]
type Ecosystem = Dependency['ecosystem']

const ECOSYSTEMS: readonly Ecosystem[] = ['npm', 'pypi', 'cargo', 'go', 'rubygems', 'other']
const MAX_DEPENDENCIES = 500
const MAX_NAME = 214

export type StackResult = { ok: true; dependencies: Dependency[] } | { ok: false; error: string }

export function detectFormat(text: string): Exclude<StackFormat, 'auto'> {
	const trimmed = text.trim()
	if (trimmed.startsWith('{')) return 'package.json'
	if (/^module\s+\S+/m.test(trimmed)) return 'go.mod'
	if (/^\s*gem\s+['"]/m.test(trimmed)) return 'Gemfile'
	if (/^\[(project|tool\.poetry|dependency-groups)[\].]/m.test(trimmed)) return 'pyproject.toml'
	if (/^\[(package|workspace|(dev-|build-)?dependencies)[\].]/m.test(trimmed)) return 'Cargo.toml'
	if (
		/^\s*(-[re]\s|[A-Za-z0-9][A-Za-z0-9._-]*\s*(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<))/m.test(trimmed)
	) {
		return 'requirements.txt'
	}
	return 'lines'
}

function normalizePython(name: string): string {
	return name.toLowerCase().replace(/[-_.]+/g, '-')
}

function pep508Name(requirement: string): string | null {
	const match = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(requirement)
	return match?.[1] ? normalizePython(match[1]) : null
}

function parsePackageJson(text: string): string[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch {
		throw new Error('That package.json is not valid JSON.')
	}
	if (typeof parsed !== 'object' || parsed === null) {
		throw new Error('That package.json is not an object.')
	}
	const manifest = parsed as Record<string, unknown>
	const names: string[] = []
	for (const field of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies',
	]) {
		const block = manifest[field]
		if (typeof block === 'object' && block !== null) names.push(...Object.keys(block))
	}
	return names
}

function parseRequirements(text: string): string[] {
	return text.split('\n').flatMap((raw) => {
		const line = raw.replace(/(^|\s)#.*$/, '').trim()
		if (!line || line.startsWith('-') || line.includes('://')) return []
		const name = pep508Name(line)
		return name ? [name] : []
	})
}

interface TomlSection {
	name: string
	lines: string[]
}

function tomlSections(text: string): TomlSection[] {
	const sections: TomlSection[] = [{ name: '', lines: [] }]
	for (const raw of text.split('\n')) {
		const line = raw.replace(/\s#.*$/, '').trim()
		if (!line || line.startsWith('#')) continue
		const header = /^\[\[?([^\]]+)\]\]?$/.exec(line)
		if (header?.[1]) sections.push({ name: header[1].trim().replace(/["']/g, ''), lines: [] })
		else sections.at(-1)?.lines.push(line)
	}
	return sections
}

function tomlKey(line: string): string | null {
	const match = /^["']?([A-Za-z0-9_.@/-]+)["']?\s*=/.exec(line)
	return match?.[1] ?? null
}

function tomlStrings(text: string): string[] {
	return [...text.matchAll(/"([^"]*)"|'([^']*)'/g)].map((match) => match[1] ?? match[2] ?? '')
}

function tomlArrays(lines: string[]): Map<string, string[]> {
	const arrays = new Map<string, string[]>()
	let key: string | null = null
	let buffer = ''
	for (const line of lines) {
		if (key === null) {
			const start = /^["']?([A-Za-z0-9_.-]+)["']?\s*=\s*\[(.*)$/.exec(line)
			if (!start?.[1]) continue
			key = start[1]
			buffer = start[2] ?? ''
		} else {
			buffer += ` ${line}`
		}
		if (/\]\s*,?$/.test(buffer)) {
			arrays.set(key, tomlStrings(buffer))
			key = null
			buffer = ''
		}
	}
	return arrays
}

function parsePyproject(text: string): string[] {
	const names: string[] = []
	for (const section of tomlSections(text)) {
		if (section.name === 'project') {
			names.push(...(tomlArrays(section.lines).get('dependencies') ?? []))
		} else if (
			section.name === 'project.optional-dependencies' ||
			section.name === 'dependency-groups'
		) {
			for (const values of tomlArrays(section.lines).values()) names.push(...values)
		} else if (
			/^tool\.poetry\.(dev-dependencies|dependencies|group\.[^.]+\.dependencies)$/.test(
				section.name
			)
		) {
			for (const line of section.lines) {
				const key = tomlKey(line)
				if (key && key !== 'python') names.push(key)
			}
		}
	}
	return names.flatMap((requirement) => {
		const name = pep508Name(requirement)
		return name ? [name] : []
	})
}

const CARGO_TABLE = /^(?:workspace\.|target\..+\.)?(?:dev-|build-)?dependencies$/
const CARGO_SINGLE = /^(?:workspace\.|target\..+\.)?(?:dev-|build-)?dependencies\.(.+)$/

function parseCargo(text: string): string[] {
	const names: string[] = []
	for (const section of tomlSections(text)) {
		if (CARGO_TABLE.test(section.name)) {
			for (const line of section.lines) {
				const key = tomlKey(line)
				if (!key) continue
				const renamed = /package\s*=\s*["']([^"']+)["']/.exec(line)?.[1]
				names.push(renamed ?? key)
			}
			continue
		}
		const single = CARGO_SINGLE.exec(section.name)?.[1]
		if (single) {
			const renamed = section.lines
				.map((line) => /^package\s*=\s*["']([^"']+)["']/.exec(line)?.[1])
				.find(Boolean)
			names.push(renamed ?? single)
		}
	}
	return names
}

function parseGoMod(text: string): string[] {
	const names: string[] = []
	let inBlock = false
	for (const raw of text.split('\n')) {
		const indirect = /\/\/\s*indirect/.test(raw)
		const line = raw.replace(/\/\/.*$/, '').trim()
		if (inBlock) {
			if (line === ')') inBlock = false
			else if (line && !indirect) names.push(line.split(/\s+/)[0] ?? '')
			continue
		}
		if (/^require\s*\($/.test(line)) {
			inBlock = true
			continue
		}
		const single = /^require\s+(\S+)\s+\S+/.exec(line)
		if (single?.[1] && !indirect) names.push(single[1])
	}
	return names
}

function parseGemfile(text: string): string[] {
	return text.split('\n').flatMap((line) => {
		const match = /^\s*gem\s+['"]([^'"]+)['"]/.exec(line)
		return match?.[1] ? [match[1]] : []
	})
}

function parseLines(text: string): Dependency[] {
	return text.split('\n').flatMap((raw) => {
		const line = raw.replace(/(^|\s)#.*$/, '').trim()
		if (!line) return []
		const prefixed = /^([a-z]+):(.+)$/.exec(line)
		const ecosystem = prefixed?.[1] as Ecosystem | undefined
		if (prefixed?.[2] && ecosystem && ECOSYSTEMS.includes(ecosystem)) {
			return [{ name: prefixed[2].trim(), ecosystem }]
		}
		return [{ name: line, ecosystem: 'other' as const }]
	})
}

const FORMAT_ECOSYSTEM: Record<Exclude<StackFormat, 'auto' | 'lines'>, Ecosystem> = {
	'package.json': 'npm',
	'requirements.txt': 'pypi',
	'pyproject.toml': 'pypi',
	'Cargo.toml': 'cargo',
	'go.mod': 'go',
	Gemfile: 'rubygems',
}

const FORMAT_PARSER: Record<Exclude<StackFormat, 'auto' | 'lines'>, (text: string) => string[]> = {
	'package.json': parsePackageJson,
	'requirements.txt': parseRequirements,
	'pyproject.toml': parsePyproject,
	'Cargo.toml': parseCargo,
	'go.mod': parseGoMod,
	Gemfile: parseGemfile,
}

export function dedupeDependencies(dependencies: Dependency[]): Dependency[] {
	const seen = new Set<string>()
	return dependencies.filter((dependency) => {
		const key = `${dependency.ecosystem}:${dependency.name}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

export function parseStack(text: string, format: StackFormat = 'auto'): StackResult {
	if (!text.trim()) return { ok: true, dependencies: [] }
	const resolved = format === 'auto' ? detectFormat(text) : format
	let dependencies: Dependency[]
	try {
		dependencies =
			resolved === 'lines'
				? parseLines(text)
				: FORMAT_PARSER[resolved](text).map((name) => ({
						name,
						ecosystem: FORMAT_ECOSYSTEM[resolved],
					}))
	} catch (error) {
		if (error instanceof Error) return { ok: false, error: error.message }
		throw error
	}
	const cleaned = dedupeDependencies(
		dependencies
			.map((dependency) => ({ ...dependency, name: dependency.name.trim() }))
			.filter((dependency) => dependency.name.length > 0)
	)
	const tooLong = cleaned.find((dependency) => dependency.name.length > MAX_NAME)
	if (tooLong) return { ok: false, error: `Package name too long: ${tooLong.name.slice(0, 40)}...` }
	if (cleaned.length > MAX_DEPENDENCIES) {
		return { ok: false, error: `At most ${MAX_DEPENDENCIES} packages, found ${cleaned.length}.` }
	}
	return { ok: true, dependencies: cleaned }
}

export function stackToLines(dependencies: Dependency[]): string {
	return dependencies.map((dependency) => `${dependency.ecosystem}:${dependency.name}`).join('\n')
}
