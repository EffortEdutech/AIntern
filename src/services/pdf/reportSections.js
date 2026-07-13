/**
 * AIntern - Shared PDF section drawers (Phase B)
 *
 * Extracted verbatim from logbookPdf.js so the new chapter-aware
 * finalReportPdf.js (Case 2: full training-report import) can reuse the
 * EXACT SAME entries table, evaluations table, and Verification Appendix
 * drawing — rather than a second hand-copied implementation that could
 * silently drift from the logbook's. logbookPdf.js now calls these same
 * functions; behavior is unchanged from before this file existed.
 *
 * @file src/services/pdf/reportSections.js
 * @created July 12, 2026 - Phase B
 */

import autoTable from 'jspdf-autotable';
import { qrPngDataUrl } from '../render/qr';
import { fieldRows as buildFieldRows } from '../render/fieldRows';

export const RUBRIC_LABELS = {
  communication: 'Communication',
  punctuality: 'Punctuality & discipline',
  problem_solving: 'Problem-solving',
  quality: 'Quality of work',
  initiative: 'Initiative',
  teamwork: 'Teamwork',
  professionalism: 'Professionalism',
};

export function ensureSpace(doc, y, needed, margin) {
  if (y + needed > 282) {
    doc.addPage();
    return margin;
  }
  return y;
}

// Bulleted (list/repeater-type) fields get one "• line" per row, joined
// with \n — jspdf-autotable wraps cell text as-is and honors explicit line
// breaks. Single-value fields render exactly as before (no bullet).
export function fieldRows(data, template) {
  return buildFieldRows(data, template).map(({ field_name, lines }) => [
    field_name,
    lines.length > 1 ? lines.map((l) => `• ${l}`).join('\n') : lines[0],
  ]);
}

/** "Approved Daily Entries" heading + one table+comment+signature block per day. */
export function drawEntriesSection(doc, { snapshots, template, layout, accent, fs, M, W }, startY) {
  let y = startY;
  doc.setFontSize(fs(16));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Approved Daily Entries', M, y);
  y += 8;

  snapshots.forEach((snap) => {
    y = ensureSpace(doc, y, 40, M);

    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, W, 8, 'F');
    doc.setFontSize(fs(11));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(snap.entry_date, M + 2, y + 5.5);
    doc.setFontSize(fs(8));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Approved ${String(snap.approved_at).slice(0, 10)}`, M + W - 2, y + 5.5, { align: 'right' });
    y += 10;

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: fs(9), cellPadding: layout.density === 'compact' ? 1.2 : 1.6, lineColor: [226, 232, 240], textColor: [30, 41, 59] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48, fillColor: [248, 250, 252] } },
      body: fieldRows(snap.content, template),
    });
    y = doc.lastAutoTable.finalY + 3;

    if (layout.show_comments && snap.supervisor_comment) {
      y = ensureSpace(doc, y, 12, M);
      doc.setFontSize(fs(9));
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      const comment = doc.splitTextToSize(`Supervisor: ${snap.supervisor_comment}`, W);
      doc.text(comment, M, y + 4);
      y += comment.length * 4 + 3;
    }

    if (layout.show_signatures && snap.supervisor_signature?.startsWith('data:image')) {
      y = ensureSpace(doc, y, 22, M);
      try {
        doc.addImage(snap.supervisor_signature, 'PNG', M, y, 36, 12);
        doc.setFontSize(fs(7));
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Signed by ${snap.supervisor_name}`, M, y + 15);
        y += 18;
      } catch { /* skip malformed signature image */ }
    }
    y += 4;
  });

  return y;
}

