/**
 * WorkLedger - Stats Card Component
 * 
 * Reusable card component for displaying statistics with icon,
 * title, value, and optional trend indicator.
 * 
 * @module components/dashboard/StatsCard
 * @created January 29, 2026
 */

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * StatsCard Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon element
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main value to display
 * @param {Object} props.trend - Trend indicator (optional)
 * @param {number} props.trend.value - Trend value (e.g., +12)
 * @param {string} props.trend.label - Trend label (e.g., "vs last month")
 * @param {boolean} props.trend.isPositive - Whether trend is positive
 * @param {string} props.link - Link URL (optional)
 * @param {string} props.color - Color variant: blue, green, purple, orange
 * 
 * @example
 * <StatsCard
 *   icon={<WorkIcon />}
 *   title="Work Entries"
 *   value={42}
 *   trend={{ value: 12, label: "vs last month", isPositive: true }}
 *   link="/work-entries"
 *   color="blue"
 * />
 */
export function StatsCard({
  icon,
  title,
  value,
  trend,
  link,
  color = 'blue'
}) {
  // Color variants
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      trend: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      trend: 'text-green-600'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      trend: 'text-purple-600'
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      trend: 'text-orange-600'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  // Card content
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        {/* Icon */}
        <div className={`flex-shrink-0 ${colors.bg} rounded-md p-3`}>
          <div className={`w-6 h-6 ${colors.icon}`}>
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">
                {value}
              </div>
              
              {/* Trend Indicator */}
              {trend && (
                <div className={`
                  ml-2 flex items-baseline text-sm font-semibold
                  ${trend.isPositive ? 'text-green-600' : 'text-red-600'}
                `}>
                  {trend.isPositive ? (
                    <svg className="self-center flex-shrink-0 h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="self-center flex-shrink-0 h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="ml-1">{trend.value}</span>
                  {trend.label && (
                    <span className="ml-1 text-gray-500 font-normal">
                      {trend.label}
                    </span>
                  )}
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>

      {/* Link Arrow */}
      {link && (
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <span>View all</span>
          <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );

  // Wrap with Link if URL provided
  if (link) {
    return (
      <Link to={link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default StatsCard;
