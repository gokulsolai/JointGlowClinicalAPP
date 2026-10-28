import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { TopBar, ScoreRing } from '../components/ui';
import { CONCERNS, CONCERN_BY_ID, buildHeatmap } from '../lib/analysis';
import type { ConcernGroup, ConcernId } from '../lib/types';
import { fullName, scoreWord } from '../lib/format';

const GROUPS: Array<{ id: ConcernGroup; label: string }> = [
  { id: 'lines', label: 'Lines & wrinkles' },
  { id: 'skin', label: 'Skin quality' },
  { id: 'volume', label: 'Volume & folds' },
  { id: 'structure', label: 'Structure' },
];

export default function AnalysisScreen(): React.JSX.Element {
  const { draft, navigate, back, resetDraft } = useApp();
  const { photo, analysis, capture } = draft;
  const [selected, setSelected] = useState<ConcernId | 'all' | 'none'>('all');
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const photoUrl = useMemo(() => photo?.toDataURL('image/jpeg', 0.9) ?? '', [photo]);

  useEffect(() => {
    const c = overlayRef.current;
    if (!c || !analysis) return;
    const { fields, result } = analysis;
    c.width = fields.w;
    c.height = fields.h;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (selected === 'none') return;
    const ids: ConcernId[] = selected === 'all' ? result.concerns.filter((k) => k.score >= 25).map((k) => k.id) : [selected];
    const tmp = document.createElement('canvas');
    tmp.width = fields.w;
    tmp.height = fields.h;
    const tctx = tmp.getContext('2d')!;
    for (const id of ids) {
      const score = result.concerns.find((k) => k.id === id)?.score ?? 0;
      const hm = buildHeatmap(fields, id, score);
      tctx.putImageData(hm, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }
  }, [analysis, selected]);

  if (!photo || !analysis || !capture) {
    return (
      <div className="screen">
        <TopBar title="Analysis" onBack={back} />
        <div className="content">
          <div className="empty">No capture yet.</div>
          <button className="btn primary" onClick={() => navigate('capture')}>
            Open camera
          </button>
        </div>
      </div>
    );
  }

  const r = analysis.result;
  const selectedDef = selected !== 'all' && selected !== 'none' ? CONCERN_BY_ID[selected] : null;
  const selectedScore = selectedDef ? r.concerns.find((c) => c.id === selectedDef.id) : null;
  const pose = capture.pose;

  return (
    <div className="screen">
      <TopBar
        title="Analysis"
        onBack={back}
        right={
          <button
            className="icon-btn"
            aria-label="Retake"
            onClick={() => {
              resetDraft(true);
              navigate('capture', { replace: true });
            }}
          >
            ↻
          </button>
        }
      />
      <div className="content">
        <div className="photo-frame" data-testid="analysis-photo">
          <img src={photoUrl} alt="Client" />
          <canvas ref={overlayRef} />
          <div className="legend">{selected === 'all' ? 'All concerns ≥ 25' : selected === 'none' ? 'Photo only' : selectedDef?.label}</div>
        </div>
        <div className="chips scroll">
          <button className={`chip${selected === 'all' ? ' on' : ''}`} onClick={() => setSelected('all')}>
            All
          </button>
          <button className={`chip${selected === 'none' ? ' on' : ''}`} onClick={() => setSelected('none')}>
            None
          </button>
          {[...r.concerns]
            .sort((a, b) => b.score - a.score)
            .slice(0, 6)
            .map((c) => (
              <button key={c.id} className={`chip${selected === c.id ? ' on' : ''}`} onClick={() => setSelected(c.id)}>
                {CONCERN_BY_ID[c.id].label}
              </button>
            ))}
        </div>

        <div className="card row">
          <ScoreRing value={r.overallSkin} label="SKIN SCORE" />
          <div className="stack" style={{ flex: 1 }}>
            <div style={{ fontWeight: 650 }}>{fullName(draft.client)}</div>
            <div className="muted small">
              Skin tone: {r.skinTone.category} (ITA {r.skinTone.ita}°)
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="pill">{capture.source === 'camera' ? 'Front camera' : 'Uploaded photo'}</span>
              {pose && <span className={`pill ${Math.abs(pose.yaw) < 10 && Math.abs(pose.pitch) < 10 ? 'ok' : 'warn'}`}>Pose {Math.round(pose.yaw)}° / {Math.round(pose.pitch)}°</span>}
            </div>
          </div>
        </div>

        {selectedScore && selectedDef && (
          <div className="card stack" data-testid="concern-detail">
            <div className="row between">
              <h3>{selectedDef.label}</h3>
              <span className="pill" style={{ background: selectedDef.color, color: '#fff' }}>
                {scoreWord(selectedScore.score)} · {selectedScore.score}
              </span>
            </div>
            <p className="small">{selectedDef.description}</p>
            <p className="small muted">{selectedScore.note}</p>
            {selectedScore.sides && (
              <div className="row small muted">
                <span>Client's left: {selectedScore.sides.left}</span>
                <span>·</span>
                <span>Client's right: {selectedScore.sides.right}</span>
              </div>
            )}
            <span className="pill">Confidence: {selectedScore.confidence}</span>
          </div>
        )}

        {GROUPS.map((g) => (
          <div key={g.id} className="card">
            <div className="section-title" style={{ marginBottom: 6 }}>
              {g.label}
            </div>
            {CONCERNS.filter((c) => c.group === g.id).map((def) => {
              const cs = r.concerns.find((k) => k.id === def.id);
              if (!cs) return null;
              return (
                <button key={def.id} className={`score-row${selected === def.id ? ' active' : ''}`} onClick={() => setSelected(def.id)} data-testid={`score-${def.id}`}>
                  <span className="dot" style={{ background: def.color }} />
                  <span className="score-label">{def.label}</span>
                  <span className="score-bar">
                    <div style={{ width: `${cs.score}%`, background: def.color }} />
                  </span>
                  <span className="score-num">{cs.score}</span>
                </button>
              );
            })}
          </div>
        ))}
        <p className="disclaimer">Scores are indicative visual estimates from a single photograph and depend on lighting, make-up and expression. They are not a medical diagnosis.</p>
      </div>
      <div className="bottom-bar">
        <button
          className="btn secondary"
          onClick={() => {
            resetDraft(true);
            navigate('capture', { replace: true });
          }}
        >
          Retake
        </button>
        <button className="btn primary" onClick={() => navigate('simulate')} data-testid="to-simulate">
          Simulate treatments
        </button>
      </div>
    </div>
  );
}
