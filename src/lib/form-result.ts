export type FormResult = { status: 'idle' | 'saved' | 'error'; message: string }

export const IDLE: FormResult = { status: 'idle', message: '' }
