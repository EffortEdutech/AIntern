/**
 * AIntern - Portfolio Service (v1.1 R5 — Portfolio Engine, spec §43)
 *
 * Turns the VERIFIED record (approved snapshots + supervisor evaluations)
 * into career assets: professional summary, skills, ATS-friendly résumé
 * bullets, highlights, interview talking points.
 *
 * Design:
 *  - Evidence-only: the AI receives a digest built strictly from
 *    supervisor-approved snapshots and evaluations. Drafts never qualify.
 *  - Server prompt authority: the 'portfolio' prompt lives in ai-gateway
 *    (v6); the client ships only the digest and sanitizes the JSON reply.
 *  - No new tables: the result caches in internships.metadata.portfolio
 *    (regenerate any time; the verified record is the source of truth).
 *
 * @file src/services/api/portfolioService.js
 * @created July 11, 2026 - v1.1 R5
 */

import { aiService } from './aiService';
import { internshipService } from './internshipService';

const DIGEST_CHAR_CAP = 7000; // gateway trims at 8000; keep headroom

/** Flatten one snapshot's form content into a single evidence line. */
function entryLine(snap) {
  const values = Object.values(snap.content ?? {})
    .map((v) => String(v ?? '').trim())
    .filter((v) => v && v.length > 1);
  const text = values.join(' | ').slice(0, 320);
  return `${snap.entry_date}: ${text}`;
}

function evalLine(ev) {
  const scores = Object.entries(ev.scores ?? {})
    .map(([k, v]) => `${k}=${v}/5`)
    .join(', ');
  const parts = [
    `Evaluation ${ev.period_start}..${ev.period_end}: ${scores}`,
    ev.comments?.strengths ? `Strengths: ${String(ev.comments.strengths).slice(0, 240)}` : '',
    ev.comments?.improvements ? `Improve: ${String(ev.comments.improvements).slice(0, 160)}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

const strArr = (v, max, maxLen = 200) =>
  (Array.isArray(v) ? v : [])
    .map((s) => String(s ?? '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, max);

class PortfolioService {
  /**
   * Compact evidence digest (verified data only). Entries are sampled
   * evenly if the record is too long for the cap — start and recent
   * entries are always kept.
   */
  buildDigest({ profile, internship, snapshots, evaluations }) {
    const head = [
      `Intern: ${profile?.full_name ?? '-'} | ${profile?.course ?? '-'} @ ${profile?.university ?? '-'}`,
      `Placement: ${internship?.company_name ?? '-'} (${internship?.department ?? '-'}), ${internship?.start_date} to ${internship?.end_date}`,
      `Approved entries: ${snapshots.length} | Evaluations: ${evaluations.length}`,
      '--- APPROVED DAILY ENTRIES ---',
    ];
    const evalBlock = evaluations.length
      ? ['--- SUPERVISOR EVALUATIONS ---', ...evaluations.map(evalLine)]
      : [];

    let entries = snapshots.map(entryLine);
    let digest = [...head, ...entries, ...evalBlock].join('\n');
    // Evenly thin the middle until it fits (keep first 5 + last 10).
    while (digest.length > DIGEST_CHAR_CAP && entries.length > 20) {
      const keepHead = entries.slice(0, 5);
      const middle = entries.slice(5, -10).filter((_, i) => i % 2 === 0);
      const keepTail = entries.slice(-10);
      entries = [...keepHead, ...middle, ...keepTail];
      digest = [...head, ...entries, ...evalBlock].join('\n');
    }
    return digest.slice(0, DIGEST_CHAR_CAP);
  }

  /** Client-side authority over the AI's JSON (mirror of gateway sanitizers). */
  sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const highlights = (Array.isArray(raw.highlights) ? raw.highlights : [])
      .map((h) => ({
        title: String(h?.title ?? '').trim().slice(0, 90),
        description: String(h?.description ?? '').trim().slice(0, 300),
      }))
      .filter((h) => h.title)
      .slice(0, 3);
    const out = {
      summary: String(raw.summary ?? '').trim().slice(0, 600),
      technical_skills: strArr(raw.technical_skills, 10, 60),
      soft_skills: strArr(raw.soft_skills, 8, 60),
      resume_bullets: strArr(raw.resume_bullets, 8, 260),
      highlights,
      talking_points: strArr(raw.talking_points, 3, 300),
    };
    if (!out.summary && out.resume_bullets.length === 0) return null;
    return out;
  }

  parseModelJson(text) {
    const cleaned = String(text ?? '').trim()
      .replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }

  /**
   * Generate a fresh portfolio from the verified record.
   * @returns {Promise<{success, data?, tier?, error?}>}
   */
  async generate({ profile, internship, snapshots, evaluations, provider = 'openai' }) {
    if (!snapshots?.length) {
      return { success: false, error: 'No approved entries yet — the portfolio is built only from supervisor-approved work.' };
    }
    const digest = this.buildDigest({ profile, internship, snapshots, evaluations });
    const hints = {};
    if (internship?.metadata?.industry) hints.industry = internship.metadata.industry;

    const res = await aiService.generate('portfolio', digest, hints, provider);
    if (!res.success) return res;

    const portfolio = this.sanitize(this.parseModelJson(res.text));
    if (!portfolio) {
      return { success: false, error: 'The AI reply could not be read as a portfolio. Please try again.' };
    }
    return {
      success: true,
      data: {
        ...portfolio,
        generated_at: new Date().toISOString(),
        source: { entries: snapshots.length, evaluations: evaluations.length },
      },
      tier: res.tier,
    };
  }

  /** Cache the generated portfolio in internships.metadata.portfolio. */
  async save(internship, portfolio) {
    const metadata = { ...(internship.metadata ?? {}), portfolio };
    return internshipService.updateInternship(internship.id, { metadata });
  }

  cached(internship) {
    return internship?.metadata?.portfolio ?? null;
  }

  /** Plain-markdown rendering for copy-to-clipboard / paste into a résumé. */
  toMarkdown(p, profile) {
    const lines = [
      `# ${profile?.full_name ?? 'Internship'} — Internship Portfolio`,
      '',
      p.summary,
      '',
      '## Key achievements',
      ...p.resume_bullets.map((b) => `- ${b}`),
    ];
    if (p.highlights.length) {
      lines.push('', '## Highlights');
      p.highlights.forEach((h) => lines.push(`- **${h.title}** — ${h.description}`));
    }
    if (p.technical_skills.length) lines.push('', `**Technical skills:** ${p.technical_skills.join(', ')}`);
    if (p.soft_skills.length) lines.push(`**Soft skills:** ${p.soft_skills.join(', ')}`);
    if (p.talking_points.length) {
      lines.push('', '## Interview talking points');
      p.talking_points.forEach((t) => lines.push(`- ${t}`));
    }
    return lines.join('\n');
  }
}

export const portfolioService = new PortfolioService();
export default portfolioService;
