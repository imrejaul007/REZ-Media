/**
 * REZ Journey Builder - Toolbar Component
 * Top toolbar with save, publish, and journey info
 */

'use client';

import React, { useState } from 'react';

interface JourneyToolbarProps {
  journeyName: string;
  onSave: () => void;
  onPublish: () => void;
  readOnly?: boolean;
}

export function JourneyToolbar({
  journeyName,
  onSave,
  onPublish,
  readOnly = false,
}: JourneyToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">JB</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{journeyName}</h1>
            <p className="text-xs text-gray-500">Journey Builder</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {readOnly ? (
          <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
            Read Only
          </span>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              Save Draft
            </button>

            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isPublishing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              Publish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
