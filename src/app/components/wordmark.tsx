export function Wordmark({ className = '' }: { className?: string }) {
	return (
		<span className={`inline-flex items-center gap-2 font-mono font-semibold ${className}`}>
			<span aria-hidden="true" className="flex w-3.5 flex-col gap-[3px]">
				<span className="h-[3px] w-2.5 rounded-full bg-del" />
				<span className="h-[3px] w-3.5 rounded-full bg-add" />
			</span>
			diffcast
		</span>
	)
}
