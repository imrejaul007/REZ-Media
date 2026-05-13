'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Building,
  Megaphone,
  Settings,
  Shield,
} from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import StatusBadge from '@/components/StatusBadge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/Table';
import { getAuditLogs } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: 'merchant' | 'campaign' | 'user' | 'system';
  entityId: string;
  performedBy: string;
  performedAt: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  ipAddress: string;
}

// Mock data for demonstration
const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    action: 'Merchant Approved',
    entityType: 'merchant',
    entityId: 'merchant_123',
    performedBy: 'admin@rez-media.com',
    performedAt: '2026-05-13T10:30:00Z',
    changes: { status: { old: 'pending', new: 'approved' } },
    ipAddress: '192.168.1.100',
  },
  {
    id: '2',
    action: 'Campaign Activated',
    entityType: 'campaign',
    entityId: 'campaign_456',
    performedBy: 'admin@rez-media.com',
    performedAt: '2026-05-13T09:45:00Z',
    changes: { status: { old: 'draft', new: 'active' } },
    ipAddress: '192.168.1.100',
  },
  {
    id: '3',
    action: 'Merchant Suspended',
    entityType: 'merchant',
    entityId: 'merchant_789',
    performedBy: 'superadmin@rez-media.com',
    performedAt: '2026-05-13T08:15:00Z',
    changes: { status: { old: 'approved', new: 'suspended' }, reason: { old: null, new: 'Violation of terms' } },
    ipAddress: '192.168.1.101',
  },
  {
    id: '4',
    action: 'Campaign Budget Updated',
    entityType: 'campaign',
    entityId: 'campaign_234',
    performedBy: 'merchant@techcorp.com',
    performedAt: '2026-05-12T16:20:00Z',
    changes: { budget: { old: 10000, new: 15000 } },
    ipAddress: '10.0.0.50',
  },
  {
    id: '5',
    action: 'System Configuration Changed',
    entityType: 'system',
    entityId: 'config_001',
    performedBy: 'superadmin@rez-media.com',
    performedAt: '2026-05-12T14:00:00Z',
    changes: { payment_gateway: { old: 'stripe', new: 'razorpay' } },
    ipAddress: '192.168.1.101',
  },
  {
    id: '6',
    action: 'Merchant Registration',
    entityType: 'merchant',
    entityId: 'merchant_012',
    performedBy: 'system',
    performedAt: '2026-05-12T12:30:00Z',
    changes: { email_verified: { old: false, new: true } },
    ipAddress: '127.0.0.1',
  },
  {
    id: '7',
    action: 'Campaign Paused',
    entityType: 'campaign',
    entityId: 'campaign_567',
    performedBy: 'merchant@fashionhub.com',
    performedAt: '2026-05-12T10:00:00Z',
    changes: { status: { old: 'active', new: 'paused' } },
    ipAddress: '10.0.0.25',
  },
  {
    id: '8',
    action: 'User Login',
    entityType: 'user',
    entityId: 'user_789',
    performedBy: 'admin@rez-media.com',
    performedAt: '2026-05-12T09:00:00Z',
    changes: { method: { old: null, new: 'password' } },
    ipAddress: '192.168.1.100',
  },
  {
    id: '9',
    action: 'Campaign Rejected',
    entityType: 'campaign',
    entityId: 'campaign_890',
    performedBy: 'admin@rez-media.com',
    performedAt: '2026-05-11T18:45:00Z',
    changes: { status: { old: 'pending', new: 'rejected' }, reason: { old: null, new: 'Policy violation' } },
    ipAddress: '192.168.1.100',
  },
  {
    id: '10',
    action: 'Payment Processed',
    entityType: 'system',
    entityId: 'payment_123',
    performedBy: 'system',
    performedAt: '2026-05-11T15:30:00Z',
    changes: { amount: { old: null, new: 2500 }, status: { old: null, new: 'completed' } },
    ipAddress: '127.0.0.1',
  },
  {
    id: '11',
    action: 'Merchant KYC Updated',
    entityType: 'merchant',
    entityId: 'merchant_345',
    performedBy: 'merchant@healthco.com',
    performedAt: '2026-05-11T12:00:00Z',
    changes: { kyc_status: { old: 'pending', new: 'verified' } },
    ipAddress: '10.0.0.75',
  },
  {
    id: '12',
    action: 'Admin Role Assigned',
    entityType: 'user',
    entityId: 'user_456',
    performedBy: 'superadmin@rez-media.com',
    performedAt: '2026-05-11T10:30:00Z',
    changes: { role: { old: 'viewer', new: 'editor' } },
    ipAddress: '192.168.1.101',
  },
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const entityIcons: Record<string, React.ReactNode> = {
  merchant: <Building className="h-4 w-4" />,
  campaign: <Megaphone className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
};

