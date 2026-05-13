'use client'

import { useEffect, useState } from 'react'

interface AvailabilitySlot {
  id: string
  date?: string | null
  slot_start?: string | null
  slot_end?: string | null
  status: 'available' | 'booked' | 'blocked'
}

interface AvailabilityData {
  availabilityModel: 'calendar' | 'slot' | 'always_on'
  minBookingDays: number
  price?: number | null
  durationUnit?: string | null
  slots: AvailabilitySlot[]
  bookedDates: string[]
}

interface Props {
  listingId: string
  onRangeSelect?: (from: string, to: string, nights: number) => void
  onSlotSelect?: (slots: AvailabilitySlot[]) => void
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

// ─────────────────────────────────────────
// Calendar (date-range picker)
// ─────────────────────────────────────────

function CalendarPicker({
  data,
  onRangeSelect,
}: {
  data: AvailabilityData
  onRangeSelect?: (from: string, to: string, nights: number) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  // Build a set of blocked dates (from DB rows + booked bookings)
  const blockedSet = new Set<string>()
  for (const s of data.slots) {
    if ((s.status === 'booked' || s.status === 'blocked') && s.date) {
      blockedSet.add(s.date)
    }
  }
  for (const d of data.bookedDates) blockedSet.add(d)

  function isBlocked(dateStr: string): boolean {
    return blockedSet.has(dateStr)
  }

  function isPast(dateStr: string): boolean {
    return dateStr < toDateStr(today)
  }

  function isDisabled(dateStr: string): boolean {
    return isPast(dateStr) || isBlocked(dateStr)
  }

  function inRange(dateStr: string): boolean {
    const ref = end ?? hover
    if (!start || !ref) return false
    const [lo, hi] = start <= ref ? [start, ref] : [ref, start]
    return dateStr > lo && dateStr < hi
  }

  function handleDayClick(dateStr: string) {
    if (isDisabled(dateStr)) return
    if (!start || (start && end)) {
      setStart(dateStr)
      setEnd(null)
      return
    }
    // Second click
    if (dateStr === start) { setStart(null); return }
    const [from, to] = dateStr > start ? [start, dateStr] : [dateStr, start]
    // Check no blocked day falls in range
    const s = new Date(from)
    const e = new Date(to)
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (isBlocked(toDateStr(d))) {
        // Reset if blocked day in range
        setStart(dateStr)
        setEnd(null)
        return
      }
    }
    const nights = Math.round((e.getTime() - s.getTime()) / 86400000)
    if (nights < data.minBookingDays) return
    setEnd(to)
    setStart(from)
    onRangeSelect?.(from, to, nights)
  }

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-white">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: '#6b7280' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const disabled = isDisabled(dateStr)
          const booked = blockedSet.has(dateStr)
          const isStart = dateStr === start
          const isEnd = dateStr === end
          const rangeDay = inRange(dateStr)
          const selected = isStart || isEnd

          let bg = 'transparent'
          let color = '#d1d5db'
          let opacity = 1

          if (disabled && !booked) { opacity = 0.3 }
          else if (booked) { bg = '#3f3f46'; color = '#71717a'; opacity = 0.7 }
          else if (selected) { bg = '#f59e0b'; color = '#0f0f0f' }
          else if (rangeDay) { bg = '#f59e0b22'; color = '#fbbf24' }

          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => !disabled && start && !end && setHover(dateStr)}
              onMouseLeave={() => setHover(null)}
              className="relative flex items-center justify-center rounded-md text-xs font-medium transition-all"
              style={{
                height: 32,
                backgroundColor: bg,
                color,
                opacity,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {day}
              {booked && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#f87171' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs" style={{ color: '#6b7280' }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f59e0b' }} /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#3f3f46' }} /> Booked
        </span>
      </div>

      {/* Selection summary */}
      {start && end && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#f59e0b11', border: '1px solid #f59e0b33', color: '#fbbf24' }}
        >
          {start} → {end}
          {' '}·{' '}
          {Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)} days
        </div>
      )}
      {start && !end && data.minBookingDays > 1 && (
        <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>
          Minimum booking: {data.minBookingDays} days. Pick an end date.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Slot picker (radio/TV / timed slots)
// ─────────────────────────────────────────

function SlotPicker({
  data,
  onSlotSelect,
}: {
  data: AvailabilityData
  onSlotSelect?: (slots: AvailabilitySlot[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const available = data.slots.filter(s => s.status === 'available')

  function toggleSlot(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const selectedSlots = available.filter(s => next.has(s.id))
      onSlotSelect?.(selectedSlots)
      return next
    })
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: '#6b7280' }}>
        No available slots in the next 60 days.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {available.map(slot => {
        const isSelected = selected.has(slot.id)
        const start = slot.slot_start ? new Date(slot.slot_start) : null
        const end = slot.slot_end ? new Date(slot.slot_end) : null
        const dateLabel = start
          ? start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
          : 'TBD'
        const timeLabel = start && end
          ? `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
          : ''

        return (
          <button
            key={slot.id}
            onClick={() => toggleSlot(slot.id)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition-all"
            style={{
              backgroundColor: isSelected ? '#f59e0b22' : '#111111',
              border: `1px solid ${isSelected ? '#f59e0b' : '#2a2a2a'}`,
              color: isSelected ? '#fbbf24' : '#d1d5db',
            }}
          >
            <span>
              <span className="font-medium">{dateLabel}</span>
              {timeLabel && <span className="ml-2 text-xs opacity-70">{timeLabel}</span>}
            </span>
            {isSelected && <span style={{ color: '#f59e0b' }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────

export default function AvailabilityCalendar({ listingId, onRangeSelect, onSlotSelect }: Props) {
  const [data, setData] = useState<AvailabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/listings/${listingId}/availability`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load availability'); setLoading(false) })
  }, [listingId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-sm text-center py-3" style={{ color: '#6b7280' }}>{error || 'Unavailable'}</p>
  }

  if (data.availabilityModel === 'always_on') {
    return (
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        style={{ backgroundColor: '#14532d22', border: '1px solid #14532d', color: '#4ade80' }}
      >
        <span>●</span> Available anytime — book any dates
      </div>
    )
  }

  return (
    <div>
      {data.availabilityModel === 'calendar' ? (
        <CalendarPicker data={data} onRangeSelect={onRangeSelect} />
      ) : (
        <SlotPicker data={data} onSlotSelect={onSlotSelect} />
      )}
    </div>
  )
}
