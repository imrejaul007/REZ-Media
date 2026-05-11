'use client'

import { useState } from 'react'

export default function ListingsPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Listings</h1>
        <button className="bg-amber-500 text-black px-4 py-2 rounded-lg font-bold">
          + Add Listing
        </button>
      </div>
      <p className="text-gray-400">4 locked types: Service, Consulting, Booking, Promotion</p>
    </div>
  )
}
