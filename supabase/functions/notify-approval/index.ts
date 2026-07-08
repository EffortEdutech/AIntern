/**
 * WorkLedger — Supabase Edge Function: notify-approval
 *
 * Sends email notifications when a work entry is approved or rejected.
 * Called (fire-and-forget) from workEntryService.approveWorkEntry()
 * and workEntryService.rejectWorkEntry().
 *
 * DEPLOY:
 *   supabase functions deploy notify-approval
 *
 * ENV VARS (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY   — your Resend API key (resend.com)
 *   FROM_EMAIL       — sender address, e.g. noreply@workledger.my
 *   APP_URL          — public URL, e.g. https://app.workledger.my
 *
 * REQUEST BODY (JSON):
 *   {
 *     type:           'approved' | 'rejected'
 *     entryId:        string   (work_entries.id)
 *     recipientEmail: string   (technician's email)
 *     recipientName:  string   (technician's full name)
 *     approverName:   string   (manager's full name)
 *     contractNumber: string
 *     entryDate:      string   (YYYY-MM-DD)
 *     reason?:        string   (rejection reason — only for 'rejected')
 *   }
 *
 * @module supabase/functions/notify-approval
 * @created May 17, 2026 — Session 20
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'noreply@workledger.my';
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.workledger.my';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Email templates ───────────────────────────────────────────────────────────

function approvedHtml(data: {
  recipientName: string;
  approverName:  string;
  contractNumber: string;
  entryDate:     string;
  entryId:       string;
}) {
  const link = `${APP_URL}/work/${data.entryId}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#0f172a;padding:24px 28px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">WorkLedger</p>
      <h1 style="color:#fff;font-size:20px;margin:0;">Work Entry Approved ✅</h1>
    </div>
    <div style="padding:28px;">
      <p style="color:#374151;margin:0 0 16px;">Hi <strong>${data.recipientName}</strong>,</p>
      <p style="color:#374151;margin:0 0 16px;">
        Your work entry has been <strong style="color:#16a34a;">approved</strong> by ${data.approverName}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Contract</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${data.contractNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Entry Date</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${data.entryDate}</td></tr>
      </table>
      <a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View Entry →</a>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">You received this because you submitted a work entry on WorkLedger.</p>
    </div>
  </div>
</body>
</html>`;
}

function rejectedHtml(data: {
  recipientName: string;
  approverName:  string;
  contractNumber: string;
  entryDate:     string;
  entryId:       string;
  reason:        string;
}) {
  const link = `${APP_URL}/work/${data.entryId}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#0f172a;padding:24px 28px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">WorkLedger</p>
      <h1 style="color:#fff;font-size:20px;margin:0;">Work Entry Needs Correction ⚠️</h1>
    </div>
    <div style="padding:28px;">
      <p style="color:#374151;margin:0 0 16px;">Hi <strong>${data.recipientName}</strong>,</p>
      <p style="color:#374151;margin:0 0 16px;">
        Your work entry was <strong style="color:#dc2626;">returned for correction</strong> by ${data.approverName}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Contract</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${data.contractNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Entry Date</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${data.entryDate}</td></tr>
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:0 0 24px;">
        <p style="color:#991b1b;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Reason for rejection</p>
        <p style="color:#7f1d1d;font-size:14px;margin:0;">${data.reason}</p>
      </div>
      <p style="color:#374151;font-size:14px;margin:0 0 20px;">Please correct your entry and resubmit.</p>
      <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View &amp; Edit Entry →</a>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">You received this because you submitted a work entry on WorkLedger.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY secret is not set. Configure it in Supabase Dashboard → Edge Functions → Secrets.');
    }

    const body = await req.json();
    const { type, entryId, recipientEmail, recipientName, approverName, contractNumber, entryDate, reason } = body;

    if (!type || !entryId || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, entryId, recipientEmail' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const isApproved = type === 'approved';
    const subject    = isApproved
      ? `✅ Work Entry Approved — ${contractNumber} (${entryDate})`
      : `⚠️ Work Entry Returned for Correction — ${contractNumber} (${entryDate})`;

    const html = isApproved
      ? approvedHtml({ recipientName: recipientName || 'Team Member', approverName: approverName || 'Your Manager', contractNumber, entryDate, entryId })
      : rejectedHtml({ recipientName: recipientName || 'Team Member', approverName: approverName || 'Your Manager', contractNumber, entryDate, entryId, reason: reason || '(No reason provided)' });

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [recipientEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend API error ${res.status}: ${errBody}`);
    }

    const result = await res.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('notify-approval error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
