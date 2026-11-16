'use server'

import type { Dependency } from '@shared/contract'
import { refresh } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { feedUrl, hashFeedToken, listenerPageUrl, newFeedToken } from '@/lib/feed-tokens'
import { parseListenerForm, parseTokenLabel, wholeId } from '@/lib/forms'
import { requestOrigin } from '@/lib/http'
import { parseStack, STACK_FORMATS } from '@/lib/stack-parser'
import type { StackFormat } from '@/lib/stack-parser'
import { addFeedToken, revokeFeedToken } from '@/lib/store/feed-tokens'
import {
	addCompedListener,
	listenerExists,
	setListenerActive,
	updateListener,
} from '@/lib/store/listeners'
import { hasInterestsEditor, parseInterestsEditor } from '@/lib/interests-form'
import { saveInterests } from '@/lib/store/interests'

export type SaveResult = { error: string | null }
export type PreviewResult = { ok: true; dependencies: Dependency[] } | { ok: false; error: string }
export type IssueResult =
	| { status: 'idle' }
	| { status: 'error'; message: string }
	| { status: 'issued'; feedUrl: string; pageUrl: string }

export async function saveListener(_previous: SaveResult, form: FormData): Promise<SaveResult> {
	await requireSession()
	const parsed = parseListenerForm(form)
	if (!parsed.ok) return { error: parsed.error }
	const interests = hasInterestsEditor(form) ? parseInterestsEditor(form) : null
	if (interests && !interests.ok) return { error: interests.error }
	const id = wholeId(form.get('id'))
	if (id === null) {
		const created = await addCompedListener(parsed.input)
		if (interests) await saveInterests(created, interests.input)
		redirect(`/admin/listeners/${created}`)
	}
	if (!(await listenerExists(id))) return { error: 'Unknown listener.' }
	await updateListener(id, parsed.input)
	if (interests) await saveInterests(id, interests.input)
	redirect(`/admin/listeners/${id}?saved=1`)
}

export async function previewStack(text: string, format: string): Promise<PreviewResult> {
	await requireSession()
	const resolved = (STACK_FORMATS as readonly string[]).includes(format)
		? (format as StackFormat)
		: 'auto'
	return parseStack(text, resolved)
}

export async function toggleListener(form: FormData): Promise<void> {
	await requireSession()
	const id = wholeId(form.get('id'))
	if (id === null) throw new Error('Missing listener id')
	await setListenerActive(id, form.get('active') === 'true')
	refresh()
}

export async function issueToken(_previous: IssueResult, form: FormData): Promise<IssueResult> {
	await requireSession()
	const id = wholeId(form.get('listenerId'))
	if (id === null || !(await listenerExists(id))) {
		return { status: 'error', message: 'Unknown listener.' }
	}
	const label = parseTokenLabel(form)
	if (!label.ok) return { status: 'error', message: label.error }
	const token = newFeedToken()
	await addFeedToken(id, label.input, hashFeedToken(token))
	const origin = requestOrigin(await headers())
	refresh()
	return {
		status: 'issued',
		feedUrl: feedUrl(origin, token),
		pageUrl: listenerPageUrl(origin, token),
	}
}

export async function revokeToken(form: FormData): Promise<void> {
	await requireSession()
	const id = wholeId(form.get('tokenId'))
	if (id === null) throw new Error('Missing token id')
	await revokeFeedToken(id)
	refresh()
}
