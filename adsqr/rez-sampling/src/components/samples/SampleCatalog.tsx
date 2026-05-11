'use client';

import { useState, useEffect } from 'react';

interface SampleCatalogProps {
  campaignId?: string;
}

interface Sample {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  stock: number;
  coinCost: number;
}

export default function SampleCatalog({ campaignId }: SampleCatalogProps) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'requests'>('catalog');

  useEffect(() => {
    fetchSamples();
    if (userId) fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, userId]);

  const fetchSamples = async () => {
    try {
      const url = campaignId
        ? `/api/samples/available?campaignId=${campaignId}`
        : '/api/samples/available';
      const response = await fetch(url);
      const data = await response.json();
      setSamples(data.samples || []);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/samples/request?userId=${userId}`);
      const data = await response.json();
      // Handle requests
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading samples...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'catalog' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
        >
          Catalog
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'requests' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
        >
          My Requests
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {samples.map(sample => (
            <div key={sample.id} className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-semibold">{sample.name}</h3>
              <p className="text-sm text-gray-500">{sample.description}</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-indigo-600 font-bold">{sample.coinCost} coins</span>
                <span className="text-xs text-gray-400">Stock: {sample.stock}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="text-center py-8 text-gray-500">
          No sample requests yet
        </div>
      )}
    </div>
  );
}
