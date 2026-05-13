/**
 * Duplicate detection for listings
 *
 * Detects potential duplicate listings by the same vendor
 * Uses exact matching and Levenshtein similarity
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface DuplicateCheck {
  hasDuplicate: boolean
  duplicates: { id: string; title: string; city: string }[]
  similarity: number
}

/**
 * Check if a listing might be a duplicate of an existing one
 */
export async function checkListingDuplicate(
  supabase: SupabaseClient,
  vendorId: string,
  title: string,
  city: string,
  excludeId?: string
): Promise<DuplicateCheck> {
  // Normalize for comparison
  const normalizedTitle = title.toLowerCase().trim()
  const normalizedCity = city.toLowerCase().trim()

  // Fetch all active listings for this vendor
  const query = supabase
    .from('listings')
    .select('id, title, city')
    .eq('vendor_id', vendorId)
    .neq('status', 'archived')

  const { data: listings } = await query

  if (!listings?.length) {
    return { hasDuplicate: false, duplicates: [], similarity: 0 }
  }

  // Filter out the listing being edited (if updating)
  const candidates = listings.filter((l) => !excludeId || l.id !== excludeId)

  const duplicates = candidates.filter((l) => {
    const lTitle = l.title.toLowerCase().trim()
    const lCity = l.city.toLowerCase().trim()

    // Exact title match + same city = high confidence duplicate
    if (lTitle === normalizedTitle && lCity === normalizedCity) {
      return true
    }

    // Similar title (>80% match) + same city
    const similarity = levenshteinSimilarity(lTitle, normalizedTitle)
    if (similarity > 0.8 && lCity === normalizedCity) {
      return true
    }

    return false
  })

  return {
    hasDuplicate: duplicates.length > 0,
    duplicates: duplicates.map((d) => ({
      id: d.id,
      title: d.title,
      city: d.city,
    })),
    similarity: duplicates.length > 0 ? 0.9 : 0,
  }
}

/**
 * Calculate Levenshtein similarity between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  const matrix: number[][] = []

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  const maxLen = Math.max(a.length, b.length)
  return 1 - matrix[b.length][a.length] / maxLen
}

/**
 * Get a human-readable message about duplicate findings
 */
export function formatDuplicateWarning(duplicate: DuplicateCheck): string {
  if (!duplicate.hasDuplicate) {
    return ''
  }

  const titles = duplicate.duplicates.map((d) => `"${d.title}" in ${d.city}`).join(', ')
  return `A listing with a similar title and location already exists: ${titles}. Please review to ensure this is not a duplicate.`
}
