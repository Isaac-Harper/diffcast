import { Resend } from 'resend'
import { FROM_ADDRESS, REPLY_TO } from './mailer'
import type { EmailMessage, Mailer } from './mailer'

export class ResendMailer implements Mailer {
	async send(message: EmailMessage): Promise<void> {
		const key = process.env['RESEND_API_KEY']
		if (!key) throw new Error('RESEND_API_KEY is not set, so no email can be sent')
		const { error } = await new Resend(key).emails.send({
			from: FROM_ADDRESS,
			replyTo: REPLY_TO,
			to: message.to,
			subject: message.subject,
			text: message.text,
			html: message.html,
		})
		if (error) throw new Error(`Resend refused the email: ${error.name}: ${error.message}`)
	}
}

let mailer: Mailer = new ResendMailer()

export function currentMailer(): Mailer {
	return mailer
}

export function replaceMailer(next: Mailer): void {
	mailer = next
}
