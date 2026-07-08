/**
 * WorkLedger - Recent Activity Component
 *
 * Self-fetching component that queries activity_logs from Supabase
 * and displays a formatted activity feed with relative timestamps.
 *
 * @module components/dashboard/RecentActivity
 * @created January 29, 2026
 * @updated May 17, 2026 - self-fetch from activity_logs using orgId
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase/client';

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) {
    return 'just now';
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours ago`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Map DB action values to human-readable messages
 */
function getActivityMessage(action) {
  const map = {
    CREATE_WORK_ENTRY:  'created a work entry',
    SUBMIT_WORK_ENTRY:  'submitted a work entry for review',
    APPROVE_WORK_ENTRY: 'approved a work entry',
    REJECT_WORK_ENTRY:  'rejected a work entry',
    DELETE_WORK_ENTRY:  'deleted a work entry',
  };
  return map[action] || action.toLowerCase().replace(/_/g, ' ');
}

/**
 * Get icon for activity type (keyed by action string)
 */
function getActivityIcon(action) {
  const icons = {
    CREATE_WORK_ENTRY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    SUBMIT_WORK_ENTRY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    APPROVE_WORK_ENTRY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    REJECT_WORK_ENTRY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    DELETE_WORK_ENTRY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    default: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return icons[action] || icons.default;
}

/**
 * Get color class for activity type (keyed by action string)
 */
function getActivityColor(action) {
  const colors = {
    CREATE_WORK_ENTRY:  'bg-blue-100 text-blue-600',
    SUBMIT_WORK_ENTRY:  'bg-indigo-100 text-indigo-600',
    APPROVE_WORK_ENTRY: 'bg-green-100 text-green-600',
    REJECT_WORK_ENTRY:  'bg-red-100 text-red-600',
    DELETE_WORK_ENTRY:  'bg-gray-100 text-gray-600',
    default:            'bg-gray-100 text-gray-600'
  };

  return colors[action] || colors.default;
}

/**
 * Loading skeleton - 3 animated grey bars
 */
function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {[0, 1, 2].map(function(i) {
          return (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Normalise a log row returned from supabase into a display-ready shape.
 * Handles both the nested-join shape and the flat shape (fallback).
 */
function normaliseLog(log, nameMap) {
  let actorName = 'Unknown';
  if (log.user_profiles && log.user_profiles.full_name) {
    actorName = log.user_profiles.full_name;
  } else if (nameMap && nameMap[log.actor_user_id]) {
    actorName = nameMap[log.actor_user_id];
  }
  return {
    id: log.id,
    action: log.action,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    created_at: log.created_at,
    actorName: actorName
  };
}

/**
 * RecentActivity Component
 *
 * Self-fetches the latest 10 activity_logs rows where the given org
 * is either the actor or the target.
 *
 * @param {Object} props
 * @param {string} props.orgId - Organisation ID used to filter activity_logs
 */
export function RecentActivity({ orgId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    if (!orgId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function fetchActivities() {
      setLoading(true);
      try {
        const result = await supabase
          .from('activity_logs')
          .select('id, action, entity_type, entity_id, actor_user_id, metadata, created_at, user_profiles!actor_user_id(full_name)')
          .or(`actor_org_id.eq.${orgId},target_org_id.eq.${orgId}`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!result.error && result.data) {
          if (!cancelled) {
            setActivities(result.data.map(function(log) {
              return normaliseLog(log, null);
            }));
            setLoading(false);
          }
          return;
        }

        // Fallback: fetch without join and resolve names separately
        const logsResult = await supabase
          .from('activity_logs')
          .select('id, action, entity_type, entity_id, actor_user_id, metadata, created_at')
          .or(`actor_org_id.eq.${orgId},target_org_id.eq.${orgId}`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (logsResult.error || !logsResult.data) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        const logs = logsResult.data;
        const userIds = logs
          .map(function(l) {
            return l.actor_user_id; 
          })
          .filter(Boolean)
          .filter(function(v, i, a) {
            return a.indexOf(v) === i; 
          });

        const nameMap = {};
        if (userIds.length > 0) {
          const profilesResult = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', userIds);
          if (profilesResult.data) {
            profilesResult.data.forEach(function(p) {
              nameMap[p.id] = p.full_name;
            });
          }
        }

        if (!cancelled) {
          setActivities(logs.map(function(log) {
            return normaliseLog(log, nameMap);
          }));
          setLoading(false);
        }
      } catch (_err) {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchActivities();
    return function() {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No recent activity yet</p>
          <p className="text-xs text-gray-400">Activity will appear here as you use the app</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>

      <div className="flow-root">
        <ul className="-mb-8">
          {activities.map(function(activity, index) {
            const isLast = index === activities.length - 1;
            const link =
              activity.entity_type === 'work_entry' && activity.entity_id
                ? `/work/${activity.entity_id}`
                : null;

            const rowContent = (
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start space-x-3">
                  <div
                    className={`relative px-1 flex h-10 w-10 items-center justify-center rounded-full ${getActivityColor(activity.action)}`}
                  >
                    {getActivityIcon(activity.action)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">
                          {activity.actorName}
                        </span>
                        {' '}
                        <span className="text-gray-500">
                          {getActivityMessage(activity.action)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatRelativeTime(activity.created_at)}
                      </p>
                    </div>
                  </div>

                  {link && (
                    <div className="flex-shrink-0 self-center">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );

            if (link) {
              return (
                <li key={activity.id}>
                  <Link to={link} className="block hover:bg-gray-50 -mx-2 px-2 rounded">
                    {rowContent}
                  </Link>
                </li>
              );
            }

            return <li key={activity.id}>{rowContent}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}

export default RecentActivity;
