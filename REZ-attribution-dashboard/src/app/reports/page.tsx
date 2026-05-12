'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Eye,
  Mail,
  Share2,
  Printer,
  RefreshCw,
} from 'lucide-react';

// Report templates
const reportTemplates = [
  {
    id: 1,
    name: 'Weekly Performance Summary',
    description: 'Overview of key metrics and campaign performance for the week',
    lastGenerated: '2024-05-11',
    frequency: 'Weekly',
  },
  {
    id: 2,
    name: 'Channel Attribution Report',
    description: 'Detailed breakdown of conversions by marketing channel',
    lastGenerated: '2024-05-10',
    frequency: 'Daily',
  },
  {
    id: 3,
    name: 'Campaign ROI Analysis',
    description: 'Return on investment analysis for all active campaigns',
    lastGenerated: '2024-05-08',
    frequency: 'Weekly',
  },
  {
    id: 4,
    name: 'Funnel Conversion Report',
    description: 'Conversion rates and dropoff analysis across funnel stages',
    lastGenerated: '2024-05-05',
    frequency: 'Monthly',
  },
  {
    id: 5,
    name: 'Audience Insights Report',
    description: 'Demographics and behavior analysis of converted users',
    lastGenerated: '2024-05-01',
    frequency: 'Monthly',
  },
];

// Weekly data
const weeklyData = [
  { week: 'Week 1', touchpoints: 2847, conversions: 1234, revenue: 92550 },
  { week: 'Week 2', touchpoints: 3120, conversions: 1456, revenue: 109200 },
  { week: 'Week 3', touchpoints: 2980, conversions: 1389, revenue: 104175 },
  { week: 'Week 4', touchpoints: 3456, conversions: 1678, revenue: 125850 },
];

// Attribution model comparison
const attributionComparison = [
  { model: 'First Touch', conversions: 2456, revenue: 184200, percentage: 28 },
  { model: 'Last Touch', conversions: 3078, revenue: 230850, percentage: 35 },
  { model: 'Linear', conversions: 1932, revenue: 144900, percentage: 22 },
  { model: 'Time Decay', conversions: 1318, revenue: 98850, percentage: 15 },
];

// Channel distribution
const channelDistribution = [
  { name: 'Paid Search', value: 35, color: '#0ea5e9' },
  { name: 'Social Media', value: 28, color: '#8b5cf6' },
  { name: 'Email', value: 20, color: '#22c55e' },
  { name: 'Display', value: 10, color: '#f59e0b' },
  { name: 'Organic', value: 7, color: '#ec4899' },
];

// Touchpoint journey
const touchpointJourney = [
  { stages: '1-2', users: 2340, percentage: 45 },
  { stages: '3-4', users: 1560, percentage: 30 },
  { stages: '5-6', users: 780, percentage: 15 },
  { stages: '7+', users: 520, percentage: 10 },
];

// Conversion by day of week
const dayOfWeekData = [
  { day: 'Mon', conversions: 234, revenue: 17550 },
  { day: 'Tue', conversions: 312, revenue: 23400 },
  { day: 'Wed', conversions: 289, revenue: 21675 },
  { day: 'Thu', conversions: 345, revenue: 25875 },
  { day: 'Fri', conversions: 398, revenue: 29850 },
  { day: 'Sat', conversions: 267, revenue: 20025 },
  { day: 'Sun', conversions: 189, revenue: 14175 },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-slate-600">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            <span className="font-medium">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState('last30days');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = (reportId: number) => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert(`Report generated successfully! Download will start shortly.`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Detailed Reports</h2>
          <p className="text-slate-500 mt-1">
            Generate and export comprehensive marketing attribution reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Report Generation Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Generate New Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="last90days">Last 90 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Report Type
            </label>
            <select className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option>Full Report</option>
              <option>Summary Only</option>
              <option>Campaign Details</option>
              <option>Channel Analysis</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Export Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => handleGenerateReport(1)}
              disabled={isGenerating}
              className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTemplates.map((report) => (
          <div
            key={report.id}
            className={`bg-white rounded-xl p-6 shadow-sm border transition-all cursor-pointer ${
              selectedReport === report.id
                ? 'border-brand-500 ring-2 ring-brand-100'
                : 'border-slate-200 hover:border-brand-300'
            }`}
            onClick={() =>
              setSelectedReport(selectedReport === report.id ? null : report.id)
            }
          >
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center">
                <FileText className="h-6 w-6 text-brand-600" />
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                {report.frequency}
              </span>
            </div>
            <h4 className="text-lg font-semibold text-slate-900 mb-2">
              {report.name}
            </h4>
            <p className="text-sm text-slate-500 mb-4">{report.description}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              Last generated: {report.lastGenerated}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateReport(report.id);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Generate
              </button>
              <button className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Eye className="h-4 w-4" />
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Weekly Performance</h3>
              <p className="text-sm text-slate-500">Conversions and revenue by week</p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="conversions" name="Conversions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Channel Distribution
              </h3>
              <p className="text-sm text-slate-500">Conversion share by channel</p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {channelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Attribution Model Comparison */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Attribution Model Comparison
            </h3>
            <p className="text-sm text-slate-500">
              Compare conversions under different attribution models
            </p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={attributionComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="model" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="conversions"
                name="Conversions"
                stackId="1"
                stroke="#0ea5e9"
                fill="#0ea5e9"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stackId="2"
                stroke="#22c55e"
                fill="#22c55e"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          {attributionComparison.map((model) => (
            <div key={model.model} className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700">{model.model}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {model.conversions.toLocaleString()}
              </p>
              <p className="text-sm text-slate-500">
                ${model.revenue.toLocaleString()}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {model.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Touchpoint Journey */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Touchpoint Journey
              </h3>
              <p className="text-sm text-slate-500">User journey length before conversion</p>
            </div>
          </div>
          <div className="space-y-4">
            {touchpointJourney.map((journey, index) => (
              <div key={journey.stages}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {journey.stages} Touchpoints
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {journey.users.toLocaleString()} users ({journey.percentage}%)
                  </span>
                </div>
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${
                      index === 0
                        ? 'bg-brand-500'
                        : index === 1
                        ? 'bg-brand-400'
                        : index === 2
                        ? 'bg-brand-300'
                        : 'bg-brand-200'
                    }`}
                    style={{ width: `${journey.percentage * 3}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Day of Week Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Performance by Day
              </h3>
              <p className="text-sm text-slate-500">Conversions by day of week</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="conversions" name="Conversions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">8,234</p>
              <p className="text-sm text-slate-500">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-50 flex items-center justify-center">
              <Target className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">4.23%</p>
              <p className="text-sm text-slate-500">Conversion Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">$28.50</p>
              <p className="text-sm text-slate-500">Avg CPA</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-danger-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">387%</p>
              <p className="text-sm text-slate-500">Overall ROI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Share & Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
            <p className="text-sm text-slate-500">Share or print reports</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
