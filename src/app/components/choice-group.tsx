import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Radio, RadioGroup } from '@ui-sdk/react/radio'

export function ChoiceGroup({
	name,
	label,
	labelHidden = false,
	options,
	defaultValue,
	required = false,
}: {
	name: string
	label: string
	labelHidden?: boolean
	options: readonly { value: string; label: string }[]
	defaultValue: string | null
	required?: boolean
}) {
	return (
		<Field>
			<FieldLabel className={labelHidden ? 'sr-only' : undefined}>{label}</FieldLabel>
			<RadioGroup name={name} defaultValue={defaultValue} required={required} data-chips="">
				{options.map((option) => (
					<label key={option.value}>
						<Radio value={option.value} />
						{option.label}
					</label>
				))}
			</RadioGroup>
		</Field>
	)
}
