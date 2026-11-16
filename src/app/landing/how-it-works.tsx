import { CONTAINER } from '../components/site-chrome'

const STEPS = [
	{
		title: 'Tell us what you follow',
		body: 'Pick topics such as AI models and agents, developer tools, startups and security, and add your own. For any of them you can say where you stand.',
		coming: false,
	},
	{
		title: 'Add your stack',
		body: 'Paste a package.json or a list of packages. On days something real changes in it, your episode gets a stack segment. On other days it stays out of the way.',
		coming: false,
	},
	{
		title: 'Listen on the days you pick',
		body: 'Two hosts, Mara and Theo, take about ten minutes. Weekdays are the daily news, Saturday recaps your week and Sunday looks at the week ahead. All seven days are on unless you turn some off. Episodes arrive through a private feed in the podcast app you already use.',
		coming: false,
	},
	{
		title: 'Your agent keeps it current',
		body: 'A remote MCP server will let your coding agent tell Diffcast what you are working on, so your interests follow your work without you editing a list. It is planned, not built.',
		coming: true,
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
							<h3 className="flex flex-wrap items-center gap-3 text-xl font-medium tracking-tight">
								{step.title}
								{step.coming && (
									<span className="rounded-control border border-edge px-2 py-0.5 font-mono text-xs font-normal tracking-normal text-muted">
										coming
									</span>
								)}
							</h3>
							<p className="max-w-[60ch] leading-7 text-pretty text-muted">{step.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	)
}
