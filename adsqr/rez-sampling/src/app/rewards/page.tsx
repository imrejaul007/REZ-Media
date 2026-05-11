'use client';

import React, { useState, useEffect } from 'react';
import { getStoredUser } from '@/lib/rezAuth';
import RedemptionQR from '@/components/RedemptionQR';

interface Reward {
  id: string;
  type: 'coin' | 'sample' | 'consultation' | 'discount';
  title: string;
  description: string;
  value: number;
  status: 'available' | 'pending' | 'redeemed' | 'expired';
  expiresAt?: string;
  earnedAt: string;
}

export default function RewardsPage() {
  const [user, setUser] = useState<any>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'redeemed'>('available');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const currentUser = getStoredUser();
      setUser(currentUser);
      setBalance(1000); // Demo balance
      setRewards([]); // Demo rewards
      setLoading(false);
    } catch (error) {
      console.error('Failed to load:', error);
      setLoading(false);
    }
  };

  const filteredRewards = activeTab === 'available'
    ? rewards.filter(r => r.status === 'available')
    : rewards.filter(r => r.status === 'redeemed');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Your Rewards</h1>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-8">
          <p className="text-sm opacity-80">Total Balance</p>
          <p className="text-4xl font-bold">{balance} coins</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'available' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Available ({rewards.filter(r => r.status === 'available').length})
          </button>
          <button
            onClick={() => setActiveTab('redeemed')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'redeemed' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Redeemed ({rewards.filter(r => r.status === 'redeemed').length})
          </button>
        </div>

        {/* Rewards List */}
        <div className="space-y-4">
          {filteredRewards.length === 0 ? (
            <p className="text-gray-500">No rewards yet. Keep scanning!</p>
          ) : (
            filteredRewards.map(reward => (
              <div key={reward.id} className="bg-white rounded-xl p-4 shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{reward.title}</h3>
                    <p className="text-sm text-gray-500">{reward.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Earned: {new Date(reward.earnedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-indigo-600">{reward.value}</p>
                    <button
                      onClick={() => setSelectedReward(reward)}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View QR
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* QR Modal */}
        {selectedReward && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-4">{selectedReward.title}</h3>
              <RedemptionQR
                rewardId={selectedReward.id}
                rewardType={selectedReward.type}
                rewardName={selectedReward.title}
                expiresAt={selectedReward.expiresAt}
              />
              <button
                onClick={() => setSelectedReward(null)}
                className="mt-4 w-full py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
