/**
 * Bulk upload utilities for CSV processing
 */

import { ListingCategory, TypeTag, PricingModel, AvailabilityModel, DurationUnit } from '@/types'

// CSV columns expected for listing upload
export const LISTING_CSV_COLUMNS = [
  'title',
  'description',
  'category',
  'subcategory',
  'city',
  'area',
  'address',
  'price',
  'pricing_model',
  'availability_model',
  'duration_unit',
  'images',
]

export interface BulkUploadRow {
  title: string
  description?: string
  category: string
  subcategory: string
  city: string
  area?: string
  address?: string
  price?: number
  pricing_model: string
  availability_model: string
  duration_unit?: string
  images?: string[]
  rowNumber: number
  errors: string[]
}

export interface BulkUploadResult {
  successes: number
  failures: { row: number; error: string }[]
  created: { id: string; title: string }[]
}

/**
 * Parse CSV text into an array of objects
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? ''
    })

    rows.push(row)
  }

  return rows
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Validate and transform a CSV row into a BulkUploadRow
 */
export function validateRow(
  row: Record<string, string>,
  rowNumber: number
): BulkUploadRow {
  const errors: string[] = []

  // Required fields
  if (!row.title?.trim()) {
    errors.push('title is required')
  }

  if (!row.category?.trim()) {
    errors.push('category is required')
  } else if (!Object.values(ListingCategory).includes(row.category as ListingCategory)) {
    errors.push(`invalid category: ${row.category}`)
  }

  if (!row.subcategory?.trim()) {
    errors.push('subcategory is required')
  }

  if (!row.city?.trim()) {
    errors.push('city is required')
  }

  if (!row.pricing_model?.trim()) {
    errors.push('pricing_model is required')
  } else if (!Object.values(PricingModel).includes(row.pricing_model as PricingModel)) {
    errors.push(`invalid pricing_model: ${row.pricing_model}`)
  }

  if (!row.availability_model?.trim()) {
    errors.push('availability_model is required')
  } else if (!Object.values(AvailabilityModel).includes(row.availability_model as AvailabilityModel)) {
    errors.push(`invalid availability_model: ${row.availability_model}`)
  }

  // Price validation
  let price: number | undefined
  if (row.price?.trim()) {
    const parsedPrice = parseFloat(row.price)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      errors.push('price must be a positive number')
    } else {
      price = parsedPrice
    }
  }

  // Duration unit validation
  let durationUnit: string | undefined
  if (row.duration_unit?.trim()) {
    if (!Object.values(DurationUnit).includes(row.duration_unit as DurationUnit)) {
      errors.push(`invalid duration_unit: ${row.duration_unit}`)
    } else {
      durationUnit = row.duration_unit
    }
  }

  // Images parsing (comma-separated URLs)
  let images: string[] | undefined
  if (row.images?.trim()) {
    images = row.images.split(',').map((url) => url.trim()).filter(Boolean)
  }

  return {
    title: row.title?.trim() ?? '',
    description: row.description?.trim() || undefined,
    category: row.category?.trim() ?? '',
    subcategory: row.subcategory?.trim() ?? '',
    city: row.city?.trim() ?? '',
    area: row.area?.trim() || undefined,
    address: row.address?.trim() || undefined,
    price,
    pricing_model: row.pricing_model?.trim() ?? 'quote',
    availability_model: row.availability_model?.trim() ?? 'always_on',
    duration_unit: durationUnit,
    images,
    rowNumber,
    errors,
  }
}

/**
 * Generate a CSV template for bulk listing upload
 */
export function generateCSVTemplate(): string {
  const headers = LISTING_CSV_COLUMNS.join(',')
  const exampleRow = [
    'Billboard in Connaught Place',
    'Prime location billboard near metro station',
    'outdoor_ooh',
    'billboard',
    'Delhi',
    'Connaught Place',
    'Block B, CP',
    '50000',
    'fixed',
    'always_on',
    'per_month',
    'https://example.com/image1.jpg,https://example.com/image2.jpg',
  ].join(',')

  return `${headers}\n${exampleRow}`
}
