'use client';

import clsx from 'clsx';

type Status = 'pending' | 'approved' | 'rejected' | 'suspended' | 'active' | 'paused' | 'completed' | 'draft';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 ring-green-600/20',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 ring-red-600/20',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-slate-100 text-slate-800 ring-slate-600/20',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800 ring-green-600/20',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  },
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-800 ring-slate-600/20',
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
