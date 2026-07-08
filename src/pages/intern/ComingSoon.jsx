/**
 * AIntern - Coming Soon placeholder
 *
 * Feature-gated pages (/log, /history) render this until Phase 1/2 land.
 *
 * @file src/pages/intern/ComingSoon.jsx
 * @created July 9, 2026 - Session 2
 */

import React from 'react';
import InternShell from '../../components/layout/InternShell';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export default function ComingSoon({ feature = 'This feature' }) {
  return (
    <InternShell>
      <div className="flex flex-col items-center justify-center pt-24 px-6 text-center space-y-3">
        <WrenchScrewdriverIcon className="w-10 h-10 text-gray-300" />
        <p className="font-medium text-gray-700">{feature} is on the way</p>
        <p className="text-sm text-gray-500">
          We're building it right now — it will appear here automatically in an
          upcoming update.
        </p>
      </div>
    </InternShell>
  );
}
