'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface RedemptionQRProps {
  rewardId: string;
  rewardType: 'coin' | 'sample' | 'consultation' | 'gift' | 'discount';
  rewardName: string;
  expiresAt?: string;
  onScan?: (data: string) => void;
}

export default function RedemptionQR({
  rewardId,
  rewardType,
  rewardName,
  expiresAt,
  onScan,
}: RedemptionQRProps) {
  const [qrData, setQrData] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const generateQRData = () => {
      setIsGenerating(true);
      const data = JSON.stringify({
        type: 'redemption',
        rewardType,
        rewardId,
        rewardName,
        generatedAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
      });
      setQrData(btoa(data));
      setIsGenerating(false);
    };

    generateQRData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardId]);

  return (
    <div className="text-center p-6">
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-48 h-48 bg-gray-200 animate-pulse rounded-lg" />
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Generating...</p>
        </div>
      ) : (
        <Image
          src={`data:text/plain;base64,${qrData}`}
          alt="Redemption QR Code"
          width={180}
          height={180}
          style={{ objectFit: 'contain' }}
          unoptimized
        />
      )}
      <p className="mt-4 text-sm text-gray-600">{rewardName}</p>
      <p className="text-xs text-gray-400">
        {rewardType.charAt(0).toUpperCase() + rewardType.slice(1)} Reward
      </p>
    </div>
  );
}
