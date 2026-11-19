'use client'

import { Analytics } from '@vercel/analytics/next'
import type { BeforeSendEvent } from '@vercel/analytics/next'
import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { EVENTS_PATH, publicAnalyticsUrl } from '@/lib/events'
import type { BrowserEventKind } from '@/lib/events'

export function recordBrowserEvent(kind: BrowserEventKind): void {
	navigator.sendBeacon(EVENTS_PATH, JSON.stringify({ kind }))
}

export function RecordOnView({ kind }: { kind: BrowserEventKind }) {
	useEffect(() => {
		recordBrowserEvent(kind)
	}, [kind])
	return null
}

export function SampleAudio(props: Omit<ComponentProps<'audio'>, 'onPlay'>) {
	const recorded = useRef(false)
	return (
		<audio
			{...props}
			onPlay={() => {
				if (recorded.current) return
				recorded.current = true
				recordBrowserEvent('sample_play')
			}}
		/>
	)
}

function publicOnly(event: BeforeSendEvent): BeforeSendEvent | null {
	const url = publicAnalyticsUrl(event.url)
	return url === null ? null : { ...event, url }
}

export function PublicAnalytics() {
	return <Analytics beforeSend={publicOnly} />
}
