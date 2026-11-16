import { spawn } from 'node:child_process'

export type ProcessResult = { code: number | null; stdout: string; stderr: string }

export function runProcess(command: string, args: string[]): Promise<ProcessResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString()
		})
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString()
		})
		child.on('error', reject)
		child.on('close', (code) => resolve({ code, stdout, stderr }))
	})
}

export async function ffmpeg(args: string[]): Promise<void> {
	const result = await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
	if (result.code !== 0) throw new Error(`ffmpeg failed: ${result.stderr.trim().slice(-500)}`)
}

export async function probeDurationSeconds(file: string): Promise<number> {
	const result = await runProcess('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'csv=p=0',
		file,
	])
	const duration = Number.parseFloat(result.stdout)
	if (result.code !== 0 || !(duration > 0))
		throw new Error(`ffprobe could not read the duration of ${file}`)
	return Math.round(duration * 10) / 10
}
