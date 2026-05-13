/**
 * Environment variable validation for adBazaar.
 * Call validateEnv() at the top of any API route that requires these variables.
 * This prevents silent failures when environment variables are missing.
 */

// AB-SEC-ENV-01: List of required environment variables
const REQUIRED_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

/**
 * Validates that all required environment variables are present.
 * Throws an error with a clear message if any are missing.
 * Call this at the top of API route handlers that need these variables.
 */
export function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables: ${missing.join(', ')}. ` +
      'Please set these in your .env file or deployment environment.'
    )
  }
}

/**
 * Gets an environment variable, throwing if it's missing.
 * Use this for variables that MUST be present.
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`[ENV] Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * Gets an optional environment variable with a default value.
 */
export function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}
