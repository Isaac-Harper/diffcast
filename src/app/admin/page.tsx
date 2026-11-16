import type { Metadata } from 'next'
import { gateReport, gateWindow } from '@/lib/gate'
import { gateListeners, gateChecks } from '@/lib/store/gate'
import { requireSession } from '@/lib/auth'
import { GateView } from './gate-view'

export const metadata: Metadata = { title: 'Gate' }

export default async function GatePage() {
	await requireSession()
	const window = gateWindow()
	if (!window) {
		return (
			<p className="card text-sm text-muted">
				Set DIFFCAST_GATE_START (YYYY-MM-DD) and optionally DIFFCAST_GATE_DAYS to see the Phase 0
				gate.
			</p>
		)
	}
	const [listeners, checks] = await Promise.all([
		gateListeners(window.dates),
		gateChecks(window.dates),
	])
	const today = new Date().toISOString().slice(0, 10)
	const report = gateReport(listeners, checks, window, today)

	return <GateView report={report} />
}
