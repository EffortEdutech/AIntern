/**
 * AIntern - supervisor-review Edge Function (Phase 2, Sessions 7-9)
 *
 * The supervisor loop. Supervisors have NO accounts — every action is
 * authorized by a single-purpose, expiring token delivered by email.
 *
 * Actions (POST JSON { action, ... }):
 *   request_review     — intern JWT required. Revokes prior open tokens,
 *                        creates a token covering all pending submissions
 *                        (+ evaluation form when the cadence period is due),
 *                        emails the supervisor a review link via Resend.
 *   get_review         — token-auth. Returns submissions content, template
 *                        labels, internship context, evaluation payload.
 *   decide             — token-auth. Approve → immutable approved_snapshots
 *                        write (entry hash + ip/ua audit) + submission
 *                        resolved. Reject → comment stored, content purged.
 *   submit_evaluation  — token-auth. Immutable evaluations write with
 *                        server-computed period summary.
 *
 * Token security:
 *   - 32 random bytes, base64url in the link; only SHA-256 hex stored.
 *   - Single active token per internship (older ones revoked on reissue).
 *   - 7-day expiry; used_at set when everything in the payload is resolved.
 *   - decide/submit_evaluation only touch rows listed in the token payload.
 *
 * Deployed with verify_jwt = false BY DESIGN: get_review/decide/
 * submit_evaluation implement token authentication; request_review
 * validates the intern JWT manually.
 *
 * Required secrets: RESEND_API_KEY, AINTERN_APP_URL
 * Optional: AINTERN_EMAIL_FROM (default onboarding@resend.dev — dev only,
 *           delivers only to the Resend account owner's address)
 *
 * @file supabase/functions/supervisor-review/index.ts
 * @created July 10, 2026 - Sessions 7-9
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const APP_URL_ENV = (Deno.env.get('AINTERN_APP_URL') ?? '').replace(/\/$/, '');

/** Review-link base URL: explicit secret wins; otherwise the calling
 *  app's Origin (self-configuring for Vercel + localhost); last resort dev. */
function appUrl(req: Request): string {
  if (APP_URL_ENV) return APP_URL_ENV;
  const origin = req.headers.get('origin') ?? '';
  if (/^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');
  return 'http://localhost:4900';
}
const EMAIL_FROM = Deno.env.get('AINTERN_EMAIL_FROM') ?? 'AIntern <onboarding@resend.dev>';
const TOKEN_TTL_DAYS = 7;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ??
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const jsonWith = (req: Request) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });

// ─── Helpers ──────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function clientAudit(req: Request): Record<string, string> {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    user_agent: (req.headers.get('user-agent') ?? 'unknown').slice(0, 300),
  };
}

/** Validate a raw token → returns the token row or null. */
async function validateToken(rawToken: string) {
  if (!rawToken || rawToken.length < 20) return null;
  const hash = await sha256Hex(rawToken);
  const { data } = await admin
    .from('approval_tokens')
    .select('*')
    .eq('token_hash', hash)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at || data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

/** Period summary for the evaluation (server-computed, goes in evaluations.summary). */
async function computeSummary(internshipId: string, periodStart: string, periodEnd: string) {
  const { data: subs } = await admin
    .from('entry_submissions')
    .select('entry_date, status, data')
    .eq('internship_id', internshipId)
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd);
  const { data: snaps } = await admin
    .from('approved_snapshots')
    .select('entry_date, content')
    .eq('internship_id', internshipId)
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd);

  const hoursOf = (d: Record<string, unknown>) => Number(d?.['tasks.hours_spent'] ?? 0) || 0;
  const allDates = new Set([
    ...(subs ?? []).map((s) => s.entry_date),
    ...(snaps ?? []).map((s) => s.entry_date),
  ]);
  const totalHours =
    (subs ?? []).reduce((t, s) => t + hoursOf(s.data), 0) +
    (snaps ?? []).reduce((t, s) => t + hoursOf(s.content), 0);

  return {
    days_logged: allDates.size,
    approved_count: (snaps ?? []).length,
    total_hours: Math.round(totalHours * 100) / 100,
  };
}

