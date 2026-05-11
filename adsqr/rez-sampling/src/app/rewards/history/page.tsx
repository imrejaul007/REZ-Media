'use client';

import React, { useState, useEffect } from 'react';
import { getStoredUser } from '@/lib/rezAuth';
import { getTransactions } from '@/lib/rezWallet';
import { createClient } from '@/lib/supabase';
import type { AuthUser } from '@supabase/supabase-js';

interface RedemptionRecord {
  id: string;
  type: 'coin' | 'sample' | 'consultation' | 'discount' | 'gift';
  title: string;
  description: string;
  value: number;
  status: 'pending' | 'completed' | 'cancelled';
  recipientEmail?: string;
  redeemedAt: string;
  expiresAt?: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  coinType: string;
  source: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export default function RedemptionHistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'coin' | 'sample' | 'consultation' | 'gift'>('all');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const currentUser = getStoredUser();
      setUser(currentUser);

      if (currentUser) {
        // Load transactions from wallet
        const txData = await getTransactions(1, 50);
        if (txData.transactions) {
          setTransactions(txData.transactions);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const filteredRedemptions = activeTab === 'all'
    ? redemptions
    : redemptions.filter(r => r.type === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Redemption History</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'coin', 'sample', 'consultation', 'gift'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Transactions */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : filteredRedemptions.length === 0 ? (
            <p className="text-gray-500">No redemptions yet</p>
          ) : (
            filteredRedemptions.map(record => (
              <div key={record.id} className="bg-white rounded-lg p-4 shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{record.title}</h3>
                    <p className="text-sm text-gray-500">{record.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(record.redeemedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${
                    record.status === 'completed' ? 'bg-green-100 text-green-800' :
                    record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
