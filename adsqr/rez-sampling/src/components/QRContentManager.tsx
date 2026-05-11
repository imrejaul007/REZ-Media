'use client';

import { useState, useEffect } from 'react';

interface QRContentManagerProps {
  qrId: string;
  initialContent?: any;
  onUpdate?: (content: any) => void;
}

export default function QRContentManager({ qrId, initialContent, onUpdate }: QRContentManagerProps) {
  const [content, setContent] = useState(initialContent || {
    default_content: { type: 'campaign', value: qrId },
    time_based: [],
    location_based: []
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch(`/api/qr/${qrId}/content`)
        if (res.ok) {
          const data = await res.json()
          setContent(data.content || content)
        }
      } catch (error) {
        console.error('Failed to fetch QR content:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/qr/${qrId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (res.ok && onUpdate) {
        onUpdate(content)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">QR Content Manager</h3>
      <textarea
        value={JSON.stringify(content, null, 2)}
        onChange={(e) => setContent(JSON.parse(e.target.value))}
        className="w-full h-64 p-4 rounded-lg border bg-gray-50 font-mono text-sm"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Content'}
      </button>
    </div>
  );
}
