import React, { useEffect, useRef } from 'react';

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }): React.JSX.Element {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" aria-label="Back" onClick={onBack}>
          ‹
        </button>
      ) : (
        <span className="spacer" />
      )}
      <h1>{title}</h1>
      {right ?? <span className="spacer" />}
    </header>
  );
}

export function ScoreRing({ value, label, size = 96, color }: { value: number; label?: string; size?: number; color?: string }): React.JSX.Element {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const stroke = color ?? (pct >= 70 ? '#2a9d8f' : pct >= 45 ? '#e9a23b' : '#d7263d');
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <div className="val">
        {Math.round(pct)}
        {label && <small>{label}</small>}
      </div>
    </div>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, ariaLabel }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; ariaLabel?: string }): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Switch({ on, onChange, ariaLabel }: { on: boolean; onChange: (v: boolean) => void; ariaLabel?: string }): React.JSX.Element {
  return <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/** Minimal signature pad; emits a PNG data URL on each stroke end. */
export function SignaturePad({ value, onChange }: { value?: string; onChange: (dataUrl: string | undefined) => void }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(c).color;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="stack">
      <canvas
        ref={ref}
        className="sig-pad"
        onPointerDown={(e) => {
          drawing.current = true;
          last.current = pos(e);
          ref.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = pos(e);
          const ctx = ref.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          onChange(ref.current!.toDataURL('image/png'));
        }}
      />
      <div className="row between">
        <span className="muted small">Sign above with your finger</span>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            onChange(undefined);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function Spinner({ dark }: { dark?: boolean }): React.JSX.Element {
  return <div className={`spinner${dark ? ' dark' : ''}`} aria-hidden />;
}
