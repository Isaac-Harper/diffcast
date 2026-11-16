const INK = '#111415'
const PAPER = '#eceeef'
const REMOVED = '#f27f74'
const ADDED = '#56c878'

export function BrandMark({ size }: { size: number }) {
	const bar = size * 0.125
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				gap: bar,
				width: size,
				height: size,
				padding: size * 0.22,
				borderRadius: size * 0.22,
				background: INK,
			}}
		>
			<div style={{ width: '66%', height: bar, borderRadius: bar, background: REMOVED }} />
			<div style={{ width: '100%', height: bar, borderRadius: bar, background: ADDED }} />
		</div>
	)
}

export function ShareCard() {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				width: '100%',
				height: '100%',
				padding: 80,
				background: INK,
				color: PAPER,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 36 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 44 }}>
					<div style={{ width: 30, height: 9, borderRadius: 9, background: REMOVED }} />
					<div style={{ width: 44, height: 9, borderRadius: 9, background: ADDED }} />
				</div>
				diffcast
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
				<div style={{ fontSize: 80, lineHeight: 1.04, letterSpacing: -3, maxWidth: 1000 }}>
					What changed in your corner of tech since yesterday.
				</div>
				<div style={{ fontSize: 32, color: '#a0a7ac' }}>
					A private daily tech and AI news podcast. Every segment cited.
				</div>
			</div>
		</div>
	)
}
