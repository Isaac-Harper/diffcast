import { Throttle } from '../throttle'

export const registrations = new Throttle(10, 60 * 60 * 1000)
export const tokenAttempts = new Throttle(60, 10 * 60 * 1000)
export const mcpCalls = new Throttle(120, 60 * 1000)
