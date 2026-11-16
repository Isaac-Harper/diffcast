import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

class Fragment implements PromiseLike<unknown[]> {
	constructor(
		readonly strings: readonly string[],
		readonly values: readonly unknown[],
		private readonly run: (fragment: Fragment) => Promise<unknown[]>
	) {}

	then<TResult1 = unknown[], TResult2 = never>(
		onFulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
		onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
	): PromiseLike<TResult1 | TResult2> {
		return this.run(this).then(onFulfilled, onRejected)
	}
}

function build(fragment: Fragment, params: unknown[]): string {
	let text = ''
	fragment.strings.forEach((part, index) => {
		text += part
		if (index >= fragment.values.length) return
		const value = fragment.values[index]
		if (value instanceof Fragment) {
			text += build(value, params)
		} else {
			params.push(value)
			text += `$${params.length}`
		}
	})
	return text
}

export async function createTestDatabase() {
	const db = new PGlite()
	const directory = path.join(process.cwd(), 'db', 'migrations')
	for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
		await db.exec(await readFile(path.join(directory, file), 'utf8'))
	}
	const run = async (fragment: Fragment): Promise<unknown[]> => {
		const params: unknown[] = []
		const text = build(fragment, params)
		return (await db.query(text, params)).rows
	}
	function sql(strings: TemplateStringsArray, ...values: unknown[]): Fragment {
		return new Fragment(strings, values, run)
	}
	async function transaction(queries: Fragment[]): Promise<unknown[][]> {
		return db.transaction(async (tx) => {
			const results: unknown[][] = []
			for (const query of queries) {
				const params: unknown[] = []
				results.push((await tx.query(build(query, params), params)).rows)
			}
			return results
		})
	}
	async function query(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
		return (await db.query<Record<string, unknown>>(text, params)).rows
	}
	return { sql, transaction, query }
}
