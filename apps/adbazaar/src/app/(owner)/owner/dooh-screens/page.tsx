'use client'

// Redirect to vendor DOOH screens
export default function OwnerDoohScreensPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/vendor/dooh-screens'
  }
  return null
}
