import { Throttle } from '../throttle'

export const registrations = new Throttle(10, 60 * 60 * 1000)
export const tokenAttempts = new Throttle(60, 10 * 60 * 1000)
export const mcpCalls = new Throttle(120, 60 * 1000)
export const metadataFetches = new Throttle(10, 10 * 60 * 1000)
export const failedClientIds = new Throttle(1, 5 * 60 * 1000)
