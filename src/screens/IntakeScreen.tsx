import React, { useState } from 'react';
import { useApp } from '../App';
import { TopBar, Chip, SignaturePad } from '../components/ui';
import { db } from '../lib/db';
import type { Client } from '../lib/types';
import { uid } from '../lib/image';

const CONCERN_OPTIONS = ['Lines & wrinkles', 'Volume loss', 'Pigmentation', 'Redness', 'Acne & texture', 'Under-eye', 'Lips', 'Jawline & chin', 'Skin quality', 'Sagging'];
const SKIN_TYPES = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

function emptyClient(): Client {
  const now = new Date().toISOString();
  return {
    id: uid(),
    firstName: '',
    lastName: '',
    concerns: [],
    consent: { photo: false, analysis: false, marketing: false },
    createdAt: now,
    updatedAt: now,
  };
}

export default function IntakeScreen(): React.JSX.Element {
  const { clients, editingClientId, intakeReturnTo, navigate, back, refreshClients, setSelectedClientId, resetDraft, setDraft, toast } = useApp();
  const existing = editingClientId ? clients.find((c) => c.id === editingClientId) : undefined;
  const [form, setForm] = useState<Client>(() => (existing ? { ...existing, consent: { ...existing.consent } } : emptyClient()));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setConsent = (k: keyof Client['consent'], v: boolean | string | undefined) => setForm((f) => ({ ...f, consent: { ...f.consent, [k]: v } }));

  const consentOk = form.consent.photo && form.consent.analysis;

  const save = async (thenStart: boolean): Promise<void> => {
    if (!form.firstName.trim()) {
      toast('First name is required');
      return;
    }
    if (thenStart && !consentOk) {
      toast('Photo and analysis consent are required to start');
      return;
    }
    setSaving(true);
    try {
      const client: Client = {
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        updatedAt: new Date().toISOString(),
        consent: { ...form.consent, signedAt: consentOk ? form.consent.signedAt ?? new Date().toISOString() : undefined },
      };
      await db.putClient(client);
      await refreshClients();
      setSelectedClientId(client.id);
      if (intakeReturnTo === 'plan') {
        setDraft({ client });
        toast('Client added');
        navigate('plan', { replace: true });
      } else if (thenStart) {
        resetDraft();
        setDraft({ client });
        navigate('capture', { replace: true });
      } else {
        toast('Client saved');
        navigate('client', { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title={existing ? 'Edit client' : 'New client intake'} onBack={back} />
      <div className="content">
        <div className="card stack">
          <h3>Client details</h3>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="firstName">First name *</label>
              <input id="firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" value={form.dob ?? ''} onChange={(e) => set('dob', e.target.value || undefined)} />
            </div>
            <div className="field">
              <label htmlFor="skinType">Fitzpatrick skin type</label>
              <select id="skinType" value={form.skinType ?? ''} onChange={(e) => set('skinType', e.target.value || undefined)}>
                {SKIN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t ? `Type ${t}` : 'Not set'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || undefined)} autoComplete="tel" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value || undefined)} autoComplete="email" />
            </div>
          </div>
        </div>

        <div className="card stack">
          <h3>What would you like to improve?</h3>
          <div className="chips">
            {CONCERN_OPTIONS.map((c) => (
              <Chip key={c} on={form.concerns.includes(c)} onClick={() => set('concerns', form.concerns.includes(c) ? form.concerns.filter((x) => x !== c) : [...form.concerns, c])}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h3>Medical history</h3>
          <div className="field">
            <label htmlFor="allergies">Allergies</label>
            <input id="allergies" value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value || undefined)} placeholder="e.g. lidocaine, latex" />
          </div>
          <div className="field">
            <label htmlFor="medications">Current medications</label>
            <input id="medications" value={form.medications ?? ''} onChange={(e) => set('medications', e.target.value || undefined)} placeholder="e.g. blood thinners, isotretinoin" />
          </div>
          <div className="field">
            <label htmlFor="previous">Previous aesthetic treatments</label>
            <input id="previous" value={form.previousTreatments ?? ''} onChange={(e) => set('previousTreatments', e.target.value || undefined)} placeholder="e.g. anti-wrinkle injections 6 months ago" />
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
          </div>
        </div>

        <div className="card stack">
          <h3>Consent</h3>
          <label className="check">
            <input type="checkbox" checked={form.consent.photo} onChange={(e) => setConsent('photo', e.target.checked)} />
            <span>I consent to facial photographs being taken and stored on this device for my consultation record.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.consent.analysis} onChange={(e) => setConsent('analysis', e.target.checked)} />
            <span>I understand the automated analysis and treatment simulations are visual aids only and not a diagnosis or guarantee of results.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.consent.marketing} onChange={(e) => setConsent('marketing', e.target.checked)} />
            <span>I agree to receive follow-up information about my treatment plan (optional).</span>
          </label>
          <SignaturePad value={form.consent.signature} onChange={(v) => setConsent('signature', v)} />
        </div>
      </div>
      <div className="bottom-bar">
        {intakeReturnTo === 'plan' ? (
          <button className="btn primary" disabled={saving || !consentOk} onClick={() => save(false)} data-testid="save-client">
            Save & continue to plan
          </button>
        ) : (
          <>
            <button className="btn secondary" disabled={saving} onClick={() => save(false)} data-testid="save-client">
              Save
            </button>
            <button className="btn primary" disabled={saving || !consentOk} onClick={() => save(true)} data-testid="save-start">
              Save & start consultation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
