import type { EmailMessage, Mailer } from './mailer'

export class FakeMailer implements Mailer {
	readonly sent: EmailMessage[] = []
	failNext = false

	async send(message: EmailMessage): Promise<void> {
		if (this.failNext) {
			this.failNext = false
			throw new Error('Fake mailer failure')
		}
		this.sent.push(message)
	}
}
