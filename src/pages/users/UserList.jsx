/**
 * WorkLedger - User List Page
 *
 * Org admins and owners manage their team here.
 * - Lists all members with role badges, status, join date
 * - Search by name / email
 * - Filter by role or active status
 * - Change Role (ChangeRoleModal)
 * - Deactivate / Reactivate
 * - Invite User button → /users/invite
 *
 * SESSION 19 UPDATE — super_admin Platform View:
 *   When globalRole === 'super_admin', a second tab "Platform Users" appears.
 *   This tab calls userService.getAllPlatformUsers() which returns EVERY user
 *   in the system (from user_profiles), including users with no org membership.
 *
 *   Each user row shows:
 *     - Name + registration date
 *     - Org assignment(s) — or a "No org" amber badge
 *     - "Add to [current org]" action for unassigned users
 *
 *   The existing "This Org" tab (org_members view) is unchanged.
 *
 *   Why this matters:
 *     When a user registers but hasn't been added to an org, they appear
 *     nowhere in the old UI. super_admin had no way to find or assign them.
 *     This fixes that blind spot completely.
 *
 * @module pages/users/UserList
 * @created February 23, 2026 - Session 12
 * @updated April 7, 2026    - Session 19: super_admin Platform Users tab
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ChangeRoleModal from '../../components/users/ChangeRoleModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { userService, ASSIGNABLE_ORG_ROLES } from '../../services/api/userService';
import { useOrganization } from '../../context/OrganizationContext';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../context/AuthContext';
import { getRoleMeta, ROLE_META } from '../../constants/permissions';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const meta = getRoleMeta(role);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 inline-block" />
      Inactive
    </span>
  );
}

function MemberAvatar({ name }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
      {initial}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PLATFORM USERS TAB (super_admin only)
// Shows all registered users with org assignment status
// ─────────────────────────────────────────────────────────

function PlatformUsersTab({ currentOrg }) {
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [search,         setSearch]         = useState('');
  const [orgFilter,      setOrgFilter]      = useState('all'); // 'all' | 'no_org' | 'has_org'
  const [addingUserId,   setAddingUserId]   = useState(null);
  const [addRoleFor,     setAddRoleFor]     = useState(null); // userId being assigned role
  const [selectedRole,   setSelectedRole]   = useState('technician');
  const [toast,          setToast]          = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await userService.getAllPlatformUsers();
    if (result.success) {
      setUsers(result.data);
    } else {
      setError(result.error || 'Failed to load platform users.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(); 
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...users];

    if (orgFilter === 'no_org')  {
      list = list.filter(u => !u.hasOrg);
    }
    if (orgFilter === 'has_org') {
      list = list.filter(u => u.hasOrg);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, search, orgFilter]);

  const handleAddToOrg = async (userId) => {
    if (!currentOrg?.id) {
      showToast('Select an organisation from the header switcher first.', 'error');
      return;
    }
    setAddingUserId(userId);
    try {
      const result = await userService.addExistingUserToOrg(currentOrg.id, userId, selectedRole);
      if (result.success) {
        showToast(`User added to ${currentOrg.name} as ${getRoleMeta(selectedRole).label}`);
        setAddRoleFor(null);
        await load(); // refresh list
      } else {
        showToast(result.error || 'Failed to add user.', 'error');
      }
    } catch {
      showToast('Unexpected error.', 'error');
    } finally {
      setAddingUserId(null);
    }
  };

  const noOrgCount = users.filter(u => !u.hasOrg).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700 text-sm font-medium">{error}</p>
        <p className="text-red-500 text-xs mt-1">
          Check that the super_admin RLS policy on user_profiles is in place.
        </p>
        <button onClick={load} className="mt-3 text-xs text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* No-org alert */}
      {noOrgCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0 animate-pulse" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{noOrgCount} user{noOrgCount > 1 ? 's' : ''}</span>
            {noOrgCount > 1 ? ' have' : ' has'} registered but {noOrgCount > 1 ? 'have' : 'has'} no organisation access.
            Use "Add to {currentOrg?.name ?? 'org'}" to assign them.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[
            ['all',     'All',      users.length],
            ['no_org',  'No Org',   noOrgCount],
            ['has_org', 'Has Org',  users.length - noOrgCount]
          ].map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setOrgFilter(val)}
              className={`px-3 py-2 font-medium transition-colors flex items-center gap-1.5 ${
                orgFilter === val ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                orgFilter === val ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow text-center py-16">
          <p className="text-gray-500 text-sm">No users match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Platform Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organisations</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => {
                const isBeingAdded = addingUserId === user.id;
                const isSelectingRole = addRoleFor === user.id;
                const alreadyInCurrentOrg = currentOrg
                  ? user.orgs.some(o => o.orgId === currentOrg.id)
                  : false;

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.hasOrg ? 'bg-amber-50/30' : ''}`}>
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={user.full_name} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.full_name || <span className="text-gray-400 italic">No name</span>}
                          </p>
                          <p className="text-xs text-gray-400 truncate font-mono">
                            {user.id.slice(0, 8)}...
                          </p>
                          <p className="text-xs text-gray-400">
                            Joined {new Date(user.created_at).toLocaleDateString('en-MY', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Platform role */}
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {user.global_role ? (
                        <RoleBadge role={user.global_role} />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Orgs */}
                    <td className="px-6 py-4">
                      {user.hasOrg ? (
                        <div className="flex flex-wrap gap-1">
                          {user.orgs.map(o => (
                            <span key={o.orgId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {o.orgName}
                              <span className="text-blue-400">·</span>
                              <span className="text-blue-500">{getRoleMeta(o.role)?.label ?? o.role}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                          No org
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      {!currentOrg ? (
                        <span className="text-xs text-gray-400">Select org first</span>
                      ) : alreadyInCurrentOrg ? (
                        <span className="text-xs text-green-600 font-medium">✓ In {currentOrg.name}</span>
                      ) : isSelectingRole ? (
                        /* Role picker inline */
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                          >
                            {ASSIGNABLE_ORG_ROLES.map(r => (
                              <option key={r} value={r}>{getRoleMeta(r)?.label ?? r}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAddToOrg(user.id)}
                            disabled={isBeingAdded}
                            className="text-xs font-medium px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition-colors"
                          >
                            {isBeingAdded ? '...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setAddRoleFor(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddRoleFor(user.id); setSelectedRole('technician'); 
                          }}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 transition-colors whitespace-nowrap"
                        >
                          + Add to {currentOrg.name}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────

export default function UserList() {
  const navigate        = useNavigate();
  const { currentOrg } = useOrganization();
  const { can, globalRole } = useRole();
  const { profile }     = useAuth();

  const isSuperAdmin = globalRole === 'super_admin';

  // Active tab: 'org' | 'platform'
  const [activeTab, setActiveTab] = useState('org');

  // Org members state
  const [members,       setMembers]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('active');
  const [showFilters,   setShowFilters]   = useState(false);
  const [roleModal,     setRoleModal]     = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast,         setToast]         = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMembers = useCallback(async () => {
    if (!currentOrg?.id) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getOrgMembers(currentOrg.id);
      setMembers(data);
    } catch (err) {
      console.error('❌ Failed to load members:', err);
      setError('Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (activeTab === 'org') {
      loadMembers();
    }
  }, [loadMembers, activeTab]);

  const filtered = useMemo(() => {
    let list = [...members];
    if (statusFilter === 'active')   {
      list = list.filter(m => m.is_active);
    }
    if (statusFilter === 'inactive') {
      list = list.filter(m => !m.is_active);
    }
    if (roleFilter !== 'all') {
      list = list.filter(m => m.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.user?.full_name || '').toLowerCase().includes(q) ||
        (m.user?.email     || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, search, roleFilter, statusFilter]);

  const handleRoleChanged = (memberId, newRole) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    setRoleModal(null);
    showToast(`Role updated to ${getRoleMeta(newRole).label}`);
  };

  const handleToggleActive = async (member) => {
    try {
      setActionLoading(member.id);
      const fn = member.is_active
        ? userService.deactivateMember.bind(userService)
        : userService.reactivateMember.bind(userService);
      const result = await fn(currentOrg.id, member.id);
      if (!result.success) {
        showToast(result.error, 'error'); return; 
      }
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m));
      showToast(member.is_active ? 'Member deactivated' : 'Member reactivated');
    } catch {
      showToast('Unexpected error. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const roleOptions = Object.entries(ROLE_META)
    .filter(([role]) => !['super_admin', 'bina_jaya_staff'].includes(role))
    .map(([role, meta]) => ({ value: role, label: meta.label }));

  const hasActiveFilters = roleFilter !== 'all' || statusFilter !== 'active' || search.trim();

  if (!currentOrg) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <p>Select an organization to manage users.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isSuperAdmin
                ? 'Manage team members and view all platform users'
                : `Manage team members of ${currentOrg.name}`}
            </p>
          </div>
          {can('INVITE_USERS') && (
            <button
              onClick={() => navigate('/users/invite')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
            >
              <UserPlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Invite User</span>
              <span className="sm:hidden">Invite</span>
            </button>
          )}
        </div>

        {/* Tab switcher — only for super_admin */}
        {isSuperAdmin && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('org')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'org'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {currentOrg.name} Members
            </button>
            <button
              onClick={() => setActiveTab('platform')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'platform'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Platform Users
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                SA
              </span>
            </button>
          </div>
        )}

        {/* Platform tab */}
        {activeTab === 'platform' && isSuperAdmin && (
          <PlatformUsersTab currentOrg={currentOrg} />
        )}

        {/* Org members tab */}
        {activeTab === 'org' && (
          <>
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
                <p className="text-red-700 text-sm">{error}</p>
                <button onClick={loadMembers} className="mt-2 text-xs text-red-600 underline">Retry</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search + filters */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                      {[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setStatusFilter(val)}
                          className={`px-3 py-2 font-medium transition-colors ${
                            statusFilter === val ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowFilters(f => !f)}
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                        showFilters ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <FunnelIcon className="h-4 w-4" />
                      Filter
                      {roleFilter !== 'all' && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">1</span>
                      )}
                    </button>
                  </div>

                  {showFilters && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Role:</label>
                      <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="all">All roles</option>
                        {roleOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {hasActiveFilters && (
                        <button
                          onClick={() => {
                            setSearch(''); setRoleFilter('all'); setStatusFilter('active'); 
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-500">
                  {filtered.length} member{filtered.length !== 1 ? 's' : ''}
                  {hasActiveFilters ? ' (filtered)' : ''}
                </p>

                {filtered.length > 0 ? (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Joined</th>
                          {(can('CHANGE_USER_ROLES') || can('MANAGE_ORG_USERS')) && (
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map(member => (
                          <tr
                            key={member.id}
                            className={`transition-colors ${member.is_active ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-70'}`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <MemberAvatar name={member.user?.full_name} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {member.user?.full_name || 'Unknown'}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {member.user?.email || '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4"><RoleBadge role={member.role} /></td>
                            <td className="px-6 py-4 hidden sm:table-cell"><StatusBadge isActive={member.is_active} /></td>
                            <td className="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">
                              {member.joined_at
                                ? new Date(member.joined_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—'}
                            </td>
                            {(can('CHANGE_USER_ROLES') || can('MANAGE_ORG_USERS')) && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {can('CHANGE_USER_ROLES') && member.is_active && (
                                    <button
                                      onClick={() => setRoleModal(member)}
                                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                                    >
                                      Change Role
                                    </button>
                                  )}
                                  {can('MANAGE_ORG_USERS') && (
                                    <button
                                      onClick={() => handleToggleActive(member)}
                                      disabled={actionLoading === member.id}
                                      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                        member.is_active
                                          ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                          : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                      } disabled:opacity-50`}
                                    >
                                      {actionLoading === member.id ? '...' : member.is_active ? 'Deactivate' : 'Reactivate'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow text-center py-16">
                    <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-gray-900 font-medium mb-1">
                      {hasActiveFilters ? 'No members match your filters' : 'No team members yet'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      {hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'Invite your first team member to get started.'}
                    </p>
                    {!hasActiveFilters && can('INVITE_USERS') && (
                      <button
                        onClick={() => navigate('/users/invite')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <UserPlusIcon className="h-4 w-4" />
                        Invite First Member
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Change Role Modal */}
        {roleModal && (
          <ChangeRoleModal
            member={roleModal}
            orgId={currentOrg.id}
            onSuccess={handleRoleChanged}
            onClose={() => setRoleModal(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
