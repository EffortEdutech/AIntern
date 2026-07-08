/**
 * WorkLedger - Work Entry List Page
 *
 * SESSION 10: Org switching wired via useOrganization()
 * SESSION 15: Source tabs — All | Internal | Subcontractor
 * SESSION 16: Approval tab for managers
 * SESSION 19: Clean online/offline separation.
 * SESSION 21: Local drafts merged inline — IndexedDB entries without a
 *   remoteId are now shown at the top of the list as "Local Draft" cards.
 *   A permanent "Local Drafts" link is always visible in the header so
 *   users can always navigate to /work/offline to manage or submit drafts.
 *
 *   OFFLINE STATE:
 *     Shows a full-screen offline message with link to /work/offline.
 *     Does NOT show server entries (they're stale and confusing offline).
 *
 *   ONLINE STATE:
 *     Shows server entries from Supabase.
 *     Shows local drafts (unsynced, IndexedDB-only) at the top of the list.
 *     Permanent "Local Drafts" link always visible in header.
 *
 * @module pages/workEntries/WorkEntryListPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }    from 'react-router-dom';
import AppLayout                from '../../components/layout/AppLayout';
import WorkEntryList            from '../../components/workEntries/WorkEntryList';
import Button                   from '../../components/common/Button';
import { workEntryService }     from '../../services/api/workEntryService';
import { contractService }      from '../../services/api/contractService';
import { subcontractorService } from '../../services/api/subcontractorService';
import { useOrganization }      from '../../context/OrganizationContext';
import { useRole }              from '../../hooks/useRole';
import { useOffline }           from '../../hooks/useOffline';
import { db }                   from '../../services/offline/db';
import { PlusIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../context/ToastContext';

// ── Source Tab ────────────────────────────────────────────────────────────────
function SourceTab({ label, active, onClick, badge = null }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
        border-b-2 whitespace-nowrap transition-colors flex-shrink-0
        ${active
      ? 'border-primary-600 text-primary-700'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
      `}
    >
      {label}
      {badge !== null && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Local Draft Card ──────────────────────────────────────────────────────────
// Renders IndexedDB entries that have not yet been pushed to Supabase.
function LocalDraftCard({ entry, contractName, templateName, onEdit }) {
  const dateLabel = entry.entry_date
    ? new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-MY', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '—';

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex-shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            ● Local Draft
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {dateLabel}{entry.shift ? ` (${entry.shift} shift)` : ''}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {contractName || entry.contract_id || 'Unknown contract'}
          </p>
          {templateName && (
            <p className="text-xs text-gray-400 truncate">{templateName}</p>
          )}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="flex-shrink-0 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        Open →
      </button>
    </div>
  );
}

// ── Offline redirect view ─────────────────────────────────────────────────────
function OfflineRedirectView({ pendingCount }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <span className="text-5xl mb-4">📡</span>
      <h2 className="text-xl font-bold text-gray-900 mb-2">You are offline</h2>
      <p className="text-sm text-gray-600 mb-8 max-w-xs">
        Server entries are not available offline. Work with your locally saved drafts instead.
      </p>

      <Link
        to="/work/offline"
        className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-sm text-center transition-colors block mb-3"
      >
        {pendingCount > 0
          ? `📋 View ${pendingCount} Local Draft${pendingCount > 1 ? 's' : ''}`
          : '📋 My Local Drafts'}
      </Link>

      <Link
        to="/work/new"
        className="w-full max-w-xs py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl text-sm text-center transition-colors block"
      >
        + New Entry (Offline)
      </Link>

      <p className="text-xs text-gray-400 mt-6">
        Server entries will appear here when you reconnect.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkEntryListPage() {
  const toast = useToast();
  const navigate        = useNavigate();
  const { currentOrg }  = useOrganization();
  const { can }         = useRole();
  const { isOnline, pendingCount } = useOffline();

  const [workEntries,          setWorkEntries]          = useState([]);
  const [localDrafts,          setLocalDrafts]          = useState([]);
  const [localContractMap,     setLocalContractMap]     = useState({});
  const [localTemplateMap,     setLocalTemplateMap]     = useState({});
  const [contracts,            setContracts]            = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);
  const [sourceTab,            setSourceTab]            = useState('all');
  const [subcontractorOrgIds,  setSubcontractorOrgIds]  = useState([]);
  const [hasSubcontractors,    setHasSubcontractors]    = useState(false);
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);

  const [filters, setFilters] = useState({
    contractId: '', status: '', startDate: '', endDate: '', sortOrder: 'desc'
  });

  const canCreate  = can('CREATE_WORK_ENTRY');
  const canApprove = can('APPROVE_WORK_ENTRY');

  // Don't load server data when offline — avoid stale/empty states
  const shouldLoad = isOnline;

  // ── Load local drafts from IndexedDB ─────────────────────────────────────
  const loadLocalDrafts = useCallback(async () => {
    try {
      const drafts = await db.workEntries
        .filter(e => !e.remoteId && !e.deleted_at)
        .toArray();
      setLocalDrafts(drafts);

      // Resolve contract names from IndexedDB cache
      const contractIds = [...new Set(drafts.map(d => d.contract_id).filter(Boolean))];
      const contractMap = {};
      for (const cid of contractIds) {
        const c = await db.contracts.get(cid)
          ?? await db.contracts.filter(x => x.id === cid).first();
        if (c) contractMap[cid] = c.contract_name ?? c.contract_number ?? cid;
      }
      setLocalContractMap(contractMap);

      // Resolve template names from IndexedDB cache
      const templateIds = [...new Set(drafts.map(d => d.template_id).filter(Boolean))];
      const templateMap = {};
      for (const tid of templateIds) {
        const t = await db.templates.get(tid)
          ?? await db.templates.filter(x => x.id === tid).first();
        if (t) templateMap[tid] = t.template_name ?? tid;
      }
      setLocalTemplateMap(templateMap);
    } catch (e) {
      console.warn('⚠️ Could not load local drafts:', e.message);
    }
  }, []);

  const loadApprovalCount = useCallback(async () => {
    if (!currentOrg?.id || !canApprove || !isOnline) {
      return;
    }
    try {
      const result = await workEntryService.getPendingApprovals(currentOrg.id, true);
      if (result.success) {
        setApprovalPendingCount(result.count || 0);
      }
    } catch { /* non-fatal */ }
  }, [currentOrg?.id, canApprove, isOnline]);

  const loadSubcontractorOrgIds = useCallback(async () => {
    if (!currentOrg?.id || !isOnline) {
      return;
    }
    try {
      const ids = await subcontractorService.getSubcontractorOrgIds(currentOrg.id);
      setSubcontractorOrgIds(ids);
      setHasSubcontractors(ids.length > 0);
      if (ids.length === 0) {
        setSourceTab('all');
      }
    } catch (err) {
      console.error('❌ loadSubcontractorOrgIds:', err); 
    }
  }, [currentOrg?.id, isOnline]);

  const loadWorkEntries = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    try {
      const orgId  = currentOrg?.id ?? null;
      const result = await workEntryService.getUserWorkEntries(filters, orgId);
      if (result.success) {
        setWorkEntries(result.data || []);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('❌ loadWorkEntries:', err);
      setError('Failed to load work entries. Please try again.');
    }
  }, [currentOrg?.id, filters, isOnline]);

  const loadData = useCallback(async () => {
    if (!isOnline) {
      setLoading(false); return; 
    }
    try {
      setLoading(true);
      setError(null);
      const orgId = currentOrg?.id ?? null;
      await Promise.all([
        contractService.getUserContracts(orgId).then(d => setContracts(d || [])),
        loadSubcontractorOrgIds(),
        loadWorkEntries(),
        loadApprovalCount(),
        loadLocalDrafts()
      ]);
    } catch (err) {
      console.error('❌ loadData:', err);
      setError('Failed to load work entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, isOnline, loadSubcontractorOrgIds, loadWorkEntries, loadApprovalCount, loadLocalDrafts]);

  useEffect(() => {
    loadData(); 
  }, [loadData]);

  useEffect(() => {
    if (!loading && isOnline) {
      loadWorkEntries();
    }
  }, [filters]); // eslint-disable-line

  // Reload when something syncs — server list grows, local list shrinks
  useEffect(() => {
    if (!loading && isOnline) {
      loadWorkEntries();
      loadLocalDrafts();
    }
  }, [pendingCount]); // eslint-disable-line

  const handleDelete = async (entry) => {
    try {
      const result = await workEntryService.deleteWorkEntry(entry.id, currentOrg?.id);
      if (result.success) {
        setWorkEntries(prev => prev.filter(e => e.id !== entry.id));
      } else {
        toast.error(`Failed to delete: ${result.error}`);
      }
    } catch {
      toast.error('Failed to delete work entry'); 
    }
  };

  const displayedEntries = (() => {
    if (sourceTab === 'internal')      {
      return workEntries.filter(e => e.organization_id === currentOrg?.id);
    }
    if (sourceTab === 'subcontractor') {
      return workEntries.filter(e => subcontractorOrgIds.includes(e.organization_id));
    }
    return workEntries;
  })();

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-5">

        {/* ── OFFLINE: show redirect, not stale server data ──────────────── */}
        {!isOnline && (
          <OfflineRedirectView pendingCount={pendingCount} />
        )}

        {/* ── ONLINE ────────────────────────────────────────────────────── */}
        {isOnline && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Work Entries</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {loading ? 'Loading…' : `${displayedEntries.length} entries`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Always-visible Local Drafts link */}
                <Link
                  to="/work/offline"
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                >
                  <FolderOpenIcon className="w-4 h-4" />
                  Local Drafts
                  {localDrafts.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                      {localDrafts.length}
                    </span>
                  )}
                </Link>
                {canCreate && (
                  <Button onClick={() => navigate('/work/new')} variant="primary" className="flex items-center gap-2">
                    <PlusIcon className="w-4 h-4" />
                    New Entry
                  </Button>
                )}
              </div>
            </div>

            {/* Source tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
              <SourceTab label="All"      active={sourceTab === 'all'}      onClick={() => setSourceTab('all')} />
              <SourceTab label="Internal" active={sourceTab === 'internal'} onClick={() => setSourceTab('internal')} />
              {hasSubcontractors && (
                <SourceTab label="Subcontractor" active={sourceTab === 'subcontractor'} onClick={() => setSourceTab('subcontractor')} />
              )}
              {canApprove && (
                <SourceTab
                  label="Pending Approval"
                  badge={approvalPendingCount > 0 ? approvalPendingCount : null}
                  active={false}
                  onClick={() => navigate('/work/approvals')}
                />
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select value={filters.contractId} onChange={e => updateFilter('contractId', e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">All Contracts</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_name}</option>)}
              </select>

              <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <input type="date" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300" />
              <input type="date" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300" />

              <select value={filters.sortOrder} onChange={e => updateFilter('sortOrder', e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="desc">Latest First</option>
                <option value="asc">Oldest First</option>
              </select>

              {(filters.contractId || filters.status || filters.startDate || filters.endDate) && (
                <button onClick={() => setFilters({ contractId: '', status: '', startDate: '', endDate: '', sortOrder: 'desc' })}
                  className="text-sm text-gray-500 hover:text-gray-700 underline px-2">
                  Clear filters
                </button>
              )}
            </div>

            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
            )}

            {/* ── Local drafts (IndexedDB-only, not yet synced) ─────────── */}
            {!loading && localDrafts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                    Saved locally — not yet synced to server
                  </p>
                  <Link to="/work/offline" className="text-xs text-amber-600 hover:underline font-medium">
                    Manage all →
                  </Link>
                </div>
                {localDrafts.map(entry => (
                  <LocalDraftCard
                    key={entry.localId}
                    entry={entry}
                    contractName={localContractMap[entry.contract_id]}
                    templateName={localTemplateMap[entry.template_id]}
                    onEdit={() => navigate(`/work/offline/${entry.localId}/edit`)}
                  />
                ))}
              </div>
            )}

            {/* ── Server entries ─────────────────────────────────────────── */}
            <WorkEntryList
              workEntries={displayedEntries}
              loading={loading}
              onDelete={handleDelete}
              onEdit={(entry) => navigate(`/work/${entry.id}/edit`)}
              onView={(entry) => navigate(`/work/${entry.id}`)}
              currentOrgId={currentOrg?.id}
              subcontractorOrgIds={subcontractorOrgIds}
              showSourceBadge={sourceTab === 'all' && hasSubcontractors}
              isSubcontractorView={sourceTab === 'subcontractor'}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
