export interface EmailMessage {
	to: string
	subject: string
	text: string
	html: string
}

export interface Mailer {
	send(message: EmailMessage): Promise<void>
}

export const FROM_ADDRESS = 'Diffcast <hello@send.diffcast.fm>'
export const REPLY_TO = 'hello@diffcast.fm'
