/**
 * Centralized logger for adBazaar — replaces all bare console.* calls.
 * Mirrors the pattern from rez-shared/telemetry.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  if (meta) {
    return `${prefix} ${message} ${JSON.stringify(meta)}`
  }
  return `${prefix} ${message}`
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL]
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta))
    }
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta))
    }
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta))
    }
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      const errorMeta =
        error instanceof Error
          ? { ...meta, error: error.message, stack: error.stack }
          : error !== undefined
            ? { ...meta, error: String(error) }
            : meta
      console.error(formatMessage('error', message, errorMeta))
    }
  },
}

export default logger
