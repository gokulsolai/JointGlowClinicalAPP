import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { TopBar, Spinner } from '../components/ui';
import { db } from '../lib/db';
import type { Consultation } from '../lib/types';
import { ageFromDob, fmtDate, fullName, initials } from '../lib/format';
import { blobToCanvas } from '../lib/image';
import { runAnalysis } from '../lib/pipeline';

/** Loads a saved consultation into the draft and opens the analysis screen. */
export function useLoadConsultation(): (c: Consultation) => Promise<void> {
  const { setDraft, navigate, toast, clients } = useApp();
  return useCallback(
    async (c: Consultation) => {
      try {
        const photo = await blobToCanvas(c.photo);
        const { output, scale } = runAnalysis(photo, c.capture.landmarks, c.capture.mirrored);
        const simulationImage = c.simulationImage ? await blobToCanvas(c.simulationImage) : null;
        setDraft({
          client: clients.find((k) => k.id === c.clientId) ?? null,
          photo,
          capture: c.capture,
          analysis: output,
          analysisScale: scale,
          simulation: c.simulation,
          plan: c.plan,
          consultationId: c.id,
          simulationImage,
          notes: c.notes ?? '',
        });
        navigate('analysis');
      } catch (e) {
        console.error(e);
        toast('Could not open this consultation');
      }
    },
    [setDraft, navigate, toast, clients],
  );
}

export default function ClientScreen(): React.JSX.Element {
  const { clients, selectedClientId, navigate, back, setEditingClientId, setIntakeReturnTo, resetDraft, setDraft, refreshClients, toast } = useApp();
  const client = clients.find((c) => c.id === selectedClientId) ?? null;
  const [history, setHistory] = useState<Consultation[] | null>(null);
  const loadConsultation = useLoadConsultation();

  useEffect(() => {
    if (!client) return;
    db.listConsultations(client.id)
      .then((list) => {
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setHistory(list);
      })
      .catch(console.error);
  }, [client]);

  const thumbUrls = useMemo(() => (history ?? []).map((c) => URL.createObjectURL(c.thumbnail)), [history]);
  useEffect(() => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)), [thumbUrls]);

  if (!client) {
    return (
      <div className="screen">
        <TopBar title="Client" onBack={back} />
        <div className="content">
          <div className="empty">Client not found.</div>
        </div>
      </div>
    );
  }

  const age = ageFromDob(client.dob);
  const consentOk = client.consent.photo && client.consent.analysis;

  const start = () => {
    if (!consentOk) {
      toast('Photo and analysis consent are required first');
      return;
    }
    resetDraft();
    setDraft({ client });
    navigate('capture');
  };

  return (
    <div className="screen">
      <TopBar
        title={fullName(client)}
        onBack={back}
        right={
          <button
            className="icon-btn"
            aria-label="Edit client"
            onClick={() => {
              setEditingClientId(client.id);
              setIntakeReturnTo('client');
              navigate('intake');
            }}
          >
            ✎
          </button>
        }
      />
      <div className="content">
        <div className="card row">
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {initials(client)}
          </span>
          <div style={{ flex: 1 }} className="stack">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {age !== null && <span className="pill">{age} yrs</span>}
              {client.skinType && <span className="pill">Fitzpatrick {client.skinType}</span>}
              <span className={`pill ${consentOk ? 'ok' : 'warn'}`}>{consentOk ? 'Consent signed' : 'Consent needed'}</span>
            </div>
            <div className="muted small">{[client.phone, client.email].filter(Boolean).join(' · ') || 'No contact details'}</div>
          </div>
        </div>

        {client.concerns.length > 0 && (
          <div className="card stack">
            <h3>Client concerns</h3>
            <div className="chips">
              {client.concerns.map((c) => (
                <span key={c} className="chip on">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {(client.allergies || client.medications || client.previousTreatments || client.notes) && (
          <div className="card stack">
            <h3>Medical notes</h3>
            {client.allergies && (
              <p className="small">
                <b>Allergies:</b> {client.allergies}
              </p>
            )}
            {client.medications && (
              <p className="small">
                <b>Medications:</b> {client.medications}
              </p>
            )}
            {client.previousTreatments && (
              <p className="small">
                <b>Previous treatments:</b> {client.previousTreatments}
              </p>
            )}
            {client.notes && (
              <p className="small">
                <b>Notes:</b> {client.notes}
              </p>
            )}
          </div>
        )}

        <div className="section-title">Consultations</div>
        <div className="card flush list">
          {history === null && (
            <div className="empty">
              <Spinner dark />
            </div>
          )}
          {history && history.length === 0 && <div className="empty">No consultations yet.</div>}
          {history?.map((c, i) => (
            <button key={c.id} className="list-item" onClick={() => loadConsultation(c)}>
              <img className="thumb" src={thumbUrls[i]} alt="" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{fmtDate(c.createdAt, true)}</div>
                <div className="muted small">
                  Skin score {c.analysis.overallSkin} · {c.plan.length} treatment{c.plan.length === 1 ? '' : 's'} in plan
                </div>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>

        <button
          className="btn danger block"
          onClick={async () => {
            if (!window.confirm(`Delete ${fullName(client)} and all their consultations?`)) return;
            await db.deleteClient(client.id);
            await refreshClients();
            toast('Client deleted');
            navigate('home', { replace: true });
          }}
        >
          Delete client
        </button>
      </div>
      <div className="bottom-bar">
        <button className="btn primary" onClick={start} data-testid="start-consult">
          Start consultation
        </button>
      </div>
    </div>
  );
}
