import type { AnalysisResult, Client, ClinicSettings, PlanItem } from './types';
import { CONCERN_BY_ID } from './analysis';
import { TREATMENT_BY_ID } from './treatments';
import { fmtDate, fmtMoney, fullName } from './format';

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

export interface SummaryInput {
  client: Client | null;
  settings: ClinicSettings;
  before: HTMLCanvasElement;
  after: HTMLCanvasElement | null;
  analysis: AnalysisResult;
  plan: PlanItem[];
  date: string;
  notes?: string;
}

/** Render a shareable consultation summary (1080 x 1920). */
export function renderSummary(input: SummaryInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbf8f4';
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = '#1f5f5b';
  ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '700 44px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText(input.settings.clinicName || 'Consultation', 56, 86);
  ctx.font = '500 28px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText(`Consultation summary · ${fmtDate(input.date)}`, 56, 136);
  ctx.font = '600 30px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#1d1b19';
  ctx.fillText(fullName(input.client), 56, 250);
  if (input.settings.practitioner) {
    ctx.font = '400 24px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#6f6761';
    ctx.fillText(`Practitioner: ${input.settings.practitioner}`, 56, 288);
  }

  // photos
  const pw = 470;
  const ph = Math.round((pw * 4) / 3);
  const py = 320;
  const drawPhoto = (img: HTMLCanvasElement, x: number, label: string) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, py, pw, ph, 20);
    ctx.clip();
    const s = Math.max(pw / img.width, ph / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, x + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 16, py + 16, 150, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 24px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText(label, x + 36, py + 46);
  };
  drawPhoto(input.before, 56, 'Before');
  if (input.after) drawPhoto(input.after, 56 + pw + 28, 'Simulated');

  // concerns
  let y = py + ph + 70;
  ctx.fillStyle = '#1d1b19';
  ctx.font = '700 32px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText(`Key findings · skin score ${input.analysis.overallSkin}/100 · ${input.analysis.skinTone.category.toLowerCase()} tone`, 56, y);
  y += 26;
  const top = [...input.analysis.concerns].sort((a, b) => b.score - a.score).slice(0, 6);
  for (const cs of top) {
    y += 48;
    const def = CONCERN_BY_ID[cs.id];
    ctx.fillStyle = '#1d1b19';
    ctx.font = '500 26px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText(def.label, 56, y);
    ctx.fillStyle = '#eee6de';
    ctx.beginPath();
    ctx.roundRect(520, y - 18, 420, 16, 8);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(520, y - 18, Math.max(16, (420 * cs.score) / 100), 16, 8);
    ctx.fill();
    ctx.fillStyle = '#1d1b19';
    ctx.font = '700 26px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(cs.score), 1024, y);
    ctx.textAlign = 'left';
  }

  // plan
  y += 90;
  ctx.font = '700 32px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Proposed treatment plan', 56, y);
  if (!input.plan.length) {
    y += 44;
    ctx.font = '400 26px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#6f6761';
    ctx.fillText('No treatments selected yet.', 56, y);
  }
  let total = 0;
  for (const item of input.plan) {
    y += 48;
    const def = TREATMENT_BY_ID[item.treatmentId];
    total += item.price;
    ctx.fillStyle = '#1d1b19';
    ctx.font = '500 26px -apple-system, Helvetica, Arial, sans-serif';
    const zones = item.zones ? Object.entries(item.zones).filter(([, v]) => v).map(([k]) => def.zones?.find((z) => z.id === k)?.label ?? k) : [];
    ctx.fillText(`${def.name}${zones.length ? ` (${zones.join(', ')})` : ''}`, 56, y);
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(item.price, input.settings.currency), 1024, y);
    ctx.textAlign = 'left';
  }
  if (input.plan.length) {
    y += 56;
    ctx.font = '700 30px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText('Estimated total', 56, y);
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(total, input.settings.currency), 1024, y);
    ctx.textAlign = 'left';
  }
  if (input.notes) {
    y += 56;
    ctx.font = '400 24px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#1d1b19';
    y = wrap(ctx, `Notes: ${input.notes}`, 56, y, W - 112, 32);
  }

  // disclaimer
  ctx.fillStyle = '#6f6761';
  ctx.font = '400 20px -apple-system, Helvetica, Arial, sans-serif';
  wrap(ctx, input.settings.disclaimer, 56, H - 150, W - 112, 28);
  return c;
}

export async function shareOrDownload(canvas: HTMLCanvasElement, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.92));
  const file = new File([blob], filename, { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
