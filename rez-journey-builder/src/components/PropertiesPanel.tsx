/**
 * REZ Journey Builder - Properties Panel
 * Edit properties of selected node
 */

'use client';

import React, { useState, useEffect } from 'react';
import { JourneyNode } from '../types';

interface PropertiesPanelProps {
  node: JourneyNode;
  onUpdate: (config: Record<string, unknown>) => void;
  onClose: () => void;
}

export function PropertiesPanel({ node, onUpdate, onClose }: PropertiesPanelProps) {
  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description || '');
  const [config, setConfig] = useState<Record<string, unknown>>(node.data.config);

  useEffect(() => {
    setLabel(node.data.label);
    setDescription(node.data.description || '');
    setConfig(node.data.config);
  }, [node]);

  const handleSave = () => {
    onUpdate({
      label,
      description,
      ...config,
    });
    onClose();
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-80 bg-white border-l overflow-y-auto">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Properties</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Node Type Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium uppercase
            ${node.type === 'trigger' ? 'bg-green-100 text-green-700' : ''}
            ${node.type === 'action' ? 'bg-blue-100 text-blue-700' : ''}
            ${node.type === 'condition' ? 'bg-yellow-100 text-yellow-700' : ''}
            ${node.type === 'delay' ? 'bg-purple-100 text-purple-700' : ''}
            ${node.type === 'end' ? 'bg-red-100 text-red-700' : ''}
          `}>
            {node.type}
          </span>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Type-specific config */}
        {node.type === 'trigger' && (
          <TriggerConfig config={config} updateConfig={updateConfig} />
        )}

        {node.type === 'action' && (
          <ActionConfig config={config} updateConfig={updateConfig} />
        )}

        {node.type === 'condition' && (
          <ConditionConfig config={config} updateConfig={updateConfig} />
        )}

        {node.type === 'delay' && (
          <DelayConfig config={config} updateConfig={updateConfig} />
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t p-4">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// Trigger Config
function TriggerConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Trigger Settings</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Event Type
        </label>
        <select
          value={(config.eventType as string) || ''}
          onChange={(e) => updateConfig('eventType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select event...</option>
          <option value="signup">User Signup</option>
          <option value="purchase">Purchase</option>
          <option value="cart_abandoned">Cart Abandoned</option>
          <option value="first_order">First Order</option>
          <option value="inactive_30d">Inactive 30 Days</option>
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(config.filter as boolean) || false}
            onChange={(e) => updateConfig('filter', e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          <span className="text-sm text-gray-700">Apply audience filter</span>
        </label>
      </div>
    </div>
  );
}

// Action Config
function ActionConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Action Settings</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Action Type
        </label>
        <select
          value={(config.actionType as string) || ''}
          onChange={(e) => updateConfig('actionType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select action...</option>
          <option value="email">Send Email</option>
          <option value="sms">Send SMS</option>
          <option value="push">Push Notification</option>
          <option value="whatsapp">WhatsApp Message</option>
          <option value="webhook">Call Webhook</option>
          <option value="update_profile">Update Profile</option>
        </select>
      </div>

      {(config.actionType === 'email' || config.actionType === 'sms' || config.actionType === 'whatsapp') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template
          </label>
          <select
            value={(config.template as string) || ''}
            onChange={(e) => updateConfig('template', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select template...</option>
            <option value="welcome">Welcome</option>
            <option value="offer">Special Offer</option>
            <option value="reminder">Reminder</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      )}

      {config.actionType === 'webhook' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webhook URL
          </label>
          <input
            type="url"
            value={(config.webhookUrl as string) || ''}
            onChange={(e) => updateConfig('webhookUrl', e.target.value)}
            placeholder="https://api.example.com/webhook"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

// Condition Config
function ConditionConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Condition Settings</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field
        </label>
        <select
          value={(config.field as string) || ''}
          onChange={(e) => updateConfig('field', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select field...</option>
          <option value="orderCount">Order Count</option>
          <option value="totalSpent">Total Spent</option>
          <option value="lastOrderDate">Days Since Last Order</option>
          <option value="segment">Segment</option>
          <option value="tags">Tags</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Operator
        </label>
        <select
          value={(config.operator as string) || ''}
          onChange={(e) => updateConfig('operator', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select...</option>
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="greater_than">Greater Than</option>
          <option value="less_than">Less Than</option>
          <option value="contains">Contains</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Value
        </label>
        <input
          type="text"
          value={(config.value as string) || ''}
          onChange={(e) => updateConfig('value', e.target.value)}
          placeholder="Enter value..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}

// Delay Config
function DelayConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Delay Settings</h3>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration
          </label>
          <input
            type="number"
            min="1"
            value={(config.duration as number) || 1}
            onChange={(e) => updateConfig('duration', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            value={(config.unit as string) || 'hours'}
            onChange={(e) => updateConfig('unit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
    </div>
  );
}
