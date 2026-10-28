import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { TopBar } from '../components/ui';
import { db } from '../lib/db';
import type { Consultation } from '../lib/types';
import { fmtDate, fullName, initials } from '../lib/format';
import { useLoadConsultation } from './ClientScreen';

export default function HomeScreen(): React.JSX.Element {
  const { clients, navigate, settings, setSelectedClientId, setEditingClientId, setIntakeReturnTo, resetDraft, setDraft, modelReady, modelError } = useApp();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<Consultation[]>([]);
  const loadConsultation = useLoadConsultation();

  useEffect(() => {
    db.listAllConsultations()
      .then((all) => {
        all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRecent(all.slice(0, 5));
      })
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => `${c.firstName} ${c.lastName} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q));
  }, [clients, query]);

  const thumbUrls = useMemo(() => recent.map((c) => URL.createObjectURL(c.thumbnail)), [recent]);
  useEffect(() => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)), [thumbUrls]);

  const startNewClient = () => {
    setEditingClientId(null);
    setIntakeReturnTo('capture');
    navigate('intake');
  };

  const quickScan = () => {
    resetDraft();
    setDraft({ client: null });
    navigate('capture');
  };

  return (
    <div className="screen">
      <TopBar
        title={settings.clinicName || 'JointGlow'}
        right={
          <button className="icon-btn" aria-label="Settings" onClick={() => navigate('settings')}>
            ⚙︎
          </button>
        }
      />
      <div className="content">
        <div className="hero stack">
          <h1>Facial analysis & treatment simulator</h1>
          <p style={{ opacity: 0.9 }}>Capture with the front camera, identify concerns, and show clients what each treatment could do.</p>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn primary" onClick={startNewClient} data-testid="new-consult">
              + New consultation
            </button>
            <button className="btn ghost" style={{ color: '#fff' }} onClick={quickScan} data-testid="quick-scan">
              Quick scan
            </button>
          </div>
          <div className="small" style={{ opacity: 0.85 }}>
            {modelError ? `Face model failed to load: ${modelError}` : modelReady ? 'Face analysis model ready' : 'Loading face analysis model…'}
          </div>
        </div>

        {recent.length > 0 && (
          <>
            <div className="section-title">Recent consultations</div>
            <div className="card flush list">
              {recent.map((c, i) => {
                const client = clients.find((k) => k.id === c.clientId);
                return (
                  <button key={c.id} className="list-item" onClick={() => loadConsultation(c)}>
                    <img className="thumb" src={thumbUrls[i]} alt="" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{fullName(client)}</div>
                      <div className="muted small">
                        {fmtDate(c.createdAt, true)} · skin score {c.analysis.overallSkin} · {c.plan.length} treatment{c.plan.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="muted">›</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="section-title">Clients</div>
        <input className="input" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clients" />
        <div className="card flush list">
          {filtered.length === 0 && <div className="empty">{clients.length ? 'No clients match your search.' : 'No clients yet. Start a new consultation to add one.'}</div>}
          {filtered.map((c) => (
            <button
              key={c.id}
              className="list-item"
              onClick={() => {
                setSelectedClientId(c.id);
                navigate('client');
              }}
            >
              <span className="avatar">{initials(c)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{fullName(c)}</div>
                <div className="muted small">{c.concerns.length ? c.concerns.join(' · ') : c.email || c.phone || 'No details'}</div>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
