import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { TopBar, Slider, Switch, Chip } from '../components/ui';
import { FaceRenderer } from '../lib/gl/renderer';
import { buildMaskCanvases } from '../lib/masks';
import { TREATMENTS, TREATMENT_BY_ID, computeEffects, defaultSetting } from '../lib/treatments';
import { treatmentWarps } from '../lib/warps';
import { recommend } from '../lib/recommend';
import type { PlanItem, SimulationState, TreatmentDef, TreatmentId } from '../lib/types';
import { fmtMoney } from '../lib/format';

const CATEGORIES: Array<TreatmentDef['category']> = ['Injectables', 'Skin treatments', 'Energy-based'];

export default function SimulatorScreen(): React.JSX.Element {
  const { draft, setDraft, navigate, back, settings, toast } = useApp();
  const { photo, analysis, capture } = draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FaceRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [split, setSplit] = useState(50);
  const [holdBefore, setHoldBefore] = useState(false);
  const [category, setCategory] = useState<TreatmentDef['category'] | 'Suggested'>('Suggested');
  const dragging = useRef(false);
  const simulation = draft.simulation;

  const photoUrl = useMemo(() => photo?.toDataURL('image/jpeg', 0.9) ?? '', [photo]);
  const recs = useMemo(() => (analysis ? recommend(analysis.result, settings.disabledTreatments) : []), [analysis, settings.disabledTreatments]);
  const enabledDefs = useMemo(() => TREATMENTS.filter((t) => !settings.disabledTreatments.includes(t.id)), [settings.disabledTreatments]);

  // build the WebGL scene once per photo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo || !analysis || !capture) return;
    let renderer: FaceRenderer;
    try {
      renderer = new FaceRenderer(canvas);
      const masks = buildMaskCanvases(capture.landmarks, photo.width, photo.height, 0.25);
      renderer.setScene({
        image: photo,
        landmarks: capture.landmarks,
        masks,
        faceWidth: analysis.result.faceWidth / draft.analysisScale,
        skinMean: analysis.result.skinMean,
        cheekMean: analysis.result.cheekMean,
        globalRedness: analysis.result.globalRedness,
      });
      rendererRef.current = renderer;
      setReady(true);
      setGlError(null);
    } catch (e) {
      console.error(e);
      setGlError(e instanceof Error ? e.message : String(e));
      return;
    }
    return () => {
      renderer.dispose();
      rendererRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, analysis, capture]);

  // re-render whenever the simulation state changes
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !ready || !capture) return;
    r.setWarps(treatmentWarps(capture.landmarks, simulation));
    r.render(computeEffects(simulation));
  }, [simulation, ready, capture]);

  const update = useCallback(
    (id: TreatmentId, patch: Partial<SimulationState[TreatmentId]> | null) => {
      setDraft((d) => {
        const next: SimulationState = { ...d.simulation };
        if (patch === null) delete next[id];
        else next[id] = { ...(next[id] ?? defaultSetting(TREATMENT_BY_ID[id])), ...patch } as NonNullable<SimulationState[TreatmentId]>;
        return { ...d, simulation: next };
      });
    },
    [setDraft],
  );

  const applySuggestions = () => {
    setDraft((d) => {
      const next: SimulationState = { ...d.simulation };
      for (const rec of recs) next[rec.treatmentId] = { enabled: true, intensity: rec.intensity, zones: rec.zones ?? defaultSetting(TREATMENT_BY_ID[rec.treatmentId]).zones };
      return { ...d, simulation: next };
    });
    toast(`${recs.length} suggested treatment${recs.length === 1 ? '' : 's'} applied`);
  };

  const onPointer = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = frameRef.current!.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  };

  const continueToPlan = () => {
    const r = rendererRef.current;
    const simulationImage = r ? r.snapshot() : null;
    const plan: PlanItem[] = (Object.entries(simulation) as Array<[TreatmentId, SimulationState[TreatmentId]]>)
      .filter(([, s]) => s && s.enabled && s.intensity > 0)
      .map(([id, s]) => ({ treatmentId: id, intensity: s!.intensity, zones: s!.zones, price: settings.prices[id] ?? TREATMENT_BY_ID[id].defaultPrice }));
    setDraft({ simulationImage, plan });
    navigate('plan');
  };

  if (!photo || !analysis || !capture) {
    return (
      <div className="screen">
        <TopBar title="Simulator" onBack={back} />
        <div className="content">
          <div className="empty">Capture a photo first.</div>
        </div>
      </div>
    );
  }

  const activeCount = Object.values(simulation).filter((s) => s?.enabled && s.intensity > 0).length;
  const visible = category === 'Suggested' ? enabledDefs.filter((t) => recs.some((r) => r.treatmentId === t.id)) : enabledDefs.filter((t) => t.category === category);
  const effectiveSplit = holdBefore ? 100 : split;

  return (
    <div className="screen">
      <TopBar title="Treatment simulator" onBack={back} />
      <div className="content">
        <div
          ref={frameRef}
          className="sim-frame"
          style={{ ['--split' as string]: `${effectiveSplit}%` }}
          data-testid="sim-frame"
          onPointerDown={(e) => {
            dragging.current = true;
            frameRef.current!.setPointerCapture(e.pointerId);
            onPointer(e);
          }}
          onPointerMove={onPointer}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <canvas ref={canvasRef} data-testid="sim-canvas" />
          <img className="before" src={photoUrl} alt="Before" />
          <div className="divider" />
          <div className="handle">⇔</div>
          <span className="tag l">Before</span>
          <span className="tag r">After</span>
          {glError && (
            <div className="busy" style={{ padding: 20, textAlign: 'center' }}>
              Simulation unavailable: {glError}
            </div>
          )}
        </div>
        <div className="row between">
          <button
            className="btn secondary sm"
            onPointerDown={() => setHoldBefore(true)}
            onPointerUp={() => setHoldBefore(false)}
            onPointerLeave={() => setHoldBefore(false)}
          >
            Hold to compare
          </button>
          <span className="muted small">{activeCount ? `${activeCount} treatment${activeCount === 1 ? '' : 's'} active` : 'Drag the slider · toggle treatments below'}</span>
          <button className="btn ghost sm" onClick={() => setDraft({ simulation: {} })}>
            Reset
          </button>
        </div>

        {recs.length > 0 && (
          <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
            <div className="row between">
              <h3>Suggested for this client</h3>
              <button className="btn primary sm" onClick={applySuggestions} data-testid="apply-suggestions">
                Apply all
              </button>
            </div>
            <div className="chips">
              {recs.map((rec) => (
                <Chip key={rec.treatmentId} on={!!simulation[rec.treatmentId]?.enabled} onClick={() => update(rec.treatmentId, simulation[rec.treatmentId]?.enabled ? null : { enabled: true, intensity: rec.intensity, zones: rec.zones })}>
                  {TREATMENT_BY_ID[rec.treatmentId].name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="chips scroll">
          <Chip on={category === 'Suggested'} onClick={() => setCategory('Suggested')}>
            Suggested
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>

        <div className="stack">
          {visible.length === 0 && <div className="empty">No treatments in this group.</div>}
          {visible.map((def) => {
            const s = simulation[def.id];
            const on = !!s?.enabled;
            const rec = recs.find((r) => r.treatmentId === def.id);
            return (
              <div key={def.id} className={`treat-card stack${on ? ' on' : ''}`} data-testid={`treat-${def.id}`}>
                <div className="row between">
                  <div style={{ flex: 1 }}>
                    <div className="name">{def.name}</div>
                    <div className="sub">
                      {def.short} · {fmtMoney(settings.prices[def.id] ?? def.defaultPrice, settings.currency)} {def.priceUnit}
                    </div>
                  </div>
                  <Switch on={on} ariaLabel={def.name} onChange={(v) => update(def.id, v ? { enabled: true, intensity: s?.intensity ?? rec?.intensity ?? 0.6, zones: s?.zones ?? rec?.zones ?? defaultSetting(def).zones } : { enabled: false })} />
                </div>
                {on && s && (
                  <>
                    <div className="row">
                      <span className="small muted" style={{ width: 64 }}>
                        {def.intensityLabel}
                      </span>
                      <Slider value={Math.round(s.intensity * 100)} onChange={(v) => update(def.id, { intensity: v / 100 })} ariaLabel={`${def.name} intensity`} />
                      <span className="small" style={{ width: 36, textAlign: 'right' }}>
                        {Math.round(s.intensity * 100)}%
                      </span>
                    </div>
                    {def.zones && (
                      <div className="chips">
                        {def.zones.map((z) => (
                          <Chip key={z.id} on={s.zones?.[z.id] !== false} onClick={() => update(def.id, { zones: { ...(s.zones ?? {}), [z.id]: !(s.zones?.[z.id] !== false) } })}>
                            {z.label}
                          </Chip>
                        ))}
                      </div>
                    )}
                    <div className="sub">
                      {def.description} {def.onset}; {def.duration.toLowerCase()}.
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="disclaimer">Simulations are approximate visualisations and do not predict individual results.</p>
      </div>
      <div className="bottom-bar">
        <button className="btn primary" onClick={continueToPlan} data-testid="to-plan">
          Continue to plan{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
    </div>
  );
}
