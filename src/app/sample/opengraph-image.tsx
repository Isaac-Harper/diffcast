import { ImageResponse } from 'next/og'
import { ShareCard } from '../brand-image'

export const alt = 'Diffcast: hear a sample episode of the daily tech news podcast for developers.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
	return new ImageResponse(
		<ShareCard
			kicker="sample episode"
			headline="Hear ten minutes of Diffcast."
			subline="A daily tech news podcast made from your interests and your stack."
		/>,
		size
	)
}
