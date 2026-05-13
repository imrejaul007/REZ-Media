'use client'

import { useRef, useState } from 'react'
import Image from '@/components/ui/Image'

interface Props {
  data: {
    images: string[]
    address: string
    lat: string
    lng: string
  }
  onChange: (field: string, value: string | string[]) => void
  errors: Record<string, string>
  accessToken?: string
}

interface UploadState {
  uploading: boolean
  error: string | null
}

export default function StepMedia({ data, onChange, errors, accessToken }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ uploading: false, error: null })

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const remaining = 5 - data.images.filter(Boolean).length
    const toUpload = files.slice(0, remaining)

    if (toUpload.length === 0) {
      setUploadState({ uploading: false, error: 'Maximum 5 images allowed.' })
      return
    }

    setUploadState({ uploading: true, error: null })

    try {
      const uploaded: string[] = []
      for (const file of toUpload) {
        const formData = new FormData()
        formData.append('file', file)

        const uploadHeaders: Record<string, string> = {}
        if (accessToken) uploadHeaders['Authorization'] = `Bearer ${accessToken}`
        const res = await fetch('/api/upload/image', {
          method: 'POST',
          headers: uploadHeaders,
          body: formData,
        })

        const json = await res.json()
        if (!res.ok) {
          setUploadState({ uploading: false, error: json.error ?? 'Upload failed' })
          return
        }
        uploaded.push(json.url as string)
      }

      const newImages = [...data.images.filter(Boolean), ...uploaded].slice(0, 5)
      onChange('images', newImages)
      setUploadState({ uploading: false, error: null })
    } catch {
      setUploadState({ uploading: false, error: 'Upload failed. Please try again.' })
    } finally {
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeImage(index: number) {
    onChange('images', data.images.filter((_, i) => i !== index))
  }

  const canAddMore = data.images.filter(Boolean).length < 5

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-300">
            Listing Images <span className="text-gray-500">({data.images.filter(Boolean).length}/5)</span>
          </label>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
          disabled={uploadState.uploading || !canAddMore}
        />

        {/* Drop-zone / upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState.uploading || !canAddMore}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: '#2a2a2a', backgroundColor: '#111111', color: '#9ca3af' }}
        >
          {uploadState.uploading ? (
            <>
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Uploading…</span>
            </>
          ) : canAddMore ? (
            <>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Click to upload images (JPEG, PNG, WebP · max 5 MB each)</span>
            </>
          ) : (
            <span>Maximum 5 images reached</span>
          )}
        </button>

        {uploadState.error && (
          <p className="mt-2 text-xs text-red-400">{uploadState.error}</p>
        )}
        {errors.images && (
          <p className="mt-1 text-xs text-red-400">{errors.images}</p>
        )}
      </div>

      {/* Preview grid */}
      {data.images.filter(Boolean).length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {data.images.filter(Boolean).map((url, i) => (
            <div
              key={i}
              className="relative aspect-video rounded-lg overflow-hidden group"
              style={{ border: '1px solid #2a2a2a' }}
            >
              <Image src={url} alt={`Image ${i + 1}`} width={640} height={360} className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 flex items-center justify-center h-6 w-6 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                aria-label={`Remove image ${i + 1}`}
              >
                ×
              </button>
              {i === 0 && (
                <span
                  className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#f59e0b' }}
                >
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Full Address</label>
        <input
          type="text"
          value={data.address}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder="123, MG Road, Bandra West, Mumbai - 400050"
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
          style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
        />
      </div>

      {/* Lat / Lng */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-2">
          Coordinates{' '}
          <span className="text-xs font-normal text-gray-500">— optional, for map discovery</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
            <input
              type="number"
              value={data.lat}
              onChange={(e) => onChange('lat', e.target.value)}
              placeholder="19.0760"
              step="any"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
            <input
              type="number"
              value={data.lng}
              onChange={(e) => onChange('lng', e.target.value)}
              placeholder="72.8777"
              step="any"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
