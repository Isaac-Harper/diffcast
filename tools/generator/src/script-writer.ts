import type { DueListener, EpisodeScript } from '../../../shared/contract.ts'
import type { ResearchUsage } from './pricing.ts'

export type WrittenScript = {
	episode: EpisodeScript
	usages: ResearchUsage[]
	researchSeconds: number
}

export type ReplyRecorder = (attempt: number, reply: string) => Promise<void>

export type ScriptWriter = {
	write(listener: DueListener, recordReply: ReplyRecorder): Promise<WrittenScript>
}
