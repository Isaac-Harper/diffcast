import { jsonSchema } from 'ai'
import type { JSONSchema7, Schema } from 'ai'
import { z } from 'zod'

const BOUND_KEYWORDS = new Set([
	'minLength',
	'maxLength',
	'minItems',
	'maxItems',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'pattern',
	'format',
	'$schema',
])

function withoutBounds(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutBounds)
	if (!value || typeof value !== 'object') return value
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !BOUND_KEYWORDS.has(key))
			.map(([key, entry]) => [
				key,
				key === 'properties' ? propertiesWithoutBounds(entry) : withoutBounds(entry),
			])
	)
}

function propertiesWithoutBounds(properties: unknown): unknown {
	if (!properties || typeof properties !== 'object') return properties
	return Object.fromEntries(
		Object.entries(properties).map(([name, entry]) => [name, withoutBounds(entry)])
	)
}

export function modelFacingSchema(schema: z.ZodType): Schema<unknown> {
	return jsonSchema(withoutBounds(z.toJSONSchema(schema, { io: 'input' })) as JSONSchema7)
}
