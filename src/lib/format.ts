import type { Client } from './types';

export function fmtMoney(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

export function initials(c: Pick<Client, 'firstName' | 'lastName'>): string {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function fullName(c: Pick<Client, 'firstName' | 'lastName'> | null | undefined): string {
  if (!c) return 'Walk-in client';
  return `${c.firstName} ${c.lastName}`.trim();
}

export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function scoreColor(score: number): string {
  if (score < 30) return '#2a9d8f';
  if (score < 55) return '#e9a23b';
  return '#d7263d';
}

export function scoreWord(score: number): string {
  if (score < 20) return 'Minimal';
  if (score < 40) return 'Mild';
  if (score < 60) return 'Moderate';
  if (score < 80) return 'Pronounced';
  return 'Severe';
}
