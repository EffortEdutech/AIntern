/**
 * WorkLedger - Onboarding Wizard
 *
 * Shown on the Dashboard when a new org has no contracts yet.
 * Guides the user through 3 setup steps:
 *   1. Create a Contract
 *   2. Assign a Template
 *   3. Create First Entry
 *
 * Dismissible per-org via localStorage.
 *
 * @module components/dashboard/OnboardingWizard
 * @created May 2026
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase/client';

const STEPS = [
  {
    number: 1,
    title: 'Create a Contract',
    description: 'Set up your first contract to define the scope of work and rate structure.',
    action: { label: 'Create Contract', to: '/contracts/new' },
    unlocked: () => true
  },
  {
    number: 2,
    title: 'Assign a Template',
    description: 'Edit your contract to assign templates for faster work-entry creation.',
    action: { label: 'Go to Contracts', to: '/contracts' },
    note: 'Edit your contract to assign templates.',
    unlocked: ({ contractCount }) => contractCount > 0
  },
  {
    number: 3,
    title: 'Create First Entry',
    description: 'Log your first work entry against the contract.',
    action: { label: 'New Work Entry', to: '/work/new' },
    unlocked: ({ templateCount }) => templateCount > 0
  }
];

export default function OnboardingWizard({ contractCount, orgId, can, loading }) {
  const storageKey = `wl_onboarding_dismissed_${orgId}`;
  const [dismissed, setDismissed] = useState(
    () => Boolean(localStorage.getItem(storageKey))
  );
  const [templateCount, setTemplateCount] = useState(0);

  // Fetch template count: how many contract_templates rows belong to contracts in this org
  useEffect(() => {
    if (!orgId || dismissed) {
      return;
    }

    async function fetchTemplateCount() {
      try {
        // First get contract IDs for this org
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select('id')
          .eq('organization_id', orgId);

        if (contractsError || !contracts || contracts.length === 0) {
          setTemplateCount(0);
          return;
        }

        const contractIds = contracts.map((c) => c.id);

        const { count, error: tplError } = await supabase
          .from('contract_templates')
          .select('id', { count: 'exact', head: true })
          .in('contract_id', contractIds);

        if (!tplError) {
          setTemplateCount(count ?? 0);
        }
      } catch (err) {
        console.error('OnboardingWizard: template count error', err);
      }
    }

    fetchTemplateCount();
  }, [orgId, dismissed]);

  // Guard: don't show if not applicable
  if (
    loading ||
    dismissed ||
    !orgId ||
    contractCount !== 0 ||
    !can('MANAGE_CONTRACTS')
  ) {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }

  const context = { contractCount, templateCount };

  return (
    <div className="mb-6 bg-white border-l-4 border-primary-500 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Get started with WorkLedger
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete these steps to set up your first contract.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding wizard"
          className="text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Steps */}
      <div className="px-6 py-4 space-y-4">
        {STEPS.map((step, idx) => {
          const isUnlocked = step.unlocked(context);
          const isDone =
            idx === 0
              ? contractCount > 0
              : idx === 1
                ? templateCount > 0
                : false; // step 3 never auto-completes from counts alone

          return (
            <div
              key={step.number}
              className={`flex items-start gap-4 transition-opacity ${
                isUnlocked ? 'opacity-100' : 'opacity-40 pointer-events-none select-none'
              }`}
            >
              {/* Number circle */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isUnlocked
                      ? 'bg-primary-500 text-white'
                      : 'border-2 border-gray-300 text-gray-400 bg-white'
                }`}
              >
                {isDone ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                {step.note && (
                  <p className="text-xs text-gray-400 mt-0.5 italic">{step.note}</p>
                )}
              </div>

              {/* Action button */}
              {isUnlocked && !isDone && (
                <Link
                  to={step.action.to}
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors whitespace-nowrap"
                >
                  {step.action.label} &rarr;
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
