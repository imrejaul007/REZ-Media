'use client'

import { useState } from 'react'
import {
  Plus,
  Trash2,
  GripVertical,
  Users,
  Activity,
  Tag,
  Calendar,
  Mail,
  ChevronDown,
  Copy,
  Edit,
} from 'lucide-react'
import { Segment, SegmentRule, ContactStatus, LeadSource } from '@/types'

interface SegmentBuilderProps {
  segment?: Segment
  onSave?: (segment: Omit<Segment, 'id' | 'createdAt' | 'updatedAt' | 'contactCount'>) => void
  onCancel?: () => void
}

const fieldOptions = [
  { value: 'status', label: 'Status', type: 'select', options: ['hot', 'warm', 'cold', 'active', 'churned'] },
  { value: 'tags', label: 'Tags', type: 'multi-select', options: ['hotel', 'restaurant', 'retail', 'fitness', 'premium', 'enterprise'] },
  { value: 'leadSource', label: 'Lead Source', type: 'select', options: ['website', 'referral', 'social', 'campaign', 'other'] },
  { value: 'lastContact', label: 'Last Contact', type: 'date' },
  { value: 'createdAt', label: 'Created Date', type: 'date' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'company', label: 'Company', type: 'text' },
  { value: 'firstName', label: 'First Name', type: 'text' },
  { value: 'lastName', label: 'Last Name', type: 'text' },
]

const operatorLabels: Record<string, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'is after',
  less_than: 'is before',
  in: 'is any of',
  not_in: 'is not any of',
}

const operatorsByType: Record<string, string[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with'],
  select: ['equals', 'not_equals', 'in', 'not_in'],
  'multi-select': ['contains', 'not_contains'],
  date: ['greater_than', 'less_than'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than'],
}

export default function SegmentBuilder({ segment, onSave, onCancel }: SegmentBuilderProps) {
  const [name, setName] = useState(segment?.name || '')
  const [description, setDescription] = useState(segment?.description || '')
  const [logic, setLogic] = useState<'and' | 'or'>(segment?.logic || 'and')
  const [rules, setRules] = useState<SegmentRule[]>(
    segment?.rules || [{ id: '1', field: '', operator: 'equals', value: '' }]
  )
  const [isActive, setIsActive] = useState(segment?.isActive ?? true)

  const addRule = () => {
    setRules([
      ...rules,
      { id: String(Date.now()), field: '', operator: 'equals', value: '' },
    ])
  }

  const removeRule = (id: string) => {
    if (rules.length > 1) {
      setRules(rules.filter((r) => r.id !== id))
    }
  }

  const updateRule = (id: string, updates: Partial<SegmentRule>) => {
    setRules(
      rules.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates }
          // Reset operator if field type changes
          if (updates.field) {
            const field = fieldOptions.find((f) => f.value === updates.field)
            const validOperators = operatorsByType[field?.type || 'text']
            if (!validOperators.includes(updated.operator)) {
              updated.operator = validOperators[0] as SegmentRule['operator']
            }
            updated.value = ''
          }
          return updated
        }
        return r
      })
    )
  }

  const getFieldType = (fieldValue: string) => {
    const field = fieldOptions.find((f) => f.value === fieldValue)
    return field?.type || 'text'
  }

  const getFieldOptions = (fieldValue: string) => {
    const field = fieldOptions.find((f) => f.value === fieldValue)
    return field?.options || []
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a segment name')
      return
    }

    const validRules = rules.filter((r) => r.field && r.value)
    if (validRules.length === 0) {
      alert('Please add at least one valid rule')
      return
    }

    onSave?.({
      name: name.trim(),
      description: description.trim(),
      rules: validRules,
      logic,
      isActive,
    })
  }

  const duplicateRule = (rule: SegmentRule) => {
    setRules([
      ...rules,
      { ...rule, id: String(Date.now()) },
    ])
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {segment ? 'Edit Segment' : 'Create New Segment'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Define rules to group contacts based on their attributes
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Name & Description */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Segment Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hot Leads in Mumbai"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this segment..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Logic Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Match
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setLogic('and')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                logic === 'and'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              All rules (AND)
            </button>
            <button
              onClick={() => setLogic('or')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                logic === 'or'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              Any rule (OR)
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {logic === 'and'
              ? 'Contacts must match ALL rules to be included'
              : 'Contacts matching ANY rule will be included'}
          </p>
        </div>

        {/* Rules */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rules
          </label>
          <div className="space-y-3">
            {rules.map((rule, idx) => {
              const fieldType = getFieldType(rule.field)
              const validOperators = operatorsByType[fieldType] || operatorsByType.text
              const fieldOptionsList = getFieldOptions(rule.field)

              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg group"
                >
                  <div className="text-gray-400 cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Field */}
                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select field...</option>
                    {fieldOptions.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      updateRule(rule.id, { operator: e.target.value as SegmentRule['operator'] })
                    }
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {validOperators.map((op) => (
                      <option key={op} value={op}>
                        {operatorLabels[op]}
                      </option>
                    ))}
                  </select>

                  {/* Value */}
                  {fieldType === 'select' && (
                    <select
                      value={rule.value as string}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select value...</option>
                      {fieldOptionsList.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {fieldType === 'multi-select' && (
                    <div className="flex-1 flex flex-wrap gap-1">
                      {fieldOptionsList.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const currentValues = Array.isArray(rule.value) ? rule.value : []
                            const newValues = currentValues.includes(opt)
                              ? currentValues.filter((v) => v !== opt)
                              : [...currentValues, opt]
                            updateRule(rule.id, { value: newValues })
                          }}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            (Array.isArray(rule.value) && rule.value.includes(opt))
                              ? 'bg-purple-100 border-purple-300 text-purple-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {fieldType === 'text' && (
                    <input
                      type="text"
                      value={rule.value as string}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      placeholder="Enter value..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}

                  {fieldType === 'date' && (
                    <input
                      type="date"
                      value={rule.value as string}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => duplicateRule(rule)}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                      title="Duplicate rule"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                      title="Remove rule"
                      disabled={rules.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={addRule}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {/* Status */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                isActive ? 'bg-purple-600' : 'bg-gray-200'
              }`}
              onClick={() => setIsActive(!isActive)}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {isActive
              ? 'This segment will be available for use'
              : 'This segment is saved but not being used'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          {segment ? 'Update Segment' : 'Create Segment'}
        </button>
      </div>
    </div>
  )
}

// Segment Card for listing
interface SegmentCardProps {
  segment: Segment
  onEdit?: () => void
  onDelete?: () => void
}

export function SegmentCard({ segment, onEdit, onDelete }: SegmentCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-purple-200 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{segment.name}</h3>
            {segment.description && (
              <p className="text-sm text-gray-500">{segment.description}</p>
            )}
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            segment.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {segment.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{segment.contactCount} contacts</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4" />
          <span>{segment.rules.length} rules</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {segment.rules.slice(0, 3).map((rule, idx) => {
          const field = fieldOptions.find((f) => f.value === rule.field)
          return (
            <span
              key={rule.id}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
            >
              {field?.label || rule.field} {operatorLabels[rule.operator]}{' '}
              {Array.isArray(rule.value)
                ? rule.value.join(', ')
                : String(rule.value)}
            </span>
          )
        })}
        {segment.rules.length > 3 && (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
            +{segment.rules.length - 3} more
          </span>
        )}
      </div>

      <div className="flex justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          Updated {new Date(segment.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-purple-600"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
