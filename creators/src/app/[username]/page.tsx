export default function CreatorPage() {
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold">Creator Profile</h1>
      <p className="text-gray-400">Verified Creator with 4 listing types</p>
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-gray-900 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Service</p>
          <p className="text-xl font-bold">One-time work</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Consulting</p>
          <p className="text-xl font-bold">Expert advice</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Booking</p>
          <p className="text-xl font-bold">Time-based sessions</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Promotion</p>
          <p className="text-xl font-bold">Social collab</p>
        </div>
      </div>
    </div>
  )
}
