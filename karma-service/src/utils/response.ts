export const ErrorCodes = {
  SRV_INTERNAL_ERROR: { code: 'SRV_001', message: 'Internal server error' },
  RES_NOT_FOUND: { code: 'RES_001', message: 'Resource not found' },
} as const;

export function success(data: unknown) {
  return { success: true, data };
}

export function err(code: string, details?: unknown) {
  const def = ErrorCodes[code as keyof typeof ErrorCodes] || { code, message: 'An error occurred' };
  const error: { code: string; message: string; details?: unknown } = {
    code: def.code,
    message: def.message,
  };
  if (details) {
    error.details = details;
  }
  return { success: false, error };
}
