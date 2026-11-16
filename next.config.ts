import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	/* config options here */
	cacheComponents: true,
	partialPrefetching: true,
	async headers() {
		return [
			{
				source: '/oauth/authorize',
				headers: [
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
					{ key: 'Referrer-Policy', value: 'no-referrer' },
				],
			},
		]
	},
	turbopack: {
		rules: {
			'*.css': {
				loaders: ['@tailwindcss/turbopack'],
				as: '*.css',
			},
		},
	},
}

export default nextConfig
