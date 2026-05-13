'use client';

import clsx from 'clsx';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx('overflow-x-auto rounded-lg ring-1 ring-slate-200', className)}>
      <table className="min-w-full divide-y divide-slate-200 bg-white">{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <thead className={clsx('bg-slate-50', className)}>
      {children}
    </thead>
  );
}

export function TableHead({ children, className }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={clsx(
        'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children, className }: TableBodyProps) {
  return <tbody className={clsx('divide-y divide-slate-200', className)}>{children}</tbody>;
}

export function TableRow({ children, className, onClick, hoverable = true }: TableRowProps) {
  return (
    <tr
      className={clsx(
        hoverable && 'hover:bg-slate-50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className }: TableCellProps) {
  return (
    <td className={clsx('whitespace-nowrap px-6 py-4 text-sm text-slate-900', className)}>
      {children}
    </td>
  );
}
