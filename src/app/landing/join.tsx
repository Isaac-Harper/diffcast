import { CONTAINER } from '../components/site-chrome'
import { WaitlistForm } from './waitlist-form'

export function Join() {
	return (
		<section id="join" className="border-t border-line bg-sunken">
			<div className={`${CONTAINER} grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16`}>
				<div>
					<h2 className="text-title font-semibold text-balance">Join the prototype.</h2>
					<p className="mt-4 max-w-[44ch] text-lg leading-8 text-pretty text-muted">
						Leave your email and, if you like, what you want to hear about. We will write when a
						spot opens, and for nothing else.
					</p>
				</div>
				<div className="rounded-card border border-line bg-surface p-6 sm:p-8">
					<WaitlistForm />
				</div>
			</div>
		</section>
	)
}
