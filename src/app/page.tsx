import { RecordOnView } from './components/browser-events'
import { SiteFooter, SiteHeader } from './components/site-chrome'
import { Episode } from './landing/episode'
import { Faq } from './landing/faq'
import { Hero } from './landing/hero'
import { HowItWorks } from './landing/how-it-works'
import { Join } from './landing/join'
import { Pricing, PrivacySummary } from './landing/terms'

export default function Home() {
	return (
		<>
			<SiteHeader />
			<main>
				<Hero />
				<HowItWorks />
				<Episode />
				<PrivacySummary />
				<Pricing />
				<Faq />
				<Join />
			</main>
			<SiteFooter />
			<RecordOnView kind="landing_view" />
		</>
	)
}
