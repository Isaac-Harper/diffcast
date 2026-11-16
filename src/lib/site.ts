export const SITE_NAME = 'Diffcast'
export const SITE_TAGLINE = 'What changed in your corner of tech since yesterday.'
export const SITE_DESCRIPTION =
	'A private daily tech and AI news podcast for developers, tuned to your interests and your stack. About ten minutes each weekday, and every segment cites its sources.'
export const SITE_URL = process.env['VERCEL_PROJECT_PRODUCTION_URL']
	? `https://${process.env['VERCEL_PROJECT_PRODUCTION_URL']}`
	: 'http://localhost:3000'
