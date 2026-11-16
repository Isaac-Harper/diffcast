import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
			disallow: ['/l/', '/admin', '/login', '/api/', '/account', '/welcome', '/signin', '/oauth/'],
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
	}
}
