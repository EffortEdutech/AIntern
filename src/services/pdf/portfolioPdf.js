/**
 * AIntern - Portfolio PDF (v1.1 R5 — Portfolio Engine, spec §43)
 *
 * Compact 1-2 page career one-pager rendered from the AI-generated,
 * client-sanitized portfolio. When the internship has a VERIFIED report
 * version, the footer carries the Verification ID + QR — a career
 * document backed by a publicly checkable, supervisor-signed record.
 *
 * @file src/services/pdf/portfolioPdf.js
 * @created July 11, 2026 - v1.1 R5
 */

import { jsPDF } from 'jspdf';
import { qrPngDataUrl } from '../render/qr';

const M = 18;
const W = 210 - M * 2;

function ensureSpace(doc, y, needed) {
  if (y + needed > 275) {
    doc.addPage();
    return M;
  }
  return y;
}

function sectionTitle(doc, y, text, accent) {
  y = ensureSpace(doc, y, 14);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(text, M, y);
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, M + W, y + 1.5);
  return y + 7;
}

function bullets(doc, y, items, opts = {}) {
  const size = opts.size ?? 10;
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, W - 6);
    y = ensureSpace(doc, y, lines.length * 4.6 + 2);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.circle(M + 1.2, y - 1.2, 0.7, 'F');
    doc.text(lines, M + 5, y);
    y += lines.length * 4.6 + 1.6;
  });
  return y;
}

function chips(doc, y, items, accent) {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let x = M;
  items.forEach((label) => {
    const w = doc.getTextWidth(label) + 6;
    if (x + w > M + W) { x = M; y += 8; }
    y = ensureSpace(doc, y, 10);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, y - 4.5, w, 6.5, 1.6, 1.6, 'FD');
    doc.setTextColor(51, 65, 85);
    doc.text(label, x + 3, y);
    x += w + 3;
  });
  return y + 8;
}

/**
 * @param {Object} args
 * @param {Object} args.profile      - { full_name, university, course }
 * @param {Object} args.internship   - placement record
 * @param {Object} args.portfolio    - sanitized portfolio object
 * @param {Object} [args.verification] - { verification_id, verify_url, version } of latest VERIFIED report
 * @param {number[]} [args.accent]   - RGB accent (defaults to slate)
 */
export function generatePortfolioPdf({ profile, internship, portfolio, verification = null, accent = [15, 23, 42] }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const p = portfolio;

  // Header band
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(profile?.full_name || 'Intern', M, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${profile?.course || ''} — ${profile?.university || ''}`.replace(/^ — | — $/g, ''), M, 26);
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(9);
  doc.text(
    `Internship: ${internship?.company_name ?? '-'}${internship?.department ? ' · ' + internship.department : ''} · ${internship?.start_date} to ${internship?.end_date}`,
    M, 34,
  );

  let y = 54;

  // Summary
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const summary = doc.splitTextToSize(p.summary, W);
  doc.text(summary, M, y);
  y += summary.length * 4.8 + 6;

  // Achievements
  if (p.resume_bullets?.length) {
    y = sectionTitle(doc, y, 'Key Achievements', accent);
    y = bullets(doc, y, p.resume_bullets);
    y += 3;
  }

  // Highlights
  if (p.highlights?.length) {
    y = sectionTitle(doc, y, 'Highlights', accent);
    p.highlights.forEach((h) => {
      y = ensureSpace(doc, y, 14);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(h.title, M, y);
      y += 4.6;
      const desc = doc.splitTextToSize(h.description, W);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(desc, M, y);
      y += desc.length * 4.4 + 3;
    });
  }

  // Skills
  if (p.technical_skills?.length) {
    y = sectionTitle(doc, y, 'Technical Skills', accent);
    y = chips(doc, y + 1, p.technical_skills, accent);
  }
  if (p.soft_skills?.length) {
    y = sectionTitle(doc, y, 'Soft Skills', accent);
    y = chips(doc, y + 1, p.soft_skills, accent);
  }

  // Talking points
  if (p.talking_points?.length) {
    y = sectionTitle(doc, y, 'Interview Talking Points', accent);
    y = bullets(doc, y, p.talking_points, { size: 9.5 });
  }

  // Verification footer (spec §43 meets §25-27: career asset backed by record)
  y = ensureSpace(doc, y, 34);
  y = Math.max(y + 4, 245);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + W, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (verification) {
    try {
      doc.addImage(qrPngDataUrl(verification.verify_url, 4), 'PNG', M + W - 22, y - 2, 22, 22);
    } catch { /* QR optional */ }
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text('Backed by a verified internship record', M, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Verification ID ${verification.verification_id} (report v${verification.version}) — every entry supervisor-approved and digitally signed.`, M, y + 7);
    doc.text(`Verify independently: ${verification.verify_url}`, M, y + 12);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.text('Generated by AIntern from supervisor-approved daily records and evaluations.', M, y + 2);
  }
  doc.text(`Generated ${new Date().toISOString().split('T')[0]} · ${p.source?.entries ?? '-'} approved entries · ${p.source?.evaluations ?? '-'} evaluations`, M, verification ? y + 17 : y + 7);

  doc.save(`AIntern_Portfolio_${(profile?.full_name || 'intern').replace(/\s+/g, '_')}.pdf`);
}

export default generatePortfolioPdf;
