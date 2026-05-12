'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface AttributionModel {
  name: string;
  value: number;
  color: string;
  conversions?: number;
  revenue?: number;
}

interface AttributionBreakdownProps {
  data: AttributionModel[];
  title?: string;
  subtitle?: string;
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const defaultColors = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];

export default function AttributionBreakdown({
  data,
  title = 'Attribution Breakdown',
  subtitle,
  height = 400,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 100,
}: AttributionBreakdownProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || defaultColors[index % defaultColors.length],
  }));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              labelLine={{
                stroke: '#94a3b8',
                strokeWidth: 1,
                lineCoords: [
                  { x1: 0, y1: 0, x2: 0, y2: -10 },
                ],
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as AttributionModel;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: item.color }}
                        />
                        Share: {item.value}%
                      </p>
                      {item.conversions !== undefined && (
                        <p className="text-sm text-slate-600">
                          Conversions: {item.conversions.toLocaleString()}
                        </p>
                      )}
                      {item.revenue !== undefined && (
                        <p className="text-sm text-slate-600">
                          Revenue: ${item.revenue.toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {showLegend && (
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-sm text-slate-600">{value}</span>
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {chartData.map((model) => (
          <div
            key={model.name}
            className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: model.color }}
              />
              <span className="text-sm font-medium text-slate-700">{model.name}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">{model.value}%</p>
                {model.conversions !== undefined && (
                  <p className="text-xs text-slate-500">
                    {model.conversions.toLocaleString()} conversions
                  </p>
                )}
              </div>
              <div
                className="h-8 rounded"
                style={{
                  width: `${model.value * 2}px`,
                  backgroundColor: `${model.color}20`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example usage data
export const attributionData: AttributionModel[] = [
  { name: 'First Touch', value: 28, color: '#0ea5e9', conversions: 2456, revenue: 184200 },
  { name: 'Last Touch', value: 35, color: '#8b5cf6', conversions: 3078, revenue: 230850 },
  { name: 'Linear', value: 22, color: '#22c55e', conversions: 1932, revenue: 144900 },
  { name: 'Time Decay', value: 15, color: '#f59e0b', conversions: 1318, revenue: 98850 },
];
