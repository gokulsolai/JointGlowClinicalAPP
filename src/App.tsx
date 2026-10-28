import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Client, ClinicSettings, FaceCapture, PlanItem, SimulationState } from './lib/types';
import type { AnalysisOutput } from './lib/analysis';
import { DEFAULT_SETTINGS, db } from './lib/db';
import { loadFaceLandmarker } from './lib/faceMesh';
import HomeScreen from './screens/HomeScreen';
import ClientScreen from './screens/ClientScreen';
import IntakeScreen from './screens/IntakeScreen';
import CaptureScreen from './screens/CaptureScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import SimulatorScreen from './screens/SimulatorScreen';
import PlanScreen from './screens/PlanScreen';
import SettingsScreen from './screens/SettingsScreen';

export type Screen = 'home' | 'client' | 'intake' | 'capture' | 'analysis' | 'simulate' | 'plan' | 'settings';

export interface Draft {
  client: Client | null;
  photo: HTMLCanvasElement | null;
  capture: FaceCapture | null;
  analysis: AnalysisOutput | null;
  analysisScale: number;
  simulation: SimulationState;
  plan: PlanItem[];
  consultationId: string | null;
  simulationImage: HTMLCanvasElement | null;
  notes: string;
}

export const EMPTY_DRAFT: Draft = {
  client: null,
  photo: null,
  capture: null,
  analysis: null,
  analysisScale: 1,
  simulation: {},
  plan: [],
  consultationId: null,
  simulationImage: null,
  notes: '',
};

interface AppContextValue {
  screen: Screen;
  navigate: (s: Screen, opts?: { replace?: boolean }) => void;
  back: () => void;
  clients: Client[];
  refreshClients: () => Promise<void>;
  settings: ClinicSettings;
  saveSettings: (s: ClinicSettings) => Promise<void>;
  draft: Draft;
  setDraft: (patch: Partial<Draft> | ((d: Draft) => Draft)) => void;
  resetDraft: (keepClient?: boolean) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  editingClientId: string | null;
  setEditingClientId: (id: string | null) => void;
  intakeReturnTo: Screen | null;
  setIntakeReturnTo: (s: Screen | null) => void;
  toast: (msg: string) => void;
  modelReady: boolean;
  modelError: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('home');
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);
  const [draft, setDraftState] = useState<Draft>(EMPTY_DRAFT);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [intakeReturnTo, setIntakeReturnTo] = useState<Screen | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const refreshClients = useCallback(async () => {
    const list = await db.listClients();
    list.sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
    setClients(list);
  }, []);

  useEffect(() => {
    refreshClients().catch(console.error);
    db.getSettings()
      .then((s) => s && setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(console.error);
    loadFaceLandmarker()
      .then(() => setModelReady(true))
      .catch((e: unknown) => setModelError(e instanceof Error ? e.message : String(e)));
  }, [refreshClients]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state && (e.state as { screen?: Screen }).screen) || 'home';
      setScreen(s);
    };
    window.addEventListener('popstate', onPop);
    window.history.replaceState({ screen: 'home' }, '');
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((s: Screen, opts?: { replace?: boolean }) => {
    if (opts?.replace) window.history.replaceState({ screen: s }, '');
    else window.history.pushState({ screen: s }, '');
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate('home', { replace: true });
  }, [navigate]);

  const saveSettings = useCallback(async (s: ClinicSettings) => {
    setSettings(s);
    await db.putSettings(s);
  }, []);

  const setDraft = useCallback((patch: Partial<Draft> | ((d: Draft) => Draft)) => {
    setDraftState((d) => (typeof patch === 'function' ? patch(d) : { ...d, ...patch }));
  }, []);

  const resetDraft = useCallback((keepClient = false) => {
    setDraftState((d) => ({ ...EMPTY_DRAFT, client: keepClient ? d.client : null }));
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      navigate,
      back,
      clients,
      refreshClients,
      settings,
      saveSettings,
      draft,
      setDraft,
      resetDraft,
      selectedClientId,
      setSelectedClientId,
      editingClientId,
      setEditingClientId,
      intakeReturnTo,
      setIntakeReturnTo,
      toast,
      modelReady,
      modelError,
    }),
    [screen, navigate, back, clients, refreshClients, settings, saveSettings, draft, setDraft, resetDraft, selectedClientId, editingClientId, intakeReturnTo, toast, modelReady, modelError],
  );

  let body: React.JSX.Element;
  switch (screen) {
    case 'client':
      body = <ClientScreen />;
      break;
    case 'intake':
      body = <IntakeScreen />;
      break;
    case 'capture':
      body = <CaptureScreen />;
      break;
    case 'analysis':
      body = <AnalysisScreen />;
      break;
    case 'simulate':
      body = <SimulatorScreen />;
      break;
    case 'plan':
      body = <PlanScreen />;
      break;
    case 'settings':
      body = <SettingsScreen />;
      break;
    default:
      body = <HomeScreen />;
  }

  return (
    <AppContext.Provider value={value}>
      <div className="app" data-screen={screen}>
        {body}
        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
