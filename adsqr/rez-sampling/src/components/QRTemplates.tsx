'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface QRTemplate {
  id: string
  name: string
  foreground: string
  background: string
  style: 'square' | 'round' | 'dot' | 'star'
  logo?: string
  logoSize?: number
}

interface QRTemplatesProps {
  qrId: string
  currentTemplate?: Partial<QRTemplate>
  onUpdate?: (template: Partial<QRTemplate>) => void
}

const presetTemplates: QRTemplate[] = [
  { id: 'default', name: 'Classic', foreground: '#000000', background: '#ffffff', style: 'square' },
  { id: 'indigo', name: 'Indigo', foreground: '#6366F1', background: '#ffffff', style: 'round' },
  { id: 'dark', name: 'Dark Mode', foreground: '#ffffff', background: '#1F2937', style: 'square' },
  { id: 'gradient', name: 'Gradient', foreground: '#6366F1', background: '#EC4899', style: 'dot' },
  { id: 'nature', name: 'Nature', foreground: '#059669', background: '#D1FAE5', style: 'round' },
  { id: 'sunset', name: 'Sunset', foreground: '#EA580C', background: '#FED7AA', style: 'square' }
]

export default function QRTemplates({ qrId, currentTemplate, onUpdate }: QRTemplatesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(25)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [template, setTemplate] = useState<Partial<QRTemplate>>({
    foreground: '#000000',
    background: '#ffffff',
    style: 'square',
    ...currentTemplate
  })

  const updateTemplate = (updates: Partial<QRTemplate>) => {
    const newTemplate = { ...template, ...updates }
    setTemplate(newTemplate)
    if (onUpdate) onUpdate(newTemplate)
    generatePreview(newTemplate)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 500000) {
      alert('Logo file must be less than 500KB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setCustomLogo(dataUrl)
      updateTemplate({ logo: dataUrl, logoSize })
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setCustomLogo(null)
    updateTemplate({ logo: undefined, logoSize: undefined })
  }

  const generatePreview = async (tmpl: Partial<QRTemplate>) => {
    try {
      // Get the current QR code URL
      const res = await fetch(`/api/qr/${qrId}`)
      if (res.ok) {
        const { qr } = await res.json()
        const baseUrl = qr.qr_image_url?.split('?')[0] || ''

        // Add color parameters for preview (QR Server API)
        const params = new URLSearchParams()
        params.set('size', '200x200')
        params.set('color', tmpl.foreground || '#000000')
        params.set('bgcolor', tmpl.background || '#ffffff')

        setPreviewUrl(`https://api.qrserver.com/v1/create-qr-code/?${params.toString()}&data=${encodeURIComponent(`https://adsqr.rezapp.com/scan/${qr.qr_slug}`)}`)
      }
    } catch (error) {
      console.error('Failed to generate preview:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/qr/${qrId}/template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
      })

      if (!res.ok) {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = (preset: QRTemplate) => {
    updateTemplate({
      foreground: preset.foreground,
      background: preset.background,
      style: preset.style
    })
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">QR Code Style</h3>
        <p className="text-sm text-gray-500">Customize the appearance of your QR code</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Preset Templates */}
        <div>
          <label className="block text-sm font-medium mb-2">Quick Templates</label>
          <div className="grid grid-cols-6 gap-2">
            {presetTemplates.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`p-2 border rounded-lg hover:border-indigo-400 transition ${
                  template.foreground === preset.foreground &&
                  template.background === preset.background
                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                    : ''
                }`}
                title={preset.name}
              >
                <div
                  className="w-full aspect-square rounded"
                  style={{
                    backgroundColor: preset.background,
                    backgroundImage: preset.style === 'dot'
                      ? 'radial-gradient(circle, transparent 20%, ' + preset.foreground + ' 20%, ' + preset.foreground + ' 25%, transparent 25%, transparent 45%, ' + preset.foreground + ' 45%, ' + preset.foreground + ' 50%, transparent 50%)'
                      : undefined
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className="w-2/3 h-2/3"
                      style={{
                        backgroundColor: preset.foreground,
                        borderRadius: preset.style === 'round' ? '20%' : '0'
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs mt-1 block">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">QR Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={template.foreground || '#000000'}
                onChange={e => updateTemplate({ foreground: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={template.foreground || '#000000'}
                onChange={e => updateTemplate({ foreground: e.target.value })}
                className="flex-1 border rounded px-3 py-2"
                placeholder="#000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Background</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={template.background || '#ffffff'}
                onChange={e => updateTemplate({ background: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={template.background || '#ffffff'}
                onChange={e => updateTemplate({ background: e.target.value })}
                className="flex-1 border rounded px-3 py-2"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>

        {/* Style Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">QR Style</label>
          <div className="grid grid-cols-4 gap-2">
            {(['square', 'round', 'dot', 'star'] as const).map(style => (
              <button
                key={style}
                onClick={() => updateTemplate({ style })}
                className={`p-3 border rounded-lg text-center capitalize ${
                  template.style === style
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'hover:border-gray-400'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Logo (Optional)</label>
          {customLogo ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 border rounded flex items-center justify-center bg-gray-50">
                <Image src={customLogo} alt="Logo" width={64} height={64} className="max-w-full max-h-full" />
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min="10"
                  max="40"
                  value={logoSize}
                  onChange={e => {
                    setLogoSize(parseInt(e.target.value))
                    updateTemplate({ logoSize: parseInt(e.target.value) })
                  }}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">Size: {logoSize}%</span>
              </div>
              <button
                onClick={removeLogo}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
              >
                Upload Logo (PNG, JPG, SVG - Max 500KB)
              </button>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium mb-2">Preview</label>
          <div
            className="aspect-square max-w-xs mx-auto rounded-lg flex items-center justify-center border"
            style={{ backgroundColor: template.background || '#ffffff' }}
          >
            {previewUrl ? (
              <Image src={previewUrl} alt="QR Preview" width={200} height={200} className="max-w-full max-h-full" />
            ) : (
              <div className="text-gray-400">Preview will appear here</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t bg-gray-50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Style'}
        </button>
      </div>
    </div>
  )
}
