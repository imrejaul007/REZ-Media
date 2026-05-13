/**
 * GST and PAN document verification stubs.
 *
 * AB-SEC-DOC-01: These functions provide format validation for GST/PAN numbers.
 * In production, these would connect to government APIs (e.g., GST Portal, NSDL/e-Vahan).
 * Currently implemented as format-only validation with a note that data is unverified.
 */

// GSTIN format: 15 characters
// Format: AA(AAPCL)9999A(1-9)(Z)[0-9A-Z]
// Examples: 29AABCU9603R1ZV
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

// PAN format: 10 characters
// Format: AAAAA9999A
// First 5 letters, then 4 digits, then 1 letter
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

export interface VerificationResult {
  valid: boolean
  name?: string
  address?: string
  error?: string
}

export interface PANVerificationResult {
  valid: boolean
  name?: string
  error?: string
}

/**
 * Verifies a GSTIN (Goods and Services Tax Identification Number).
 *
 * In production, this would:
 * 1. Call the GST Portal API to validate the GSTIN
 * 2. Return the registered business name and address
 * 3. Check for active/inactive status
 *
 * @param gstin - The 15-character GSTIN to verify
 * @returns Verification result with business details if valid
 */
export async function verifyGST(gstin: string): Promise<VerificationResult> {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is required' }
  }

  const normalizedGstin = gstin.toUpperCase().trim()

  // Format validation
  if (!GSTIN_REGEX.test(normalizedGstin)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected format: 29AABCU9603R1ZV',
    }
  }

  // AB-SEC-DOC-01 NOTE: In production, call GST Portal API here:
  // const response = await fetch(`https://api.gst.gov.in/verify/${normalizedGstin}`, {
  //   headers: { 'Authorization': `Bearer ${process.env.GST_API_KEY}` }
  // })
  // const data = await response.json()
  // return { valid: data.status === 'Active', name: data.tradeName, address: data.address }

  // Currently returns format-valid result with unverified placeholder data
  return {
    valid: true,
    // Placeholder - in production this comes from GST API
    name: 'Business Name (unverified)',
    address: 'Address (unverified)',
  }
}

/**
 * Verifies a PAN (Permanent Account Number).
 *
 * In production, this would:
 * 1. Call NSDL or UTIITSL API to validate the PAN
 * 2. Return the cardholder's name (masked per IT Act)
 * 3. Check for PAN status (linked to Aadhaar, active, etc.)
 *
 * @param pan - The 10-character PAN to verify
 * @returns Verification result with name if valid
 */
export async function verifyPAN(pan: string): Promise<PANVerificationResult> {
  if (!pan || typeof pan !== 'string') {
    return { valid: false, error: 'PAN is required' }
  }

  const normalizedPan = pan.toUpperCase().trim()

  // Format validation
  if (!PAN_REGEX.test(normalizedPan)) {
    return {
      valid: false,
      error: 'Invalid PAN format. Expected format: AAAAA9999A (e.g., AABCU9603R)',
    }
  }

  // AB-SEC-DOC-01 NOTE: In production, call NSDL/e-Vahan API here:
  // const response = await fetch(`https://eapi.nsdl.com/verify-pan`, {
  //   headers: { 'Authorization': `Bearer ${process.env.NSDL_API_KEY}` }
  // })
  // const data = await response.json()
  // return { valid: data.panStatus === 'ACTIVE', name: maskName(data.name) }

  // Currently returns format-valid result with unverified placeholder data
  return {
    valid: true,
    // Placeholder - in production this comes from NSDL/UTIITSL API
    name: 'Name (unverified)',
  }
}

/**
 * Masks a name for privacy (shows only first letter and last letter).
 */
export function maskName(name: string): string {
  if (!name || name.length < 2) return '***'
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`
}
