'use client'

// Redirect to vendor listings
export default function OwnerListingsPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/vendor/listings'
  }
  return null
}