async function markTokenUsedIfDone(token: Record<string, unknown>) {
  const payload = token.payload as { submission_ids?: string[]; evaluation?: unknown };
  const ids = payload.submission_ids ?? [];
  let pendingLeft = 0;
  if (ids.length > 0) {
    const { count } = await admin
      .from('entry_submissions')
      .select('id', { count: 'exact', head: true })
      .in('id', ids)
      .eq('status', 'pending');
    pendingLeft = count ?? 0;
  }
  if (pendingLeft === 0 && !payload.evaluation) {
    await admin.from('approval_tokens').update({ used_at: new Date().toISOString() }).eq('id', token.id);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const json = jsonWith(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }
  const action = String(body.action ?? '');

  try {
    // ════════════════════════════════════════════════════════════════
    // request_review — intern-authenticated
    // ════════════════════════════════════════════════════════════════
    if (action === 'request_review') {
      const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
      const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
      if (authErr || !user) return json({ success: false, error: 'Unauthorized' }, 401);

      const internshipId = String(body.internship_id ?? '');
      const { data: internship } = await admin
        .from('internships')
        .select('*')
        .eq('id', internshipId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!internship) return json({ success: false, error: 'Internship not found' }, 404);

      // Pending submissions to cover
      const { data: pending } = await admin
        .from('entry_submissions')
        .select('id, entry_date')
        .eq('internship_id', internshipId)
        .eq('status', 'pending')
        .order('entry_date');

      // Evaluation due? Last evaluation period_end (or start_date) + cadence
      const { data: lastEval } = await admin
        .from('evaluations')
        .select('period_end')
        .eq('internship_id', internshipId)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      const periodStart = lastEval
        ? new Date(new Date(lastEval.period_end).getTime() + 86400000).toISOString().split('T')[0]
        : internship.start_date;
      const dueDate = new Date(new Date(periodStart).getTime() + internship.evaluation_cadence_days * 86400000);
      const today = new Date();
      const evaluationDue = dueDate <= today;
      const periodEnd = evaluationDue
        ? new Date(dueDate.getTime() - 86400000).toISOString().split('T')[0]
        : null;

      if ((pending ?? []).length === 0 && !evaluationDue) {
        return json({ success: false, error: 'Nothing to review yet — submit some logs first.' }, 400);
      }

      // Intern display name
      const { data: profile } = await admin
        .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      const internName = profile?.full_name || user.email || 'Your intern';

      // Revoke prior open tokens, then issue a fresh one
      await admin
        .from('approval_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('internship_id', internshipId)
        .is('used_at', null)
        .is('revoked_at', null);

      const raw = randomToken();
      const payload = {
        submission_ids: (pending ?? []).map((p) => p.id),
        evaluation: evaluationDue
          ? { period_start: periodStart, period_end: periodEnd, cadence_days: internship.evaluation_cadence_days }
          : null,
        intern_name: internName,
      };
      const { error: tokenErr } = await admin.from('approval_tokens').insert({
        internship_id: internshipId,
        purpose: 'entry_batch',
        payload,
        token_hash: await sha256Hex(raw),
        expires_at: new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString(),
      });
      if (tokenErr) return json({ success: false, error: tokenErr.message }, 500);

      const link = `${appUrl(req)}/review?token=${raw}`;
      const count = (pending ?? []).length;
      const parts = [];
      if (count > 0) parts.push(`${count} daily log${count === 1 ? '' : 's'} awaiting your review`);
      if (evaluationDue) parts.push(`the ${internship.evaluation_cadence_days}-day evaluation form`);

      // Link fallback (plan §9.3): no email configured, or the intern chose
      // to share via WhatsApp — return the secure link instead of failing.
      if (!RESEND_API_KEY || body.share_mode === 'link') {
        return json({
          success: true,
          email_sent: false,
          review_link: link,
          emailed_to: null,
          submissions: count,
          evaluation_included: evaluationDue,
        });
      }

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#0f172a">AIntern — review request</h2>
          <p><strong>${internName}</strong> (${internship.company_name}${internship.department ? ', ' + internship.department : ''}) has ${parts.join(' and ')}.</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open review page</a>
          </p>
          <p style="color:#64748b;font-size:13px">No account needed. This link is personal to you and expires in ${TOKEN_TTL_DAYS} days. Your decisions and signature are recorded for the internship logbook.</p>
        </div>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [internship.supervisor_email],
          subject: `AIntern: ${internName} — ${parts.join(' + ')}`,
          html,
        }),
      });
      if (!emailRes.ok) {
        const detail = (await emailRes.text()).slice(0, 300);
        return json({ success: false, error: `Email send failed: ${detail}` }, 502);
      }

      return json({
        success: true,
        email_sent: true,
        emailed_to: internship.supervisor_email,
        submissions: count,
        evaluation_included: evaluationDue,
      });
    }

    // ════════════════════════════════════════════════════════════════
    // get_review — token-authenticated
    // ════════════════════════════════════════════════════════════════
    if (action === 'get_review') {
      const token = await validateToken(String(body.token ?? ''));
      if (!token) return json({ success: false, error: 'This link is invalid, expired, or already completed.' }, 401);

      const payload = token.payload as Record<string, unknown>;
      const ids = (payload.submission_ids as string[]) ?? [];

      const { data: internship } = await admin
        .from('internships')
        .select('company_name, department, supervisor_name, evaluation_cadence_days, metadata, daily_template_id')
        .eq('id', token.internship_id)
        .single();

      let submissions: unknown[] = [];
      if (ids.length > 0) {
        const { data } = await admin
          .from('entry_submissions')
          .select('id, entry_date, client_created_at, data, status, submitted_at')
          .in('id', ids)
          .eq('internship_id', token.internship_id)
          .order('entry_date');
        submissions = data ?? [];
      }

      const { data: template } = await admin
        .from('templates')
        .select('fields_schema, template_name')
        .eq('template_id', 'aintern-daily-log-v1')
        .maybeSingle();

      return json({
        success: true,
        intern_name: payload.intern_name ?? 'Intern',
        internship,
        submissions,
        template,
        evaluation: payload.evaluation ?? null,
        custom_kpis: (internship?.metadata as Record<string, unknown>)?.custom_kpis ?? [],
        expires_at: token.expires_at,
      });
    }

    // ════════════════════════════════════════════════════════════════
    // decide — token-authenticated approve/reject batch
    // ════════════════════════════════════════════════════════════════
    if (action === 'decide') {
      const token = await validateToken(String(body.token ?? ''));
      if (!token) return json({ success: false, error: 'This link is invalid, expired, or already completed.' }, 401);

      const payload = token.payload as Record<string, unknown>;
      const allowedIds = new Set((payload.submission_ids as string[]) ?? []);
      const decisions = Array.isArray(body.decisions) ? body.decisions as Array<Record<string, string>> : [];
      const signature = typeof body.signature === 'string' ? body.signature.slice(0, 200000) : null;
      const audit = clientAudit(req);

      const { data: internship } = await admin
        .from('internships')
        .select('supervisor_name, supervisor_email')
        .eq('id', token.internship_id)
        .single();

      const results = [];
      for (const d of decisions) {
        const id = String(d.id ?? '');
        const decision = String(d.decision ?? '');
        if (!allowedIds.has(id) || !['approve', 'reject'].includes(decision)) {
          results.push({ id, success: false, error: 'Not permitted' });
          continue;
        }
        const { data: sub } = await admin
          .from('entry_submissions')
          .select('*')
          .eq('id', id)
          .eq('internship_id', token.internship_id)
          .eq('status', 'pending')
          .maybeSingle();
        if (!sub) {
          results.push({ id, success: false, error: 'Already resolved' });
          continue;
        }

        if (decision === 'approve') {
          const entryHash = await sha256Hex(JSON.stringify(sub.data));
          const { error: snapErr } = await admin.from('approved_snapshots').insert({
            internship_id: token.internship_id,
            submission_id: sub.id,
            entry_date: sub.entry_date,
            client_created_at: sub.client_created_at,
            content: sub.data,
            photo_paths: sub.photo_paths ?? [],
            supervisor_name: internship?.supervisor_name ?? 'Supervisor',
            supervisor_email: internship?.supervisor_email ?? '',
            supervisor_signature: signature,
            supervisor_comment: d.comment ? String(d.comment).slice(0, 2000) : null,
            token_id: token.id,
            audit: { ...audit, entry_hash: entryHash },
          });
          if (snapErr) {
            results.push({ id, success: false, error: snapErr.message });
            continue;
          }
          await admin.from('entry_submissions').update({
            status: 'approved',
            resolved_at: new Date().toISOString(),
            token_id: token.id,
          }).eq('id', id);
          results.push({ id, success: true, decision: 'approved' });
        } else {
          // Reject: store comment, purge content (plan §4.2)
          await admin.from('entry_submissions').update({
            status: 'rejected',
            supervisor_comment: d.comment ? String(d.comment).slice(0, 2000) : 'Please revise and resubmit.',
            resolved_at: new Date().toISOString(),
            token_id: token.id,
            data: {},
          }).eq('id', id);
          results.push({ id, success: true, decision: 'rejected' });
        }
      }

      await markTokenUsedIfDone(token);
      return json({ success: results.every((r) => r.success), results });
    }

    // ════════════════════════════════════════════════════════════════
    // submit_evaluation — token-authenticated
    // ════════════════════════════════════════════════════════════════
    if (action === 'submit_evaluation') {
      const token = await validateToken(String(body.token ?? ''));
      if (!token) return json({ success: false, error: 'This link is invalid, expired, or already completed.' }, 401);

      const payload = token.payload as Record<string, unknown>;
      const evalSpec = payload.evaluation as Record<string, unknown> | null;
      if (!evalSpec) return json({ success: false, error: 'No evaluation attached to this link.' }, 400);

      const { data: internship } = await admin
        .from('internships')
        .select('supervisor_name, supervisor_email')
        .eq('id', token.internship_id)
        .single();

      const summary = await computeSummary(
        token.internship_id as string,
        String(evalSpec.period_start),
        String(evalSpec.period_end),
      );

      const { error: evalErr } = await admin.from('evaluations').insert({
        internship_id: token.internship_id,
        period_start: evalSpec.period_start,
        period_end: evalSpec.period_end,
        cadence_days: evalSpec.cadence_days,
        summary,
        scores: body.scores ?? {},
        custom_kpis: body.custom_kpis ?? [],
        comments: body.comments ?? {},
        supervisor_name: internship?.supervisor_name ?? 'Supervisor',
        supervisor_email: internship?.supervisor_email ?? '',
        supervisor_signature: typeof body.signature === 'string' ? body.signature.slice(0, 200000) : null,
        token_id: token.id,
        audit: clientAudit(req),
      });
      if (evalErr) return json({ success: false, error: evalErr.message }, 500);

      // Clear the evaluation from the payload; close the token if all done
      const newPayload = { ...payload, evaluation: null };
      await admin.from('approval_tokens').update({ payload: newPayload }).eq('id', token.id);
      await markTokenUsedIfDone({ ...token, payload: newPayload });

      return json({ success: true });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('supervisor-review error:', err);
    return json({ success: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
