/**
 * AIntern - Intern Shell (mobile-first layout)
 *
 * Replaces WorkLedger's AppLayout/Sidebar for the intern experience:
 * slim top bar + content area + fixed bottom navigation. Desktop gets
 * the same layout centered at mobile width — interns are the primary
 * users and they are on phones.
 *
 * @file src/components/layout/InternShell.jsx
 * @created July 9, 2026 - Session 2
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  PencilSquareIcon,
  ClockIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import OfflineIndicator from '../common/OfflineIndicator';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/log', label: 'Log', icon: PencilSquareIcon },
  { to: '/history', label: 'History', icon: ClockIcon },
  { to: '/profile', label: 'Profile', icon: UserCircleIcon },
];

export function InternShell({ title = 'AIntern', children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-sm">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-wide">{title}</h1>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        <OfflineIndicator />
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 max-w-md mx-auto">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-slate-900' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon className="w-6 h-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default InternShell;
