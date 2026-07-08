/**
 * WorkLedger — IndexedDB Schema (Dexie.js)
 * @module services/offline/db
 * @created March 4, 2026 — Session 18
 *
 * VERSIONING RULE (CRITICAL):
 * Never modify an existing version's schema.
 * Always bump the version number and add a migration.
 *
 * Version history:
 *   v1 (Session 18) — Initial schema: orgs, projects, contracts, templates,
 *                      workEntries, attachments, syncQueue
 *   v2 (Session 19) — Added contractTemplates junction cache.
 *                      Required because the sync was pulling templates by
 *                      contract_category (slug mismatch with template values),
 *                      and there was no way to know offline which templates
 *                      belong to which contract without the junction table.
 *
 * File destination: src/services/offline/db.js
 */

import Dexie from 'dexie';

export const db = new Dexie('WorkLedgerDB');

// ── Version 1 — original schema ──────────────────────────────────────────────
db.version(1).stores({
  // Reference data — cached on login/reconnect, read-only offline
  organizations: 'id, updated_at',
  projects:      'id, organization_id, updated_at',
  contracts:     'id, project_id, organization_id, updated_at',
  templates:     'template_id, contract_category, updated_at',

  // Main offline storage
  workEntries: '++localId, remoteId, contract_id, template_id, organization_id, created_by, entry_date, status, sync_status, created_at',

  // Attachments stored as base64 (avoids Safari IndexedDB blob issues)
  attachments: '++localId, remoteId, entry_local_id, entry_remote_id, field_id, attachment_type, sync_status, created_at',

  // Sync queue — every pending mutation
  syncQueue: '++id, entity_type, entity_local_id, action, sync_status, retry_count, created_at'
});

// ── Version 2 — add contractTemplates junction cache ─────────────────────────
//
// WHY: Online, WorkEntryForm uses contract.contract_templates (junction rows
//   loaded inline by contractService.getUserContracts). These rows tell it
//   which template UUIDs belong to which contract, and carry the full template
//   object (with fields_schema) when using contractService.getContract().
//
//   Offline, we had no equivalent — we tried to match by contract_category
//   slug, which doesn't match template.contract_category abbreviations (e.g.
//   'preventive-maintenance' vs 'PMC'). This caused "template not found".
//
//   The fix: cache junction rows here. The sync pulls them from Supabase
//   together with the full template (including fields_schema). Offline lookup
//   goes: contract.id → contractTemplates → template UUID → templates table.
//
// INDEX EXPLANATION:
//   '++localId' — auto-increment PK, never shown to user
//   'contract_id' — index for lookup by contract
//   'template_id' — index for lookup by template UUID (Supabase UUID, not slug)
//
db.version(2).stores({
  contractTemplates: '++localId, contract_id, template_id'
  // All v1 stores are automatically inherited unchanged
});

export const SYNC_STATUS = {
  PENDING:  'pending',
  SYNCING:  'syncing',
  SYNCED:   'synced',
  FAILED:   'failed'
};

export default db;
