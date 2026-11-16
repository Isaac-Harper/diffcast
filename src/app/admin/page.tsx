import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { businessReport } from '@/lib/business'
import { businessCounts } from '@/lib/store/business'
import { BusinessView } from './business-view'

export const metadata: Metadata = { title: 'Business' }

export default async function BusinessPage() {
	await requireSession()
	return <BusinessView report={businessReport(await businessCounts())} />
}
