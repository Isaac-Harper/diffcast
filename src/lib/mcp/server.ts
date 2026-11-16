import type { CallToolResult, McpServer, ServerContext } from '@modelcontextprotocol/server'
import { diffcastAuth } from '../oauth/verify-access'
import { isServed } from '../served'
import { getListener } from '../store/listeners'
import {
	addInterestInput,
	clearContextInput,
	listEpisodesInput,
	noInput,
	pushContextInput,
	removeInterestInput,
	setDaysInput,
	setInterestsInput,
} from './rules'
import {
	addInterest,
	clearContext,
	getInterests,
	getLatestEpisode,
	getSchedule,
	listContext,
	listEpisodes,
	pushContext,
	removeInterest,
	setDays,
	setInterests,
	ToolRefusal,
} from './tools'
import type { ToolOutput } from './tools'

function refusal(message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] }
}

async function run(
	ctx: ServerContext,
	tool: (listenerId: number) => Promise<ToolOutput>
): Promise<CallToolResult> {
	const { listenerId } = diffcastAuth(ctx.http?.authInfo)
	const listener = await getListener(listenerId)
	if (!listener || !isServed(listener)) {
		return refusal('This Diffcast subscription is not active, so the agent connection is paused.')
	}
	try {
		const output = await tool(listenerId)
		return { content: [{ type: 'text', text: output.summary }], structuredContent: output.data }
	} catch (error) {
		if (error instanceof ToolRefusal) return refusal(error.message)
		throw error
	}
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

export function registerDiffcastTools(server: McpServer, origin: string): void {
	server.registerTool(
		'push_context',
		{
			title: 'Push work context',
			description:
				'Tell Diffcast what the developer is working on this week so tomorrow’s episode leans into it. Send the project alias, its packages and the technical topics. Project names and summaries are never spoken. Upserts by project; entries expire after 30 days. Limited to 60 calls a day.',
			inputSchema: pushContextInput,
			annotations: WRITES,
		},
		(input, ctx) => run(ctx, (listenerId) => pushContext(listenerId, input))
	)
	server.registerTool(
		'list_context',
		{
			title: 'List work context',
			description: 'List the work context Diffcast holds for this listener, newest first.',
			inputSchema: noInput,
			annotations: READ_ONLY,
		},
		(_input, ctx) => run(ctx, (listenerId) => listContext(listenerId))
	)
	server.registerTool(
		'clear_context',
		{
			title: 'Clear work context',
			description: 'Delete the saved work context for one project, or all of it.',
			inputSchema: clearContextInput,
			annotations: { ...WRITES, destructiveHint: true },
		},
		(input, ctx) => run(ctx, (listenerId) => clearContext(listenerId, input))
	)
	server.registerTool(
		'get_interests',
		{
			title: 'Get interests',
			description:
				'Read the listener’s interests in priority order, each with an optional take and note.',
			inputSchema: noInput,
			annotations: READ_ONLY,
		},
		(_input, ctx) => run(ctx, (listenerId) => getInterests(listenerId))
	)
	server.registerTool(
		'set_interests',
		{
			title: 'Replace interests',
			description:
				'Replace the whole interest list, most important first. A take is where the listener stands; a note is anything else the hosts should know. Keep at least one.',
			inputSchema: setInterestsInput,
			annotations: { ...WRITES, destructiveHint: true },
		},
		(input, ctx) => run(ctx, (listenerId) => setInterests(listenerId, input))
	)
	server.registerTool(
		'add_interest',
		{
			title: 'Add an interest',
			description: 'Add one interest at the end of the list.',
			inputSchema: addInterestInput,
			annotations: WRITES,
		},
		(input, ctx) => run(ctx, (listenerId) => addInterest(listenerId, input))
	)
	server.registerTool(
		'remove_interest',
		{
			title: 'Remove an interest',
			description: 'Remove one interest by its topic. At least one interest must remain.',
			inputSchema: removeInterestInput,
			annotations: { ...WRITES, destructiveHint: true },
		},
		(input, ctx) => run(ctx, (listenerId) => removeInterest(listenerId, input))
	)
	server.registerTool(
		'get_schedule',
		{
			title: 'Get schedule',
			description: 'Read which days episodes arrive, the format of each day and the time zone.',
			inputSchema: noInput,
			annotations: READ_ONLY,
		},
		(_input, ctx) => run(ctx, (listenerId) => getSchedule(listenerId))
	)
	server.registerTool(
		'set_days',
		{
			title: 'Set episode days',
			description:
				'Choose the days episodes arrive. Weekdays are daily news, Saturday a weekly recap, Sunday the week ahead.',
			inputSchema: setDaysInput,
			annotations: WRITES,
		},
		(input, ctx) => run(ctx, (listenerId) => setDays(listenerId, input))
	)
	server.registerTool(
		'get_latest_episode',
		{
			title: 'Get the latest episode',
			description:
				'Read the newest episode: title, summary, format, segments with their sources, duration and a link to the account page.',
			inputSchema: noInput,
			annotations: READ_ONLY,
		},
		(_input, ctx) => run(ctx, (listenerId) => getLatestEpisode(listenerId, origin))
	)
	server.registerTool(
		'list_episodes',
		{
			title: 'List episodes',
			description: 'Read recent episodes, newest first (up to 14).',
			inputSchema: listEpisodesInput,
			annotations: READ_ONLY,
		},
		(input, ctx) => run(ctx, (listenerId) => listEpisodes(listenerId, input, origin))
	)
}
