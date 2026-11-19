import { SITE_URL } from '../site'
import type { EmailMessage } from './mailer'

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
}

type Block = { kind: 'paragraph'; text: string } | { kind: 'link'; label: string; url: string }

function paragraph(text: string): Block {
	return { kind: 'paragraph', text }
}

function link(label: string, url: string): Block {
	return { kind: 'link', label, url }
}

const FOOTER = `Diffcast, ${SITE_URL.replace('https://', '')}. Reply to this email to reach a person.`

function renderText(blocks: Block[]): string {
	const body = blocks
		.map((block) => (block.kind === 'paragraph' ? block.text : `${block.label}:\n${block.url}`))
		.join('\n\n')
	return `${body}\n\n--\n${FOOTER}\n`
}

function renderHtml(heading: string, blocks: Block[]): string {
	const body = blocks
		.map((block) =>
			block.kind === 'paragraph'
				? `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(block.text)}</p>`
				: `<p style="margin:0 0 4px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#5f6368">${escapeHtml(block.label)}</p><p style="margin:0 0 16px;font-family:ui-monospace,Menlo,monospace;font-size:13px;word-break:break-all"><a href="${escapeHtml(block.url)}" style="color:#111">${escapeHtml(block.url)}</a></p>`
		)
		.join('')
	return `<!doctype html><html><body style="margin:0;background:#f6f6f4;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><p style="margin:0 0 24px;font-family:ui-monospace,Menlo,monospace;font-weight:600"><span style="color:#b42318">-</span><span style="color:#067647">+</span> diffcast</p><div style="background:#fff;border:1px solid #e4e4e0;border-radius:10px;padding:24px"><h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>${body}</div><p style="margin:24px 0 0;font-size:12px;color:#5f6368">${escapeHtml(FOOTER)}</p></div></body></html>`
}

function message(to: string, subject: string, heading: string, blocks: Block[]): EmailMessage {
	return { to, subject, text: renderText(blocks), html: renderHtml(heading, blocks) }
}

export function welcomeEmail(input: {
	to: string
	feedUrl: string
	pageUrl: string
	firstEpisode: string
}): EmailMessage {
	return message(input.to, 'Your Diffcast feed is ready', 'Welcome to Diffcast', [
		paragraph(`Your subscription is active. Your first episode: ${input.firstEpisode}.`),
		link('Your private feed URL', input.feedUrl),
		paragraph(
			'Apple Podcasts: open Library, tap the ••• menu, choose Follow a Show by URL and paste the feed URL. Overcast: tap +, choose Add URL and paste it. Any app that follows a show by URL works.'
		),
		link('Your listener page (episodes, feedback, topics)', input.pageUrl),
		paragraph(
			'Your episodes follow the topics you picked. Change them, or add a take you want tested, on your listener page any time before the episode is made.'
		),
		paragraph(
			'Keep both links private: anyone with them can hear your episodes. To change your interests, stack, days or billing later, sign in with this email address:'
		),
		link('Sign in', `${SITE_URL}/signin`),
	])
}

export function signInEmail(input: { to: string; url: string }): EmailMessage {
	return message(input.to, 'Your Diffcast sign in link', 'Sign in to Diffcast', [
		paragraph('Open this link to sign in. It works once and expires in 30 minutes.'),
		link('Sign in', input.url),
		paragraph('If you did not ask for this, ignore this email. Nothing changes.'),
	])
}

export function subscriptionEndedEmail(input: { to: string }): EmailMessage {
	return message(input.to, 'Your Diffcast subscription has ended', 'Your subscription has ended', [
		paragraph(
			'Your Diffcast subscription is no longer active, so new episodes have stopped. Your interests, stack and past episodes are kept.'
		),
		paragraph('To come back, start a new subscription:'),
		link('Start again', `${SITE_URL}/start`),
		paragraph('If this is a mistake, reply to this email and a person will sort it out.'),
	])
}
