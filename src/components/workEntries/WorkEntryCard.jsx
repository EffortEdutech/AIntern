/**
 * WorkLedger - Work Entry Card Component
 *
 * SESSION 13: Initial version
 * SESSION 15: Ownership guard for delete (MTSB cannot delete FEST ENT)
 * SESSION 16: ApprovalBadge, edit guards, rejection reason snippet
 * SESSION 19: isCreator guard on BOTH showEdit and showDelete
 *   - Technicians can only edit/delete entries THEY created
 *   - Managers (EDIT_ANY_WORK_ENTRY) can edit/delete any entry in own org
 *
 * @module components/workEntries/WorkEntryCard
 * @updated April 6, 2026 - Session 19: creator guard
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ApprovalBadge from './ApprovalBadge';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../context/AuthContext';

export default function WorkEntryCard({
  workEntry,
  onDelete,
  onEdit,
  onView,
  isOwnEntry = true,
  showSourceBadge = false,
  isSubcontractorView = false
}) {
  const navigate          = useNavigate();
  const { can, role }     = useRole();
  const { user, profile } = useAuth();

  if (!workEntry) {
    return null;
  }

  const { id, entry_date, shift, status, contract, template, data, rejection_reason, creator } = workEntry;

  const formatDate = (dateStr) => {
    if (!dateStr) {
      return 'N/A';
    }
    try {
      return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateStr)); 
    } catch {
      return dateStr; 
    }
  };

  const getPreviewFields = () => {
    if (!data || typeof data !== 'object') {
      return [];
    }
    const previews = [];
    const keys = Object.keys(data);
    const priority = ['asset', 'equipment', 'location', 'description', 'incident', 'work_done', 'findings', 'remarks'];
    for (const pattern of priority) {
      const key = keys.find(k => k.toLowerCase().includes(pattern));
      if (key && data[key]) {
        previews.push({ key, value: data[key] }); if (previews.length >= 2) {
          break;
        } 
      }
    }
    return previews;
  };

  const previewFields = getPreviewFields();

  const handleView   = () => onView   ? onView(workEntry)   : navigate(`/work/${id}`);
  const handleEdit   = () => onEdit   ? onEdit(workEntry)   : navigate(`/work/${id}/edit`);
  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this work entry?')) {
      onDelete(workEntry);
    } 
  };

  // Two levels of ownership:
  //   isManagerOrAbove → can act on any entry in own org (org_owner, org_admin, manager, bj_staff)
  //   isCreator        → this specific user created this entry (for technician/worker/subcontractor)
  const isEditable       = status === 'draft' || status === 'rejected';
  const isManagerOrAbove = can('EDIT_ANY_WORK_ENTRY');
  const currentUserId    = user?.id ?? profile?.id ?? null;
  const isCreator        = !!currentUserId && workEntry.created_by === currentUserId;

  const showEdit = can('EDIT_OWN_WORK_ENTRY')
    && isEditable
    && !isSubcontractorView
    && (isManagerOrAbove ? isOwnEntry : isCreator);

  const showDelete = can('DELETE_WORK_ENTRY')
    && status === 'draft'
    && !isSubcontractorView
    && (isManagerOrAbove ? isOwnEntry : isCreator);

  const creatorName = creator?.user_profiles?.[0]?.full_name || creator?.email || null;

  return (
    <div className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${status === 'approved' ? 'border-green-100' : ''} ${status === 'rejected' ? 'border-red-100' : ''} ${status === 'submitted' ? 'border-blue-100' : ''} ${status === 'draft' ? 'border-gray-200' : ''}`}>

      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-semibold text-gray-900">
            {formatDate(entry_date)}
            {shift && <span className="ml-2 text-xs font-normal text-gray-500">({shift} shift)</span>}
          </p>
          <ApprovalBadge status={status} size="sm" />
        </div>
        <p className="text-xs text-gray-500 truncate">{contract?.contract_number} — {contract?.contract_name}</p>
      </div>

      {template?.template_name && <p className="text-xs text-gray-400 mb-2">{template.template_name}</p>}
      {showSourceBadge && creatorName && <p className="text-xs text-blue-600 font-medium mb-2">👤 {creatorName}</p>}
      {showSourceBadge && <span className="inline-block px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 rounded-full mb-2">Subcontractor</span>}

      {previewFields.length > 0 && (
        <div className="space-y-1 mb-3">
          {previewFields.map(({ key, value }) => (
            <p key={key} className="text-xs text-gray-600 truncate">
              <span className="font-medium capitalize">{key.replace(/[._]/g, ' ')}:</span>{' '}
              {String(value).substring(0, 80)}{String(value).length > 80 ? '…' : ''}
            </p>
          ))}
        </div>
      )}

      {status === 'rejected' && rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-red-600 font-medium mb-0.5">Rejected</p>
          <p className="text-xs text-red-500 truncate">{rejection_reason}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button onClick={handleView} className="flex-1 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">View</button>
        {showEdit   && <button onClick={handleEdit}   className="flex-1 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">Edit</button>}
        {showDelete && <button onClick={handleDelete} className="flex-1 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Delete</button>}
      </div>
    </div>
  );
}
