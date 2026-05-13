'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies

// SECURITY FIX (AUTH-BULK-001): Use proper Supabase client instead of localStorage
// Previously used localStorage.getItem('accessToken') which:
// 1. Doesn't exist in Supabase's localStorage pattern
// 2. Is XSS-vulnerable
// Now uses @supabase/ssr with HttpOnly cookies for secure authentication

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

interface UploadResult {
  successes: number
  failures: { row: number; error: string }[]
  created: { id: string; title: string }[]
}

interface FileUploadState {
  file: File | null
  uploading: boolean
  result: UploadResult | null
  error: string | null
}

export default function BulkUploadPage() {
  const router = useRouter()
  const [state, setState] = useState<FileUploadState>({
    file: null,
    uploading: false,
    result: null,
    error: null,
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.push('/login?next=/vendor/bulk-upload')
        return
      }
      setIsAuthenticated(true)
    }
    checkAuth()
  }, [router])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.name.endsWith('.csv')) {
      setState((prev) => ({ ...prev, file: droppedFile }))
    } else {
      setState((prev) => ({ ...prev, error: 'Please upload a CSV file' }))
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.name.endsWith('.csv')) {
      setState((prev) => ({ ...prev, file: selectedFile, error: null }))
    } else if (selectedFile) {
      setState((prev) => ({ ...prev, error: 'Please upload a CSV file' }))
    }
  }, [])

  const downloadTemplate = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const response = await fetch('/api/vendor/bulk-upload', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'listing-template.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading template:', error)
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!state.file || !isAuthenticated) return

    setState((prev) => ({ ...prev, uploading: true, error: null }))

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        router.push('/login?next=/vendor/bulk-upload')
        return
      }

      const formData = new FormData()
      formData.append('file', state.file)

      const response = await fetch('/api/vendor/bulk-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          uploading: false,
          error: data.error || 'Upload failed',
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        uploading: false,
        result: data,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        error: 'Upload failed. Please try again.',
      }))
    }
  }, [state.file, isAuthenticated, router])

  const resetState = useCallback(() => {
    setState({
      file: null,
      uploading: false,
      result: null,
      error: null,
    })
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Rest of component remains the same */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Bulk Upload Listings</h1>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center mb-6 hover:border-gray-500 transition-colors"
        >
          {state.file ? (
            <div>
              <p className="text-green-400 mb-4">Selected: {state.file.name}</p>
              <button
                onClick={resetState}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-400 mb-4">Drag and drop a CSV file here</p>
              <label className="px-6 py-3 bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-500 inline-block">
                <span>Select File</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>

        {state.error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{state.error}</p>
          </div>
        )}

        {state.result && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-2">Upload Complete</h3>
            <p>Successes: {state.result.successes}</p>
            <p>Failures: {state.result.failures.length}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={downloadTemplate}
            className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            Download Template
          </button>

          <button
            onClick={handleUpload}
            disabled={!state.file || state.uploading || !isAuthenticated}
            className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
