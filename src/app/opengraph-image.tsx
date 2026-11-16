import { ImageResponse } from 'next/og'
import { ShareCard } from './brand-image'

export const alt = 'Diffcast: what changed in your corner of tech since yesterday.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
	return new ImageResponse(<ShareCard />, size)
}
