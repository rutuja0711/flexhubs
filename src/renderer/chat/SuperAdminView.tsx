import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FiGrid,
  FiLogOut,
  FiMessageSquare,
  FiRefreshCw,
  FiUsers,
} from 'react-icons/fi';
import type { SuperAdminOrganization, SuperAdminStats } from '../../shared/superadmin';
import {
  loadSuperAdminOrganizations,
  loadSuperAdminStats,
  suspendSuperAdminOrganization,
} from '../superadminApi';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { AppLogoHorizontal } from '../brand/AppLogo';
import { BuildingIcon } from './ChatIcons';

type SuperAdminTab = 'overview' | 'organizations';

type SuperAdminViewProps = {
  user: unknown;
  onUnauthorized: (status?: number) => boolean;
  onLogout: () => void;
  onExitSuperAdmin: () => void;
};

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.06] bg-[#141414] p-6">
      <div className="mb-8 flex items-start justify-between">
        <div className="h-4 w-28 rounded bg-white/10" />
        <div className="h-11 w-11 rounded-xl bg-white/10" />
      </div>
      <div className="h-9 w-20 rounded bg-white/10" />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-[#141414] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-accent/20 hover:bg-[#171717]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="text-sm font-medium text-white/55">{label}</div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/20 transition-transform duration-200 group-hover:scale-105">
          {icon}
        </div>
      </div>
      <div className="text-[2.35rem] font-bold leading-none tracking-tight text-white">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StatusBadge({ status, suspended }: { status: string; suspended: boolean }) {
  const active = !suspended && status.toLowerCase() === 'active';

  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400'
          : 'inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300'
      }
    >
      {active ? 'Active' : status}
    </span>
  );
}

