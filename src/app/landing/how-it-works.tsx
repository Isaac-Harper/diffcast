import Link from 'next/link'
import { CONTAINER } from '../components/site-chrome'

const STEPS = [
	{
		title: 'Tell us what you follow',
		body: 'Pick topics such as AI models and agents, developer tools, startups and security, and add your own. For any of them you can say where you stand.',
		link: null,
	},
	{
		title: 'Add your stack',
		body: 'Paste a package.json or a list of packages. On days something real changes in it, your episode gets a stack segment. On other days it stays out of the way.',
		link: null,
	},
	{
		title: 'Listen on the days you pick',
		body: 'Two hosts, Mara and Theo, take about ten minutes. Weekdays are the daily news, Saturday recaps your week and Sunday looks at the week ahead. All seven days are on unless you turn some off. Episodes arrive through a private feed in the podcast app you already use.',
		link: null,
	},
	{
		title: 'Your agent keeps it current',
		body: 'Connect Claude Code, Cursor or claude.ai to Diffcast with one URL. Your agent tells Diffcast which project and packages you are on this week, and can change your interests and days for you. The next morning’s episode follows your work. Project names stay private and are never read out.',
		link: { href: '/agents', label: 'Connect your agent' },
	},
] as const

export function HowItWorks() {
	return (
		<section id="how" className="border-t border-line">
			<div className={`${CONTAINER} py-16 sm:py-24`}>
				<h2 className="max-w-2xl text-title font-semibold text-balance">
					Made from what you follow and what you ship.
				</h2>
				<ol className="mt-10 sm:mt-14">
					{STEPS.map((step) => (
						<li
							key={step.title}
							className="grid gap-x-12 gap-y-2 border-t border-line py-7 md:grid-cols-[1fr_1.6fr]"
						>
							<h3 className="text-xl font-medium tracking-tight">{step.title}</h3>
							<div className="max-w-[60ch] space-y-3">
								<p className="leading-7 text-pretty text-muted">{step.body}</p>
								{step.link && (
									<Link href={step.link.href} className="font-medium">
										{step.link.label}
									</Link>
								)}
							</div>
						</li>
					))}
				</ol>
			</div>
		</section>
	)
}
