import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../App';
import { Spinner } from '../components/ui';
import { detectVideo, getTesselationEdges, loadFaceLandmarker, parseResult } from '../lib/faceMesh';
import { assessFrame, measureLight, type LightStats } from '../lib/pose';
import { drawToCanvas } from '../lib/image';
import { fileToCanvas, processPhoto } from '../lib/pipeline';
import type { Point } from '../lib/types';

type Facing = 'user' | 'environment';

const STABLE_MS = 700;
const COUNTDOWN_MS = 3000;

export default function CaptureScreen(): React.JSX.Element {
  const { navigate, back, setDraft, settings, toast, draft } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const lastTsRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const countdownStartRef = useRef<number | null>(null);
  const capturedRef = useRef(false);
  const frameCountRef = useRef(0);
  const lightRef = useRef<LightStats | null>(null);
  const edgesRef = useRef<Array<[number, number]> | null>(null);

  const [facing, setFacing] = useState<Facing>('user');
  const [camState, setCamState] = useState<'starting' | 'ready' | 'denied' | 'unavailable'>('starting');
  const [hint, setHint] = useState('Position your face in the oval');
  const [ok, setOk] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(settings.autoCapture);
  const mirror = facing === 'user';

  const stopStream = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    async (source: HTMLCanvasElement, mirrored: boolean, origin: 'camera' | 'upload') => {
      setBusy('Analysing skin and facial features…');
      try {
        const processed = await processPhoto(source, mirrored, origin);
        stopStream();
        setDraft({
          photo: processed.photo,
          capture: processed.capture,
          analysis: processed.analysis,
          analysisScale: processed.analysisScale,
          simulation: {},
          plan: [],
          simulationImage: null,
          consultationId: null,
        });
        navigate('analysis', { replace: true });
      } catch (e) {
        console.error(e);
        toast(e instanceof Error ? e.message : 'Analysis failed');
        setBusy(null);
        capturedRef.current = false;
        countdownStartRef.current = null;
        stableSinceRef.current = null;
        setCountdown(null);
      }
    },
    [navigate, setDraft, stopStream, toast],
  );

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || capturedRef.current) return;
    capturedRef.current = true;
    const frame = drawToCanvas(v, v.videoWidth, v.videoHeight, mirror);
    void finish(frame, mirror, 'camera');
  }, [finish, mirror]);

  const drawOverlay = useCallback(
    (lm: Point[] | null, good: boolean) => {
      const c = overlayRef.current;
      const v = videoRef.current;
      if (!c || !v || !v.videoWidth) return;
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext('2d')!;
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);
      // guide oval
      ctx.save();
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.strokeStyle = good ? 'rgba(42,157,143,0.95)' : 'rgba(255,255,255,0.8)';
      ctx.setLineDash(good ? [] : [W * 0.02, W * 0.012]);
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.45, W * 0.235, W * 0.235 * 1.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (!lm) return;
      if (!edgesRef.current) edgesRef.current = getTesselationEdges();
      ctx.strokeStyle = good ? 'rgba(120,255,220,0.35)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [a, b] of edgesRef.current) {
        ctx.moveTo(lm[a].x, lm[a].y);
        ctx.lineTo(lm[b].x, lm[b].y);
      }
      ctx.stroke();
    },
    [],
  );

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const v = videoRef.current;
    const run = async () => {
      if (v && v.readyState >= 2 && v.videoWidth && !capturedRef.current) {
        const now = performance.now();
        if (now > lastTsRef.current) {
          lastTsRef.current = now;
          try {
            const res = await detectVideo(v, now);
            const parsed = parseResult(res, v.videoWidth, v.videoHeight);
            if (!parsed) {
              drawOverlay(null, false);
              setHint('Position your face in the oval');
              setOk(false);
              stableSinceRef.current = null;
              countdownStartRef.current = null;
              setCountdown(null);
            } else {
              frameCountRef.current++;
              if (frameCountRef.current % 8 === 1) {
                if (!scratchRef.current) scratchRef.current = document.createElement('canvas');
                lightRef.current = measureLight(v, v.videoWidth, v.videoHeight, parsed.landmarks, scratchRef.current);
              }
              const a = assessFrame(parsed.landmarks, v.videoWidth, v.videoHeight, parsed.pose, parsed.blendshapes, lightRef.current, mirror);
              drawOverlay(parsed.landmarks, a.ok);
              setOk(a.ok);
              if (a.ok) {
                if (stableSinceRef.current === null) stableSinceRef.current = now;
                const stableFor = now - stableSinceRef.current;
                if (autoCapture && stableFor > STABLE_MS) {
                  if (countdownStartRef.current === null) countdownStartRef.current = now;
                  const elapsed = now - countdownStartRef.current;
                  const left = Math.ceil((COUNTDOWN_MS - elapsed) / 1000);
                  setCountdown(Math.max(1, left));
                  setHint('Hold still');
                  if (elapsed >= COUNTDOWN_MS) {
                    setCountdown(null);
                    capture();
                  }
                } else {
                  setHint(autoCapture ? 'Perfect, hold still' : 'Ready, tap the shutter');
                }
              } else {
                stableSinceRef.current = null;
                countdownStartRef.current = null;
                setCountdown(null);
                setHint(a.hint);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (runningRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    void run();
  }, [autoCapture, capture, drawOverlay, mirror]);

  useEffect(() => {
    let cancelled = false;
    capturedRef.current = false;
    setCamState('starting');
    (async () => {
      try {
        await loadFaceLandmarker();
      } catch (e) {
        console.error(e);
        toast('Face model failed to load');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamState('unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const v = videoRef.current;
        if (cancelled || !v) {
          // the screen was left while the camera was starting
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        v.srcObject = stream;
        await v.play();
        setCamState('ready');
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCamState((e as Error).name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, loop, stopStream, toast]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy('Loading photo…');
    try {
      const canvas = await fileToCanvas(f);
      await finish(canvas, false, 'upload');
    } catch (err) {
      console.error(err);
      toast('Could not read that image');
      setBusy(null);
    }
  };

  return (
    <div className="capture" data-testid="capture-screen">
      <video ref={videoRef} className={mirror ? 'mirror' : ''} playsInline muted autoPlay />
      <canvas ref={overlayRef} className={`overlay${mirror ? ' mirror' : ''}`} />
      <div className="hud">
        <button
          className="icon-btn"
          aria-label="Back"
          onClick={() => {
            stopStream();
            back();
          }}
        >
          ‹
        </button>
        <div className="row" style={{ gap: 6 }}>
          <span className="pill" style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
            {draft.client ? `${draft.client.firstName} ${draft.client.lastName}`.trim() : 'Quick scan'}
          </span>
          <button className="icon-btn" aria-label="Toggle auto capture" title="Auto capture" onClick={() => setAutoCapture((a) => !a)} style={{ opacity: autoCapture ? 1 : 0.5 }}>
            ⏱
          </button>
        </div>
      </div>
      {camState === 'ready' && (
        <div className={`status${ok ? ' ok' : ''}`} data-testid="capture-hint">
          {hint}
        </div>
      )}
      {camState === 'starting' && <div className="status">Starting camera…</div>}
      {(camState === 'denied' || camState === 'unavailable') && (
        <div className="busy" style={{ background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>📷</div>
          <div>{camState === 'denied' ? 'Camera access was denied.' : 'No camera is available here.'}</div>
          <p className="small" style={{ opacity: 0.8, maxWidth: 320 }}>
            {camState === 'denied' ? 'Allow camera access in Settings › Safari › Camera, then try again. The app must be opened over HTTPS.' : 'You can still upload a photo from your library.'}
          </p>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            Upload a photo
          </button>
          <button className="btn ghost" style={{ color: '#fff' }} onClick={back}>
            Go back
          </button>
        </div>
      )}
      {countdown !== null && <div className="countdown">{countdown}</div>}
      <div className="controls">
        <button className="side-btn" onClick={() => fileRef.current?.click()} data-testid="upload-btn">
          <span className="ico">🖼</span>
          Upload
        </button>
        <button className={`shutter${ok ? ' ready' : ''}`} aria-label="Take photo" onClick={capture} disabled={camState !== 'ready'} data-testid="shutter" />
        <button className="side-btn" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
          <span className="ico">⟲</span>
          Flip
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} data-testid="file-input" />
      {busy && (
        <div className="busy" data-testid="busy">
          <Spinner />
          <div>{busy}</div>
        </div>
      )}
    </div>
  );
}
