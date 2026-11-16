export default function Home() {
	return (
		<main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
			<p className="font-mono text-sm text-zinc-500">diffcast.fm</p>
			<h1 className="text-4xl font-semibold tracking-tight text-balance">
				What changed in your stack since yesterday.
			</h1>
			<p className="text-lg leading-8 text-pretty text-zinc-600 dark:text-zinc-400">
				A ten minute, two host podcast on the releases, deprecations and advisories that touch the
				stack you actually use. Every segment cited. Your coding agent keeps it current.
			</p>
			<p className="font-mono text-sm text-zinc-500">In development.</p>
		</main>
	)
}
