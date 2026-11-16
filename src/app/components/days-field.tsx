import { Checkbox, CheckboxGroup } from '@ui-sdk/react/checkbox'
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field'
import { DAY_NAMES, ISO_WEEKDAYS } from '@/lib/schedule'

export function DaysField({
	defaultDays,
	description,
}: {
	defaultDays: readonly number[]
	description?: string
}) {
	return (
		<Field>
			<FieldLabel>Days</FieldLabel>
			{description && <FieldDescription>{description}</FieldDescription>}
			<CheckboxGroup name="days" required defaultValue={defaultDays.map(String)} data-chips="">
				{ISO_WEEKDAYS.map((day) => (
					<label key={day}>
						<Checkbox value={String(day)} />
						<span aria-hidden="true">{DAY_NAMES[day]?.short}</span>
						<span className="sr-only">{DAY_NAMES[day]?.long}</span>
					</label>
				))}
			</CheckboxGroup>
		</Field>
	)
}
