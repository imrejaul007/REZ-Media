/**
 * Supabase DB for Creator QR
 */

export async function getCreator(id: string) {
  return { id, name: 'Demo Creator' }
}

export async function getListings(creatorId: string) {
  return []
}

export async function createBooking(booking: any) {
  return { id: 'bk_demo', ...booking }
}
