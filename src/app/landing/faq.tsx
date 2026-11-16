import {
	Accordion,
	AccordionHeader,
	AccordionItem,
	AccordionPanel,
	AccordionTrigger,
} from '@ui-sdk/react/accordion'
import { CONTAINER } from '../components/site-chrome'

const QUESTIONS = [
	{
		id: 'sources',
		question: 'Where does the news come from?',
		answer:
			'Public sources: reporting, announcements, release notes, changelogs and security advisories. Every segment lists the sources it was built from in the show notes, so you can check anything you hear.',
	},
	{
		id: 'take',
		question: 'What is a take?',
		answer:
			'A sentence on where you stand on a topic. It tells the show what you already believe, and now and then the hosts argue the other side as well as they can. Takes are optional.',
	},
	{
		id: 'stack',
		question: 'Do I have to share my stack?',
		answer:
			'No. Your interests alone make an episode. A stack adds one segment on days something real changed in your packages. You can paste a package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod or Gemfile, or a plain list.',
	},
	{
		id: 'hosts',
		question: 'Are Mara and Theo real people?',
		answer:
			'No. They are synthetic voices reading a script written from the day’s sources. A script can still get something wrong, which is why each segment links what it was built from.',
	},
	{
		id: 'days',
		question: 'Do I get an episode every day?',
		answer:
			'By default, yes, all seven. Weekdays are the daily news, Saturday recaps the week in your corner of tech and Sunday is a short look at the week ahead. Turn off any day you do not want. After a day off, the next episode covers everything since your last one.',
	},
	{
		id: 'quiet',
		question: 'What happens on a slow news day?',
		answer:
			'You get a shorter episode. Diffcast does not invent stories or stretch thin ones to fill ten minutes.',
	},
	{
		id: 'apps',
		question: 'Which podcast apps work?',
		answer:
			'Any app that can follow a show by its feed URL. We have written setup steps for Apple Podcasts and Overcast.',
	},
	{
		id: 'agent',
		question: 'How does the agent connection work?',
		answer:
			'Diffcast runs a remote MCP server at diffcast.fm/api/mcp. Add that URL to Claude Code, Cursor or claude.ai and approve it once in your browser. Your agent can then save what you are working on (a project alias, its packages and topics, kept 30 days), read and change your interests and days, and read your episodes. Project names are never spoken. Disconnect it any time from your account. Setup steps are on diffcast.fm/agents.',
	},
	{
		id: 'cancel',
		question: 'How do I cancel?',
		answer:
			'Sign in, open your account and choose Manage billing. Cancel there in a couple of clicks. Episodes keep coming until the end of the month you paid for, and nothing is charged after that.',
	},
	{
		id: 'refund',
		question: 'Can I get a refund?',
		answer:
			'Yes, within 7 days of your first charge. Reply to any Diffcast email or write to hello@diffcast.fm and we will refund it.',
	},
] as const

export function Faq() {
	return (
		<section id="faq" className="border-t border-line">
			<div className={`${CONTAINER} py-16 sm:py-24`}>
				<div className="max-w-3xl">
					<h2 className="text-title font-semibold text-balance">Questions</h2>
					<Accordion aria-label="Questions" className="mt-8">
						{QUESTIONS.map((item) => (
							<AccordionItem key={item.id} value={item.id}>
								<AccordionHeader>
									<AccordionTrigger>{item.question}</AccordionTrigger>
								</AccordionHeader>
								<AccordionPanel>
									<p className="max-w-[62ch] pb-5 text-pretty">{item.answer}</p>
								</AccordionPanel>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</section>
	)
}
