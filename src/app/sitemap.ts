import type { MetadataRoute } from 'next'
import { loadSample } from '@/lib/sample'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
	const samplePages: MetadataRoute.Sitemap =
		loadSample() === null
			? []
			: [{ url: `${SITE_URL}/sample`, changeFrequency: 'weekly', priority: 0.8 }]
	return [
		{ url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
		...samplePages,
		{ url: `${SITE_URL}/start`, changeFrequency: 'monthly', priority: 0.8 },
		{ url: `${SITE_URL}/agents`, changeFrequency: 'monthly', priority: 0.5 },
		{ url: `${SITE_URL}/terms`, changeFrequency: 'monthly', priority: 0.3 },
		{ url: `${SITE_URL}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
	]
}
