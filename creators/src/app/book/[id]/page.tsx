'use client'

import { useState } from 'react'

export default function BookingPage() {
  const [step, setStep] = useState('select')
  const [slot, setSlot] = useState('')

  const handlePay = async () => {
    await new Promise(r => setTimeout(r, 1000))
    alert('Booking confirmed!')
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold mb-4">Book Session</h1>
      <p className="text-gray-400 mb-4">Select time slot</p>
      <div className="space-y-2">
        <button onClick={() => setSlot('10 AM')} className="w-full p-4 bg-gray-900 rounded-lg text-left">
          <span className={slot === '10 AM' ? 'text-amber-500' : 'text-white'}>10:00 AM</span>
        </button>
        <button onClick={() => setSlot('11 AM')} className="w-full p-4 bg-gray-900 rounded-lg text-left">
          <span className={slot === '11 AM' ? 'text-amber-500' : 'text-gray-400'}>11:00 AM (Booked)</span>
        </button>
        <button onClick={() => setSlot('2 PM')} className="w-full p-4 bg-gray-900 rounded-lg text-left">
          <span className={slot === '2 PM' ? 'text-amber-500' : 'text-white'}>2:00 PM</span>
        </button>
      </div>
      {slot && (
        <button onClick={handlePay} className="w-full mt-6 py-4 bg-amber-500 text-black font-bold rounded-lg">
          Pay ₹999
        </button>
      )}
    </div>
  )
}
