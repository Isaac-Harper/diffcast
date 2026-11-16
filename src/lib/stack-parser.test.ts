import { describe, expect, it } from 'vitest'
import { detectFormat, parseStack, stackToLines } from './stack-parser'

function names(text: string, format?: Parameters<typeof parseStack>[1]) {
	const result = parseStack(text, format)
	if (!result.ok) throw new Error(result.error)
	return result.dependencies
}

describe('stack parser', () => {
	it('reads every dependency block of a package.json, deduped', () => {
		const text = JSON.stringify({
			name: 'app',
			dependencies: { next: '16', react: '19' },
			devDependencies: { vitest: '5', react: '19' },
			peerDependencies: { '@types/react': '19' },
		})
		expect(detectFormat(text)).toBe('package.json')
		expect(names(text)).toEqual([
			{ name: 'next', ecosystem: 'npm' },
			{ name: 'react', ecosystem: 'npm' },
			{ name: 'vitest', ecosystem: 'npm' },
			{ name: '@types/react', ecosystem: 'npm' },
		])
		expect(parseStack('{ not json', 'package.json').ok).toBe(false)
	})

	it('reads requirements.txt', () => {
		const text = [
			'# web',
			'Django>=5.0',
			'requests[socks]==2.32.0 ; python_version > "3.8"',
			'-r dev.txt',
			'-e git+https://github.com/x/y.git#egg=y',
			'Flask_SQLAlchemy~=3.1  # orm',
			'django',
		].join('\n')
		expect(detectFormat(text)).toBe('requirements.txt')
		expect(names(text)).toEqual([
			{ name: 'django', ecosystem: 'pypi' },
			{ name: 'requests', ecosystem: 'pypi' },
			{ name: 'flask-sqlalchemy', ecosystem: 'pypi' },
		])
	})

	it('reads pyproject.toml in PEP 621 and Poetry forms', () => {
		const pep = [
			'[project]',
			'name = "svc"',
			'dependencies = [',
			'  "fastapi>=0.110",',
			'  "pydantic[email]",',
			']',
			'',
			'[project.optional-dependencies]',
			'test = ["pytest", "httpx"]',
			'',
			'[dependency-groups]',
			'dev = ["ruff"]',
		].join('\n')
		expect(detectFormat(pep)).toBe('pyproject.toml')
		expect(names(pep).map((dependency) => dependency.name)).toEqual([
			'fastapi',
			'pydantic',
			'pytest',
			'httpx',
			'ruff',
		])
		const poetry = [
			'[tool.poetry.dependencies]',
			'python = "^3.12"',
			'requests = "^2.32"',
			'',
			'[tool.poetry.group.dev.dependencies]',
			'black = { version = "^24" }',
		].join('\n')
		expect(names(poetry).map((dependency) => dependency.name)).toEqual(['requests', 'black'])
	})

	it('reads Cargo.toml tables, renames and dev and build dependencies', () => {
		const text = [
			'[package]',
			'name = "tool"',
			'',
			'[dependencies]',
			'serde = { version = "1", features = ["derive"] }',
			'tokio = "1"',
			'json = { package = "serde_json", version = "1" }',
			'',
			'[dev-dependencies]',
			'insta = "1"',
			'',
			'[build-dependencies.cc]',
			'version = "1"',
			'',
			"[target.'cfg(unix)'.dependencies]",
			'libc = "0.2"',
		].join('\n')
		expect(detectFormat(text)).toBe('Cargo.toml')
		expect(names(text).map((dependency) => dependency.name)).toEqual([
			'serde',
			'tokio',
			'serde_json',
			'insta',
			'cc',
			'libc',
		])
		expect(names(text)[0]?.ecosystem).toBe('cargo')
	})

	it('reads go.mod direct requirements', () => {
		const text = [
			'module example.com/app',
			'',
			'go 1.23',
			'',
			'require github.com/spf13/cobra v1.8.0',
			'',
			'require (',
			'\tgithub.com/jackc/pgx/v5 v5.6.0',
			'\tgolang.org/x/sys v0.20.0 // indirect',
			')',
		].join('\n')
		expect(detectFormat(text)).toBe('go.mod')
		expect(names(text)).toEqual([
			{ name: 'github.com/spf13/cobra', ecosystem: 'go' },
			{ name: 'github.com/jackc/pgx/v5', ecosystem: 'go' },
		])
	})

	it('reads a Gemfile', () => {
		const text = [
			"source 'https://rubygems.org'",
			"gem 'rails', '~> 8.0'",
			'gem "pg"',
			'group :test do',
			"  gem 'rspec-rails'",
			'end',
		].join('\n')
		expect(detectFormat(text)).toBe('Gemfile')
		expect(names(text)).toEqual([
			{ name: 'rails', ecosystem: 'rubygems' },
			{ name: 'pg', ecosystem: 'rubygems' },
			{ name: 'rspec-rails', ecosystem: 'rubygems' },
		])
	})

	it('reads one package per line with optional ecosystem prefixes', () => {
		const text = 'npm:next\npypi:django\npostgres\n\npostgres\n# note'
		expect(detectFormat(text)).toBe('lines')
		const dependencies = names(text)
		expect(dependencies).toEqual([
			{ name: 'next', ecosystem: 'npm' },
			{ name: 'django', ecosystem: 'pypi' },
			{ name: 'postgres', ecosystem: 'other' },
		])
		expect(names(stackToLines(dependencies))).toEqual(dependencies)
	})

	it('accepts empty input and rejects oversize lists', () => {
		expect(names('  ')).toEqual([])
		const many = Array.from({ length: 501 }, (_, index) => `pkg${index}`).join('\n')
		expect(parseStack(many).ok).toBe(false)
	})
})
