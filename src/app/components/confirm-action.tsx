'use client'

import {
	AlertDialog,
	AlertDialogBackdrop,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@ui-sdk/react/alert-dialog'
import { toast } from '@ui-sdk/react/toast'

export function ConfirmAction({
	action,
	fields,
	trigger,
	triggerDetail,
	title,
	description,
	confirmLabel,
	doneMessage,
	destructive = false,
}: {
	action: (form: FormData) => Promise<void>
	fields: Record<string, string>
	trigger: string
	triggerDetail?: string
	title: string
	description: string
	confirmLabel: string
	doneMessage: string
	destructive?: boolean
}) {
	async function run() {
		const form = new FormData()
		for (const [key, value] of Object.entries(fields)) form.set(key, value)
		await action(form)
		toast.success(doneMessage)
	}

	return (
		<AlertDialog pendingAnnouncement="Working">
			<AlertDialogTrigger>
				<span>
					{trigger}
					{triggerDetail && <span className="sr-only"> {triggerDetail}</span>}
				</span>
			</AlertDialogTrigger>
			<AlertDialogBackdrop />
			<AlertDialogContent>
				<AlertDialogTitle>{title}</AlertDialogTitle>
				<AlertDialogDescription>{description}</AlertDialogDescription>
				<div className="mt-2 flex flex-wrap justify-end gap-2">
					<AlertDialogClose>Cancel</AlertDialogClose>
					<AlertDialogClose
						value="confirm"
						action={run}
						data-variant={destructive ? 'destructive' : 'solid'}
						data-agent-confirm={description}
					>
						{confirmLabel}
					</AlertDialogClose>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	)
}
