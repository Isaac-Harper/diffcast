import { describe, expect, it } from 'vitest'
import {
	checkPublicUrl,
	fetchPage,
	isPrivateAddress,
	readableText,
	truncateText,
} from './fetch-page.ts'

const publicResolver = async () => ['93.184.216.34']

describe('checkPublicUrl', () => {
	it('accepts a public https url', async () => {
		await expect(checkPublicUrl('https://example.com/a', publicResolver)).resolves.toBeInstanceOf(
			URL
		)
	})

	it('rejects other protocols and credentials', async () => {
		await expect(checkPublicUrl('ftp://example.com/a', publicResolver)).rejects.toThrow(
			'only http and https'
		)
		await expect(checkPublicUrl('file:///etc/passwd', publicResolver)).rejects.toThrow(
			'only http and https'
		)
		await expect(checkPublicUrl('https://user:pass@example.com', publicResolver)).rejects.toThrow(
			'credentials'
		)
		await expect(checkPublicUrl('not a url', publicResolver)).rejects.toThrow('not a valid url')
	})

	it('rejects loopback and private hosts, literal or resolved', async () => {
		for (const url of [
			'http://localhost:3000',
			'http://127.0.0.1/',
			'http://10.0.0.93/',
			'http://192.168.1.1/',
			'http://169.254.169.254/latest/meta-data',
			'http://[::1]/',
			'http://printer.local/',
		]) {
			await expect(checkPublicUrl(url, publicResolver), url).rejects.toThrow('private host')
		}
		await expect(
			checkPublicUrl('https://intranet.example.com', async () => ['10.1.2.3'])
		).rejects.toThrow('private host')
		await expect(
			checkPublicUrl('https://mixed.example.com', async () => ['93.184.216.34', '::1'])
		).rejects.toThrow('private host')
	})

	it('refuses to fetch a loopback server', async () => {
		await expect(fetchPage('http://127.0.0.1:9/')).rejects.toThrow('private host')
	})
})

describe('isPrivateAddress', () => {
	it('knows private, mapped and public addresses', () => {
		expect(isPrivateAddress('172.16.0.1')).toBe(true)
		expect(isPrivateAddress('100.78.40.61')).toBe(true)
		expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true)
		expect(isPrivateAddress('fd00::1')).toBe(true)
		expect(isPrivateAddress('172.32.0.1')).toBe(false)
		expect(isPrivateAddress('2606:4700::1111')).toBe(false)
	})
})

describe('readableText', () => {
	it('keeps the article and drops scripts and navigation', () => {
		const paragraph = 'The release fixes how nested errors are formatted. '.repeat(20)
		const html = `<html><head><title>Release 4.2</title><script>var tracking = 1</script></head>
			<body><nav>Home Blog Docs</nav><article><h1>Release 4.2</h1><p>${paragraph}</p><p>${paragraph}</p></article></body></html>`
		const page = readableText(html, 'https://example.com/r')
		expect(page.title).toBe('Release 4.2')
		expect(page.text).toContain('nested errors are formatted')
		expect(page.text).not.toContain('tracking')
	})
})

describe('truncateText', () => {
	it('cuts to the limit and says so', () => {
		expect(truncateText('a'.repeat(7000))).toEqual({ text: 'a'.repeat(6000), truncated: true })
		expect(truncateText('short')).toEqual({ text: 'short', truncated: false })
	})
})
