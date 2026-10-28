import React, { useMemo, useState } from 'react';
import { useApp } from '../App';
import { TopBar } from '../components/ui';
import { TREATMENT_BY_ID } from '../lib/treatments';
import { db } from '../lib/db';
import { canvasToBlob, thumbnail, uid } from '../lib/image';
import { renderSummary, shareOrDownload } from '../lib/summary';
import { fmtDate, fmtMoney, fullName } from '../lib/format';
import type { Consultation } from '../lib/types';

export default function PlanScreen(): React.JSX.Element {
  const { draft, setDraft, navigate, back, settings, toast, setEditingClientId, setIntakeReturnTo } = useApp();
  const { photo, analysis, capture, simulationImage, plan, client } = draft;
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const beforeUrl = useMemo(() => photo?.toDataURL('image/jpeg', 0.85) ?? '', [photo]);
  const afterUrl = useMemo(() => simulationImage?.toDataURL('image/jpeg', 0.85) ?? '', [simulationImage]);

  if (!photo || !analysis || !capture) {
    return (
      <div className="screen">
        <TopBar title="Treatment plan" onBack={back} />
        <div className="content">
          <div className="empty">Nothing to plan yet.</div>
        </div>
      </div>
    );
  }

  const total = plan.reduce((s, p) => s + p.price, 0);
  const date = new Date().toISOString();

  const setPrice = (i: number, price: number) => setDraft((d) => ({ ...d, plan: d.plan.map((p, k) => (k === i ? { ...p, price } : p)) }));
  const remove = (i: number) => setDraft((d) => ({ ...d, plan: d.plan.filter((_, k) => k !== i) }));

  const save = async () => {
    if (!client) {
      toast('Add client details to save this consultation');
      setEditingClientId(null);
      setIntakeReturnTo('plan');
      navigate('intake');
      return;
    }
    setSaving(true);
    try {
      const existing = draft.consultationId ? await db.getConsultation(draft.consultationId) : undefined;
      const consultation: Consultation = {
        id: existing?.id ?? uid(),
        clientId: client.id,
        createdAt: existing?.createdAt ?? date,
        photo: await canvasToBlob(photo, 'image/jpeg', 0.92),
        thumbnail: await canvasToBlob(thumbnail(photo, 240), 'image/jpeg', 0.8),
        capture,
        analysis: analysis.result,
        simulation: draft.simulation,
        plan,
        simulationImage: simulationImage ? await canvasToBlob(simulationImage, 'image/jpeg', 0.9) : undefined,
        notes: draft.notes || undefined,
      };
      await db.putConsultation(consultation);
      setDraft({ consultationId: consultation.id });
      toast('Consultation saved');
      navigate('client', { replace: true });
    } catch (e) {
      console.error(e);
      toast('Could not save consultation');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const summary = renderSummary({ client, settings, before: photo, after: simulationImage, analysis: analysis.result, plan, date, notes: draft.notes });
      const name = `${(fullName(client) || 'consultation').replace(/\s+/g, '-')}-${fmtDate(date).replace(/[\s,]+/g, '-')}.jpg`;
      const how = await shareOrDownload(summary, name, 'Consultation summary');
      toast(how === 'shared' ? 'Summary shared' : 'Summary downloaded');
    } catch (e) {
      console.error(e);
      toast('Could not create the summary');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Treatment plan" onBack={back} />
      <div className="content">
        <div className="two-up">
          <div className="photo-frame">
            <img src={beforeUrl} alt="Before" />
            <div className="legend">Before</div>
          </div>
          <div className="photo-frame">
            {afterUrl ? <img src={afterUrl} alt="Simulated" /> : <div className="empty" style={{ color: '#aaa' }}>No simulation</div>}
            <div className="legend">Simulated</div>
          </div>
        </div>

        <div className="card stack">
          <div className="row between">
            <h3>{fullName(client)}</h3>
            <span className="muted small">{fmtDate(date)}</span>
          </div>
          <div className="muted small">
            Skin score {analysis.result.overallSkin}/100 · {analysis.result.skinTone.category} tone
          </div>
        </div>

        <div className="card stack">
          <h3>Proposed treatments</h3>
          {plan.length === 0 && <p className="muted small">No treatments selected. Go back to the simulator to add some.</p>}
          {plan.map((item, i) => {
            const def = TREATMENT_BY_ID[item.treatmentId];
            const zones = item.zones ? Object.entries(item.zones).filter(([, v]) => v).map(([k]) => def.zones?.find((z) => z.id === k)?.label ?? k) : [];
            return (
              <div key={item.treatmentId} className="row" style={{ alignItems: 'flex-start' }} data-testid={`plan-${item.treatmentId}`}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{def.name}</div>
                  <div className="sub">
                    {zones.length ? `${zones.join(', ')} · ` : ''}
                    {def.intensityLabel.toLowerCase()} {Math.round(item.intensity * 100)}% · {def.onset}
                  </div>
                </div>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  style={{ width: 96, padding: '8px 10px' }}
                  value={item.price}
                  onChange={(e) => setPrice(i, Number(e.target.value) || 0)}
                  aria-label={`${def.name} price`}
                />
                <button className="icon-btn" aria-label="Remove" onClick={() => remove(i)}>
                  ×
                </button>
              </div>
            );
          })}
          {plan.length > 0 && (
            <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span style={{ fontWeight: 600 }}>Estimated total</span>
              <span className="total" data-testid="plan-total">
                {fmtMoney(total, settings.currency)}
              </span>
            </div>
          )}
        </div>

        <div className="card stack">
          <h3>Practitioner notes</h3>
          <textarea className="input" value={draft.notes} onChange={(e) => setDraft({ notes: e.target.value })} placeholder="Observations, contraindications, follow-up…" />
        </div>

        <p className="disclaimer">{settings.disclaimer}</p>
        <button className="btn secondary block" onClick={share} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share / download summary'}
        </button>
      </div>
      <div className="bottom-bar">
        <button className="btn secondary" onClick={() => navigate('simulate')}>
          Back to simulator
        </button>
        <button className="btn primary" onClick={save} disabled={saving} data-testid="save-consult">
          {client ? 'Save consultation' : 'Add client & save'}
        </button>
      </div>
    </div>
  );
}
