import React, { useState } from 'react';
import { useApp } from '../App';
import { TopBar, Switch } from '../components/ui';
import { TREATMENTS } from '../lib/treatments';
import { DEFAULT_DISCLAIMER } from '../lib/db';
import type { ClinicSettings, TreatmentId } from '../lib/types';

const CURRENCIES = ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'NZD', 'INR', 'AED', 'SGD'];

export default function SettingsScreen(): React.JSX.Element {
  const { settings, saveSettings, back, toast } = useApp();
  const [form, setForm] = useState<ClinicSettings>(settings);
  const set = <K extends keyof ClinicSettings>(k: K, v: ClinicSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTreatment = (id: TreatmentId, enabled: boolean) =>
    set('disabledTreatments', enabled ? form.disabledTreatments.filter((t) => t !== id) : [...form.disabledTreatments, id]);

  const save = async () => {
    await saveSettings(form);
    toast('Settings saved');
    back();
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all clients and consultations stored on this device? This cannot be undone.')) return;
    const req = indexedDB.deleteDatabase('jointglow-clinical');
    req.onsuccess = () => window.location.reload();
    req.onerror = () => toast('Could not clear data');
  };

  return (
    <div className="screen">
      <TopBar title="Settings" onBack={back} />
      <div className="content">
        <div className="card stack">
          <h3>Clinic</h3>
          <div className="field">
            <label htmlFor="clinicName">Clinic name</label>
            <input id="clinicName" value={form.clinicName} onChange={(e) => set('clinicName', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="practitioner">Practitioner</label>
            <input id="practitioner" value={form.practitioner} onChange={(e) => set('practitioner', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 600 }}>Auto-capture</div>
              <div className="sub">Take the photo automatically once framing, pose and lighting are right.</div>
            </div>
            <Switch on={form.autoCapture} onChange={(v) => set('autoCapture', v)} ariaLabel="Auto capture" />
          </div>
        </div>

        <div className="card stack">
          <h3>Treatment menu & pricing</h3>
          {TREATMENTS.map((t) => {
            const enabled = !form.disabledTreatments.includes(t.id);
            return (
              <div key={t.id} className="row" style={{ alignItems: 'center' }}>
                <Switch on={enabled} onChange={(v) => toggleTreatment(t.id, v)} ariaLabel={t.name} />
                <div style={{ flex: 1, opacity: enabled ? 1 : 0.5 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                  <div className="sub">{t.priceUnit}</div>
                </div>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  style={{ width: 96, padding: '8px 10px' }}
                  value={form.prices[t.id] ?? t.defaultPrice}
                  onChange={(e) => set('prices', { ...form.prices, [t.id]: Number(e.target.value) || 0 })}
                  aria-label={`${t.name} price`}
                />
              </div>
            );
          })}
        </div>

        <div className="card stack">
          <h3>Disclaimer shown on summaries</h3>
          <textarea className="input" value={form.disclaimer} onChange={(e) => set('disclaimer', e.target.value)} style={{ minHeight: 120 }} />
          <button className="btn ghost sm" onClick={() => set('disclaimer', DEFAULT_DISCLAIMER)}>
            Reset to default
          </button>
        </div>

        <div className="card stack">
          <h3>Data</h3>
          <p className="sub">All client records, photos and consultations are stored only on this device (in the browser's local database). Nothing is uploaded.</p>
          <button className="btn danger" onClick={clearAll}>
            Delete all data on this device
          </button>
        </div>
      </div>
      <div className="bottom-bar">
        <button className="btn primary" onClick={save}>
          Save settings
        </button>
      </div>
    </div>
  );
}