function PageHeader({
  title,
  description,
  lastUpdated,
  isLoading,
  onRefresh,
}: {
  title: string;
  description: string;
  lastUpdated: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.75rem] font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/45">
          {description}
          {lastUpdated ? (
            <>
              {' '}
              Last updated <span className="text-white/65">{lastUpdated}</span>.
            </>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiRefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
        Refresh
      </button>
    </div>
  );
}

export function SuperAdminView({
  onUnauthorized,
  onLogout,
  onExitSuperAdmin,
}: SuperAdminViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<SuperAdminTab>('overview');
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState('');
  const [organizationsUpdatedAt, setOrganizationsUpdatedAt] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  const pageLabel = useMemo(() => {
    if (total === 0) {
      return 'Showing 0 organizations';
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `Showing ${start}–${end} of ${total}`;
  }, [page, pageSize, total]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');

    const result = await loadSuperAdminStats();

    setStatsLoading(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }

      setStatsError(result.error);
      return;
    }

    setStats(result.data);
    setStatsUpdatedAt(new Date());
  }, [onUnauthorized]);

  const loadOrganizations = useCallback(async () => {
    setOrganizationsLoading(true);
    setOrganizationsError('');

    const result = await loadSuperAdminOrganizations(page, pageSize);

    setOrganizationsLoading(false);

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }

      setOrganizationsError(result.error);
      return;
    }

    setOrganizations(result.data.items);
    setTotal(result.data.total);
    setTotalPages(result.data.totalPages);
    setOrganizationsUpdatedAt(new Date());
  }, [onUnauthorized, page, pageSize]);

  useEffect(() => {
    if (tab === 'overview') {
      void loadStats();
    }
  }, [loadStats, tab]);

  useEffect(() => {
    if (tab === 'organizations') {
      void loadOrganizations();
    }
  }, [loadOrganizations, tab]);

  const handleRefresh = () => {
    if (tab === 'overview') {
      void loadStats();
      return;
    }

    void loadOrganizations();
  };

  const handleSuspend = async (organization: SuperAdminOrganization) => {
    if (organization.suspended) {
      toast.info('This organization is already suspended.');
      return;
    }

    const confirmed = await confirm({
      title: 'Suspend organization?',
      message: `Suspend "${organization.name}"? Members will lose access until it is restored.`,
      confirmLabel: 'Suspend',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setSuspendingId(organization.id);

    const result = await suspendSuperAdminOrganization(organization.id);

    setSuspendingId(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }

      toast.error(result.error);
      return;
    }

    toast.success(`${organization.name} suspended.`);
    void loadOrganizations();
    if (stats) {
      void loadStats();
    }
  };

  const lastUpdated =
    tab === 'overview'
      ? statsUpdatedAt
        ? formatUpdatedAt(statsUpdatedAt)
        : null
      : organizationsUpdatedAt
        ? formatUpdatedAt(organizationsUpdatedAt)
        : null;

  const isLoading = tab === 'overview' ? statsLoading : organizationsLoading;
  const error = tab === 'overview' ? statsError : organizationsError;

  const navButtonClass = (active: boolean) =>
    active
      ? 'border border-accent/25 bg-accent/10 text-accent-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'border border-transparent text-white/70 hover:bg-white/[0.04] hover:text-white';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-[#0a0a0a] text-white">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0d0d] px-4 py-6">
        <div className="mb-8 px-2">
          <AppLogoHorizontal className="h-8 w-auto max-w-[160px]" />
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">
            Super Admin
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${navButtonClass(tab === 'overview')}`}
          >
            <FiGrid className="shrink-0" size={16} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab('organizations')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${navButtonClass(tab === 'organizations')}`}
          >
            <BuildingIcon />
            Organizations
          </button>
        </nav>

        <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={onExitSuperAdmin}
            className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/75"
          >
            Back to app
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <FiLogOut className="shrink-0" size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">
          <PageHeader
            title={tab === 'overview' ? 'Platform overview' : 'Organizations'}
            description={
              tab === 'overview'
                ? 'Live counts from the database. Refresh to update — not streamed in real time.'
                : 'View all workspaces and suspend or restore access. 10 per page, server-side.'
            }
            lastUpdated={lastUpdated}
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {tab === 'overview' ? (
            statsLoading && !stats ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 gap-5 lg:grid-cols-3 ${statsLoading ? 'opacity-70' : ''}`}
              >
                <StatCard
                  label="Total users"
                  value={stats?.totalUsers ?? 0}
                  icon={<FiUsers size={18} />}
                />
                <StatCard
                  label="Total organizations"
                  value={stats?.totalOrganizations ?? 0}
                  icon={<BuildingIcon />}
                />
                <StatCard
                  label="Total messages"
                  value={stats?.totalMessages ?? 0}
                  icon={<FiMessageSquare size={18} />}
                />
              </div>
            )
          ) : organizationsLoading && organizations.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141414]">
              <div className="animate-pulse space-y-0">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex gap-4 border-b border-white/[0.04] px-5 py-4 last:border-b-0"
                  >
                    <div className="h-4 flex-1 rounded bg-white/10" />
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="h-4 w-16 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={`overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141414] shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${organizationsLoading ? 'opacity-70' : ''}`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs uppercase tracking-[0.08em] text-white/40">
                      <th className="px-5 py-3.5 font-semibold">Name</th>
                      <th className="px-5 py-3.5 font-semibold">Slug</th>
                      <th className="px-5 py-3.5 font-semibold">Plan</th>
                      <th className="px-5 py-3.5 font-semibold">Members</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((organization) => (
                      <tr
                        key={organization.id}
                        className="border-b border-white/[0.04] transition-colors last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-4 font-medium text-white">{organization.name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-white/45">{organization.slug}</td>
                        <td className="px-5 py-4 text-white/80">{organization.plan}</td>
                        <td className="px-5 py-4 text-white/80">{organization.memberCount}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={organization.status} suspended={organization.suspended} />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            disabled={organization.suspended || suspendingId === organization.id}
                            onClick={() => void handleSuspend(organization)}
                            className="text-sm font-semibold text-accent-soft transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {suspendingId === organization.id ? 'Suspending…' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {organizations.length === 0 && !organizationsLoading ? (
                <div className="px-5 py-12 text-center text-sm text-white/45">No organizations found.</div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
                <div className="text-sm text-white/45">{pageLabel}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || organizationsLoading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.04] disabled:opacity-35"
                  >
                    &lt; Previous
                  </button>
                  <span className="px-2 text-sm text-white/45">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || organizationsLoading}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.04] disabled:opacity-35"
                  >
                    Next &gt;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
