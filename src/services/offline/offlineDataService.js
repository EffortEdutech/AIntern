/**
 * WorkLedger — Offline Data Service
 *
 * Reads REFERENCE DATA from IndexedDB (Dexie) for use when offline.
 *
 * SESSION 19 FIXES:
 *   getContractsForOrg — now queries by BOTH organization_id AND
 *     performing_org_id so subcontractor orgs see their contracts.
 *
 *   getContractJunctionRows (NEW) — primary offline lookup for templates.
 *     Queries db.contractTemplates (Dexie v2) by contract_id.
 *     Returns rows in the same shape as online contract_templates junction rows
 *     (including the full template object with fields_schema inline).
 *     This replaces the broken category-based lookup entirely.
 *
 * @module services/offline/offlineDataService
 * File destination: src/services/offline/offlineDataService.js
 */

import { db } from './db';

export const offlineDataService = {

  // ── CONTRACTS ────────────────────────────────────────────────────────────

  /**
   * Get active contracts for an org from IndexedDB.
   * Queries by BOTH organization_id (owner) and performing_org_id (performer).
   */
  async getContractsForOrg(orgId) {
    try {
      if (!orgId) {
        return [];
      }

      // Query A: contracts the org owns (indexed)
      const owned = await db.contracts
        .where('organization_id').equals(orgId)
        .toArray();

      // Query B: contracts the org performs (not indexed — full table filter)
      // Acceptable: scoped pull keeps contracts table small
      const allContracts = await db.contracts.toArray();
      const performing = allContracts.filter(
        c => c.performing_org_id === orgId && c.organization_id !== orgId
      );

      // Merge + deduplicate + filter active
      const seen = new Set();
      const merged = [];
      for (const c of [...owned, ...performing]) {
        if (!seen.has(c.id)) {
          seen.add(c.id); merged.push(c); 
        }
      }

      const active = merged.filter(c => c.status === 'active' && !c.deleted_at);

      console.log(
        `📱 offlineDataService: ${active.length} contracts for org ${orgId} ` +
        `(${owned.length} owned, ${performing.length} performing, after dedup+filter)`
      );
      return active;
    } catch (error) {
      console.error('❌ offlineDataService.getContractsForOrg:', error);
      return [];
    }
  },

  /**
   * Get a single contract by ID from IndexedDB.
   */
  async getContractById(contractId) {
    try {
      return await db.contracts.get(contractId) || null;
    } catch (error) {
      console.error('❌ offlineDataService.getContractById:', error);
      return null;
    }
  },

  // ── CONTRACT → TEMPLATE JUNCTION ─────────────────────────────────────────

  /**
   * Get junction rows for a contract from the cached contractTemplates table.
   *
   * This is the PRIMARY offline method for resolving which templates belong
   * to a contract. It replaces the old category-based approach which failed
   * because contract.contract_category (slug) ≠ template.contract_category
   * (abbreviation) in the database.
   *
   * Returns rows in exactly the same shape as online contract_templates:
   *   { template_id (UUID), is_default, label, sort_order, templates: {...} }
   *
   * The 'templates' object includes fields_schema — DynamicForm renders from
   * it directly. No additional reads needed.
   *
   * @param {string} contractId — Supabase UUID
   * @returns {Promise<Array>} junction rows with inline template objects
   */
  async getContractJunctionRows(contractId) {
    try {
      if (!contractId) {
        return [];
      }

      const rows = await db.contractTemplates
        .where('contract_id').equals(contractId)
        .sortBy('sort_order');

      if (!rows.length) {
        console.log(`📱 offlineDataService: no cached junction rows for contract ${contractId}`);
        return [];
      }

      // Shape to match online contract_templates junction row format
      const shaped = rows
        .filter(row => row.template?.fields_schema) // only rows with a full template
        .map(row => ({
          template_id: row.template_id,    // UUID
          is_default:  row.is_default,
          label:       row.label ?? row.template?.template_name ?? null,
          sort_order:  row.sort_order,
          templates:   row.template        // full template object with fields_schema
        }));

      console.log(`📱 offlineDataService: ${shaped.length} junction rows for contract ${contractId}`);
      return shaped;
    } catch (error) {
      console.error('❌ offlineDataService.getContractJunctionRows:', error);
      return [];
    }
  },

  // ── TEMPLATES ────────────────────────────────────────────────────────────

  /**
   * Get a template by its UUID or text slug from IndexedDB.
   *
   * Tries text-slug PK first (most common offline caller path — junction rows
   * use text slugs when looked up via getTemplatesForContractCategory).
   * Falls back to UUID field scan (covers junction-based lookups where
   * template_id is a UUID).
   */
  async getTemplateById(templateId) {
    try {
      if (!templateId) {
        return null;
      }

      // Fast path: text slug is the Dexie PK
      const template = await db.templates.get(templateId);
      if (template) {
        return template;
      }

      // Fallback: caller passed a UUID — scan by id field
      const byUuid = await db.templates.filter(t => t.id === templateId).first();
      if (byUuid) {
        return byUuid;
      }

      // Last resort: scan contractTemplates for inline template
      const jRow = await db.contractTemplates
        .filter(r => r.template_id === templateId && r.template?.fields_schema)
        .first();
      if (jRow?.template) {
        return jRow.template;
      }

      console.warn('⚠️ offlineDataService.getTemplateById: not found:', templateId);
      return null;
    } catch (error) {
      console.error('❌ offlineDataService.getTemplateById:', error);
      return null;
    }
  },

  /**
   * Get templates by contract_category.
   * Kept as a last-resort fallback. Note: category values may not match
   * between contracts and templates in all setups — prefer getContractJunctionRows.
   */
  async getTemplatesForContractCategory(contractCategory) {
    try {
      if (!contractCategory) {
        return [];
      }
      const templates = await db.templates
        .where('contract_category').equals(contractCategory)
        .toArray();
      console.log(`📱 offlineDataService: ${templates.length} templates for category ${contractCategory}`);
      return templates;
    } catch (error) {
      console.error('❌ offlineDataService.getTemplatesForContractCategory:', error);
      return [];
    }
  },

  async getAllTemplates() {
    try {
      return await db.templates.toArray();
    } catch (error) {
      console.error('❌ offlineDataService.getAllTemplates:', error);
      return [];
    }
  },

  // ── WORK ENTRIES ──────────────────────────────────────────────────────────

  async getWorkEntryByRemoteId(remoteId) {
    try {
      return await db.workEntries.where('remoteId').equals(remoteId).first() || null;
    } catch (error) {
      console.error('❌ offlineDataService.getWorkEntryByRemoteId:', error);
      return null;
    }
  },

  async getWorkEntries(filters = {}) {
    try {
      let entries = await db.workEntries.orderBy('entry_date').reverse().toArray();

      if (filters.contractId) {
        entries = entries.filter(e => e.contract_id === filters.contractId);
      }
      if (filters.status)     {
        entries = entries.filter(e => e.status === filters.status);
      }
      if (filters.startDate)  {
        entries = entries.filter(e => e.entry_date >= filters.startDate);
      }
      if (filters.endDate)    {
        entries = entries.filter(e => e.entry_date <= filters.endDate);
      }

      entries = entries.filter(e => !e.deleted_at);

      console.log(`📱 offlineDataService: ${entries.length} work entries from IndexedDB`);
      return entries;
    } catch (error) {
      console.error('❌ offlineDataService.getWorkEntries:', error);
      return [];
    }
  },

  // ── CACHE STATUS ──────────────────────────────────────────────────────────

  async getCacheStatus() {
    try {
      const [contractCount, templateCount, workEntryCount, junctionCount, pendingCount] =
        await Promise.all([
          db.contracts.count(),
          db.templates.count(),
          db.workEntries.count(),
          db.contractTemplates.count(),
          db.syncQueue.where('sync_status').equals('pending').count()
        ]);

      return {
        contracts:        contractCount,
        templates:        templateCount,
        contractTemplates: junctionCount,
        workEntries:      workEntryCount,
        pendingSync:      pendingCount,
        hasCachedData:    contractCount > 0 && junctionCount > 0
      };
    } catch {
      return { contracts: 0, templates: 0, contractTemplates: 0, workEntries: 0, pendingSync: 0, hasCachedData: false };
    }
  },

  // ── PRUNE ──────────────────────────────────────────────────────────────────

  async pruneOldEntries() {
    try {
      const c30 = new Date(); c30.setDate(c30.getDate() - 30);
      const c7  = new Date(); c7.setDate(c7.getDate() - 7);
      const cut30 = c30.toISOString().split('T')[0];
      const cut7  = c7.toISOString().split('T')[0];

      const toDelete = await db.workEntries.filter(entry => {
        if (entry.sync_status === 'pending' || entry.sync_status === 'syncing') {
          return false;
        }
        if (entry.status === 'approved' && entry.entry_date < cut7)  {
          return true;
        }
        if (entry.entry_date < cut30) {
          return true;
        }
        return false;
      }).primaryKeys();

      if (toDelete.length) {
        await db.workEntries.bulkDelete(toDelete);
        console.log(`🧹 Pruned ${toDelete.length} old entries from IndexedDB`);
      }
      await db.syncQueue.where('sync_status').anyOf(['done', 'failed']).delete();
      return toDelete.length;
    } catch (error) {
      console.error('❌ offlineDataService.pruneOldEntries:', error);
      return 0;
    }
  }
};

export default offlineDataService;
