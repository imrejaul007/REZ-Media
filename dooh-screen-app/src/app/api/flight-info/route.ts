import { NextResponse } from 'next/server'

/**
 * GET /api/flight-info
 * Returns current flight context for seatback/entrance screens
 *
 * In production, this would integrate with airline APIs:
 * - Amadeus
 * - Sabre
 * - Inflight entertainment systems
 */

// Demo flight data - in production, fetch from airline API
const DEMO_FLIGHTS = [
  {
    flight_number: 'AI-101',
    airline: 'Air India',
    origin: 'DEL',
    destination: 'BLR',
    departure_time: '06:30',
    arrival_time: '09:45',
    cabin_class: 'economy' as const,
    seat_range: '1-30',
  },
  {
    flight_number: '6E-2341',
    airline: 'IndiGo',
    origin: 'BOM',
    destination: 'DEL',
    departure_time: '14:00',
    arrival_time: '16:30',
    cabin_class: 'economy' as const,
    seat_range: '1-45',
  },
]

export async function GET() {
  // In production:
  // 1. Get screen ID from request header or config
  // 2. Look up screen's assigned flight
  // 3. Fetch from airline API
  // 4. Return flight context

  // Demo: return random flight
  const flight = DEMO_FLIGHTS[Math.floor(Math.random() * DEMO_FLIGHTS.length)]

  // Add dynamic times based on current time
  const now = new Date()
  const departure = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
  const arrival = new Date(now.getTime() + 5 * 60 * 60 * 1000) // 5 hours from now

  const flightContext = {
    ...flight,
    departure_time: departure.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    arrival_time: arrival.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }

  return NextResponse.json(flightContext)
}