/** "Supervisor Evaluations" heading + one rubric table per evaluation. */
export function drawEvaluationsSection(doc, { evaluations, layout, accent, fs, M, W }, startY) {
  let y = startY;
  doc.setFontSize(fs(16));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Supervisor Evaluations', M, y);
  y += 8;

  evaluations.forEach((ev) => {
    y = ensureSpace(doc, y, 60, M);
    doc.setFontSize(fs(11));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${ev.period_start} to ${ev.period_end} (${ev.cadence_days}-day review)`, M, y + 4);
    y += 7;

    doc.setFontSize(fs(8));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const s = ev.summary ?? {};
    doc.text(
      `Days logged: ${s.days_logged ?? '-'} | Approved entries: ${s.approved_count ?? '-'} | Total hours: ${s.total_hours ?? '-'}`,
      M, y + 3,
    );
    y += 6;

    const scoreRows = Object.entries(RUBRIC_LABELS)
      .filter(([k]) => ev.scores?.[k])
      .map(([k, label]) => [label, `${ev.scores[k]} / 5`]);
    (ev.custom_kpis ?? []).forEach((kpi) => {
      if (kpi?.name && kpi?.score) scoreRows.push([`${kpi.name} (custom)`, `${kpi.score} / 5`]);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: fs(9), cellPadding: layout.density === 'compact' ? 1.2 : 1.6, lineColor: [226, 232, 240], textColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center' } },
      head: [['Criterion', 'Rating']],
      headStyles: { fillColor: accent, fontSize: fs(9) },
      body: scoreRows,
    });
    y = doc.lastAutoTable.finalY + 4;

    const comments = [
      ['Strengths', ev.comments?.strengths],
      ['Areas for improvement', ev.comments?.improvements],
    ].filter(([, v]) => v && String(v).trim());
    comments.forEach(([label, text]) => {
      y = ensureSpace(doc, y, 14, M);
      doc.setFontSize(fs(9));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(label, M, y + 4);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(text), W);
      doc.text(lines, M, y + 9);
      y += 9 + lines.length * 4;
    });

    if (layout.show_signatures && ev.supervisor_signature?.startsWith('data:image')) {
      y = ensureSpace(doc, y, 22, M);
      try {
        doc.addImage(ev.supervisor_signature, 'PNG', M, y, 36, 12);
        doc.setFontSize(fs(7));
        doc.setTextColor(148, 163, 184);
        doc.text(`Signed by ${ev.supervisor_name} | ${String(ev.submitted_at).slice(0, 10)}`, M, y + 15);
        y += 18;
      } catch { /* skip */ }
    }
    y += 6;
  });

  return y;
}

/** Verification Appendix page (spec §25-27) — verified snapshots only. */
export function drawVerificationAppendix(doc, { verification, accent, fs, M, W }) {
  if (!verification?.verification_id) return;
  doc.addPage();
  let y = M;
  doc.setFontSize(fs(16));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Verification Appendix', M, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { fontSize: fs(9), cellPadding: 1.8, lineColor: [226, 232, 240], textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [248, 250, 252] } },
    body: [
      ['Verification status', 'VERIFIED'],
      ['Verification ID', verification.verification_id],
      ['Report version', `v${verification.version}`],
      ['Snapshot created', String(verification.created_at).slice(0, 10)],
      ['Record fingerprint', String(verification.content_hash)],
      ['Verify online', verification.verify_url],
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  const qrUrl = qrPngDataUrl(verification.verify_url);
  if (qrUrl) {
    try {
      doc.addImage(qrUrl, 'PNG', M, y, 34, 34);
    } catch { /* QR optional */ }
  }
  doc.setFontSize(fs(9));
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const note = doc.splitTextToSize(
    'Scan the QR code or visit the link above to confirm this document was '
    + 'generated from an officially verified internship record. Every entry was '
    + 'individually approved and digitally signed by the workplace supervisor. '
    + 'This appendix verifies authenticity without exposing report content.',
    W - 42,
  );
  doc.text(note, M + 40, y + 5);
}

export default { drawEntriesSection, drawEvaluationsSection, drawVerificationAppendix, fieldRows, ensureSpace, RUBRIC_LABELS };
