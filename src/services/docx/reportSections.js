/**
 * AIntern - Shared DOCX section builders (Phase B)
 *
 * Extracted verbatim from logbookDocx.js so the new chapter-aware
 * finalReportDocx.js (Case 2: full training-report import) can reuse the
 * EXACT SAME entries table, evaluations table, kvTable, and Verification
 * Appendix building — rather than a second hand-copied implementation.
 * logbookDocx.js now calls these same functions; behavior is unchanged
 * from before this file existed.
 *
 * @file src/services/docx/reportSections.js
 * @created July 12, 2026 - Phase B
 */

import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, ImageRun, BorderStyle,
} from 'docx';
import { fieldRows as buildFieldRows } from '../render/fieldRows';

export function b64ToUint8(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] ?? '';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// List/repeater-type fields keep their lines as an array here (rather than
// joining to a string) so kvTable() below can render each as its own
// paragraph — Word bullets read better as separate paragraphs than
// \n-joined text.
export function fieldRows(data, template) {
  return buildFieldRows(data, template).map(({ field_name, lines }) => [
    field_name,
    lines.length > 1 ? lines : lines[0],
  ]);
}

export const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
  left: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
  right: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
};

export function kvTable(rows, boldColWidth = 32) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: boldColWidth, type: WidthType.PERCENTAGE },
          shading: { fill: 'F8FAFC' },
          children: [new Paragraph({ children: [new TextRun({ text: String(k), bold: true, size: 18 })] })],
        }),
        new TableCell({
          borders: cellBorders,
          // Array value (list/repeater-type field): one paragraph per
          // bullet. Everything else: unchanged single line.
          children: Array.isArray(v)
            ? v.map((line) => new Paragraph({ children: [new TextRun({ text: `• ${line}`, size: 18 })] }))
            : [new Paragraph({ children: [new TextRun({ text: String(v), size: 18 })] })],
        }),
      ],
    })),
  });
}

export const RUBRIC_LABELS = {
  communication: 'Communication',
  punctuality: 'Punctuality & discipline',
  problem_solving: 'Problem-solving',
  quality: 'Quality of work',
  initiative: 'Initiative',
  teamwork: 'Teamwork',
  professionalism: 'Professionalism',
};

/** "Approved Daily Entries" heading + one kvTable+comment+signature block per day. */
export function entriesSectionChildren({ snapshots, template, layout, accent }) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'Approved Daily Entries', bold: true, size: 32, color: accent })],
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
  ];

  snapshots.forEach((snap) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: snap.entry_date, bold: true, size: 24, color: accent }),
        new TextRun({ text: `   (approved ${String(snap.approved_at).slice(0, 10)})`, size: 16, color: '64748B' }),
      ],
      spacing: { before: 300, after: 100 },
    }));
    const rows = fieldRows(snap.content, template);
    if (rows.length > 0) children.push(kvTable(rows));
    if (layout.show_comments && snap.supervisor_comment) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Supervisor: ${snap.supervisor_comment}`, italics: true, size: 18, color: '475569' })],
        spacing: { before: 100 },
      }));
    }
    if (layout.show_signatures && String(snap.supervisor_signature ?? '').startsWith('data:image')) {
      try {
        children.push(new Paragraph({
          children: [new ImageRun({ data: b64ToUint8(snap.supervisor_signature), transformation: { width: 140, height: 47 } })],
          spacing: { before: 80 },
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: `Signed by ${snap.supervisor_name}`, size: 14, color: '94A3B8' })],
        }));
      } catch { /* signature optional */ }
    }
  });

  return children;
}

/** "Supervisor Evaluations" heading + one rubric kvTable per evaluation. */
export function evaluationsSectionChildren({ evaluations, layout, accent }) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'Supervisor Evaluations', bold: true, size: 32, color: accent })],
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
  ];

  evaluations.forEach((ev) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${ev.period_start} to ${ev.period_end} (${ev.cadence_days}-day review)`, bold: true, size: 22 })],
      spacing: { before: 300, after: 100 },
    }));
    const scoreRows = Object.entries(RUBRIC_LABELS)
      .filter(([k]) => ev.scores?.[k])
      .map(([k, label]) => [label, `${ev.scores[k]} / 5`]);
    (ev.custom_kpis ?? []).forEach((kpi) => {
      if (kpi?.name && kpi?.score) scoreRows.push([`${kpi.name} (custom)`, `${kpi.score} / 5`]);
    });
    if (scoreRows.length > 0) children.push(kvTable(scoreRows, 60));
    [['Strengths', ev.comments?.strengths], ['Areas for improvement', ev.comments?.improvements]]
      .filter(([, v]) => v && String(v).trim())
      .forEach(([label, text]) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 18 }),
            new TextRun({ text: String(text), size: 18 }),
          ],
          spacing: { before: 100 },
        }));
      });
    if (layout.show_signatures && String(ev.supervisor_signature ?? '').startsWith('data:image')) {
      try {
        children.push(new Paragraph({
          children: [new ImageRun({ data: b64ToUint8(ev.supervisor_signature), transformation: { width: 140, height: 47 } })],
          spacing: { before: 80 },
        }));
      } catch { /* optional */ }
    }
  });

  return children;
}

/** Verification Appendix section (spec §25-27) — verified snapshots only. */
export function verificationAppendixChildren({ verification, qrPng, accent }) {
  if (!verification?.verification_id) return [];
  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'Verification Appendix', bold: true, size: 32, color: accent })],
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    kvTable([
      ['Verification status', 'VERIFIED'],
      ['Verification ID', verification.verification_id],
      ['Report version', `v${verification.version}`],
      ['Snapshot created', String(verification.created_at).slice(0, 10)],
      ['Record fingerprint', String(verification.content_hash)],
      ['Verify online', verification.verify_url],
    ], 32),
  ];
  if (qrPng) {
    try {
      children.push(new Paragraph({
        children: [new ImageRun({ data: b64ToUint8(qrPng), transformation: { width: 120, height: 120 } })],
        spacing: { before: 200 },
      }));
    } catch { /* optional */ }
  }
  children.push(new Paragraph({
    children: [new TextRun({
      text: 'Scan the QR code or visit the link above to confirm this document was generated '
        + 'from an officially verified internship record. Edits made to this Word document do '
        + 'not modify the official record maintained by AIntern.',
      size: 16, color: '475569',
    })],
    spacing: { before: 150 },
  }));
  return children;
}

export default {
  fieldRows, kvTable, cellBorders, RUBRIC_LABELS, b64ToUint8,
  entriesSectionChildren, evaluationsSectionChildren, verificationAppendixChildren,
};
