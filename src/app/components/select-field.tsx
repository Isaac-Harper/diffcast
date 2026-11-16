import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui-sdk/react/select'

export type SelectOption = { value: string; label: string }

export function SelectField({
	name,
	label,
	labelHidden = false,
	options,
	defaultValue,
	value,
	onValueChange,
	placeholder,
	required = false,
	className,
}: {
	name: string
	label: string
	labelHidden?: boolean
	options: readonly SelectOption[]
	defaultValue?: string
	value?: string
	onValueChange?: (value: string) => void
	placeholder?: string
	required?: boolean
	className?: string
}) {
	return (
		<Field className={className}>
			<FieldLabel className={labelHidden ? 'sr-only' : undefined}>{label}</FieldLabel>
			<Select
				name={name}
				items={[...options]}
				defaultValue={defaultValue}
				value={value === undefined ? undefined : value || null}
				onValueChange={
					onValueChange ? (next: string | null) => onValueChange(next ?? '') : undefined
				}
				placeholder={placeholder}
				required={required}
			>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	)
}
