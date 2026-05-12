'use client';

import React from 'react';
import {
  FunnelChart as RechartsFunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface FunnelStage {
  stage: string;
  count: number;
  fill?: string;
}

interface FunnelChartProps {
  data: FunnelStage[];
  title?: string;
  subtitle?: string;
  height?: number;
}

const defaultColors = [
  '#0ea5e9',
  '#06b6d4',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
];

export default function FunnelChart({
  data,
  title = 'Conversion Funnel',
  subtitle,
  height = 400,
}: FunnelChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: item.fill || defaultColors[index % defaultColors.length],
  }));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsFunnelChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as FunnelStage;
                  const conversionRate =
                    data.count > 0 && data.count !== chartData[0]?.count
                      ? ((data.count / chartData[0].count) * 100).toFixed(1)
                      : '100';
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-900">
                        {data.stage}
                      </p>
                      <p className="text-sm text-slate-600">
                        Count: {data.count.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-600">
                        Conversion: {conversionRate}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Funnel
              dataKey="count"
              data={chartData}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            >
              <LabelList
                position="center"
                fill="#fff"
                stroke="none"
                dataKey="stage"
                className="fill-white"
                style={{ fontSize: '12px', fontWeight: 500 }}
              />
              <LabelList
                position="right"
                fill="#475569"
                stroke="none"
                dataKey="count"
                formatter={(value: number) => value.toLocaleString()}
                style={{ fontSize: '14px', fontWeight: 600 }}
              />
            </Funnel>
          </RechartsFunnelChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-3">
        {chartData.map((stage, index) => {
          const dropoff =
            index < chartData.length - 1 && chartData[0].count > 0
              ? (
                  ((chartData[index].count - chartData[index + 1].count) /
                    chartData[index].count) *
                  100
                ).toFixed(1)
              : null;

          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: stage.fill }}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {stage.stage}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(stage.count / chartData[0].count) * 100}%`,
                      backgroundColor: stage.fill,
                    }}
                  />
                </div>
              </div>
              {dropoff && (
                <span className="text-xs text-danger-500 font-medium">
                  -{dropoff}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Example usage data
export const funnelData: FunnelStage[] = [
  { stage: 'Impressions', count: 125000 },
  { stage: 'Clicks', count: 8750 },
  { stage: 'Landing Page', count: 6230 },
  { stage: 'Add to Cart', count: 2890 },
  { stage: 'Checkout', count: 1567 },
  { stage: 'Conversion', count: 892 },
];
