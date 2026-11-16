import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function episodeDirectory(workDirectory: string, listenerId: number, date: string): string {
	return join(workDirectory, String(listenerId), date)
}

export async function ensureDirectory(path: string): Promise<void> {
	await mkdir(path, { recursive: true })
}

export function fileExists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false
	)
}

export async function readJsonFile(path: string): Promise<unknown> {
	if (!(await fileExists(path))) throw new Error(`missing ${path}`)
	return JSON.parse(await readFile(path, 'utf8'))
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