const entityColors: Record<string, string> = {
  merchant: 'bg-blue-100 text-blue-600',
  campaign: 'bg-green-100 text-green-600',
  user: 'bg-purple-100 text-purple-600',
  system: 'bg-slate-100 text-slate-600',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const logsPerPage = 10;

  useEffect(() => {
    async function fetchLogs() {
      try {
        const response = await getAuditLogs({
          entityType: entityFilter !== 'all' ? entityFilter : undefined,
        });
        if (response.success) {
          setLogs(response.data.logs);
        }
      } catch {
        setLogs(mockAuditLogs);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, [entityFilter]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.performedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );

  const actionCounts = {
    all: logs.length,
    merchant: logs.filter((l) => l.entityType === 'merchant').length,
    campaign: logs.filter((l) => l.entityType === 'campaign').length,
    user: logs.filter((l) => l.entityType === 'user').length,
    system: logs.filter((l) => l.entityType === 'system').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
          <p className="mt-1 text-slate-500">
            Track all platform activities, changes, and admin actions
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-3 rounded-lg bg-primary-50 p-4 text-primary-700">
        <Shield className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm">
          All actions performed on the REZ Admin platform are logged and audited. Logs are retained for 365 days.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'all', label: 'All', count: actionCounts.all },
          { key: 'merchant', label: 'Merchants', count: actionCounts.merchant },
          { key: 'campaign', label: 'Campaigns', count: actionCounts.campaign },
          { key: 'user', label: 'Users', count: actionCounts.user },
          { key: 'system', label: 'System', count: actionCounts.system },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setEntityFilter(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              entityFilter === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by action, user, or entity ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <select className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200">
          <option>All Time</option>
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
        </select>
      </div>

      {/* Logs Table */}
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead>Timestamp</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Performed By</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedLogs.map((log) => (
            <TableRow
              key={log.id}
              onClick={() => setSelectedLog(log)}
              hoverable
            >
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {formatDate(log.performedAt)}
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium text-slate-900">{log.action}</p>
                <p className="text-xs text-slate-500">ID: {log.entityId}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full p-1.5 ${entityColors[log.entityType]}`}
                  >
                    {entityIcons[log.entityType]}
                  </span>
                  <span className="text-sm capitalize text-slate-700">
                    {log.entityType}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm text-slate-700">{log.performedBy}</p>
                <p className="text-xs text-slate-500">{log.ipAddress}</p>
              </TableCell>
              <TableCell>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLog(log);
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  View Changes
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * logsPerPage + 1} to{' '}
            {Math.min(currentPage * logsPerPage, filteredLogs.length)} of{' '}
            {filteredLogs.length} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedLog.action}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Log ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <svg
                  className="h-5 w-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Entity Type</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full p-1.5 ${entityColors[selectedLog.entityType]}`}
                    >
                      {entityIcons[selectedLog.entityType]}
                    </span>
                    <span className="font-medium capitalize">
                      {selectedLog.entityType}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Entity ID</p>
                  <p className="mt-1 font-medium">{selectedLog.entityId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Performed By</p>
                  <p className="mt-1 font-medium">{selectedLog.performedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">IP Address</p>
                  <p className="mt-1 font-medium">{selectedLog.ipAddress}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Timestamp</p>
                  <p className="mt-1 font-medium">
                    {formatDate(selectedLog.performedAt)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Changes Made</p>
                <div className="rounded-lg bg-slate-50 p-4">
                  {Object.entries(selectedLog.changes).map(([key, change]) => (
                    <div key={key} className="mb-3 last:mb-0">
                      <p className="text-xs font-medium uppercase text-slate-500">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-sm text-red-700">
                          <span className="mr-1">-</span>
                          {String(change.old ?? 'null')}
                        </span>
                        <span className="text-slate-400">to</span>
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-sm text-green-700">
                          <span className="mr-1">+</span>
                          {String(change.new ?? 'null')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
