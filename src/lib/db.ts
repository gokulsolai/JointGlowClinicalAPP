import type { Client, ClinicSettings, Consultation } from './types';

const DB_NAME = 'jointglow-clinical';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('consultations')) {
        const s = db.createObjectStore('consultations', { keyPath: 'id' });
        s.createIndex('clientId', 'clientId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const db = {
  listClients: (): Promise<Client[]> => tx('clients', 'readonly', (s) => s.getAll() as IDBRequest<Client[]>),
  getClient: (id: string): Promise<Client | undefined> => tx('clients', 'readonly', (s) => s.get(id) as IDBRequest<Client | undefined>),
  putClient: (c: Client): Promise<IDBValidKey> => tx('clients', 'readwrite', (s) => s.put(c)),
  deleteClient: async (id: string): Promise<void> => {
    await tx('clients', 'readwrite', (s) => s.delete(id));
    const cons = await db.listConsultations(id);
    for (const c of cons) await tx('consultations', 'readwrite', (s) => s.delete(c.id));
  },
  listConsultations: (clientId: string): Promise<Consultation[]> =>
    tx('consultations', 'readonly', (s) => s.index('clientId').getAll(clientId) as IDBRequest<Consultation[]>),
  listAllConsultations: (): Promise<Consultation[]> =>
    tx('consultations', 'readonly', (s) => s.getAll() as IDBRequest<Consultation[]>),
  getConsultation: (id: string): Promise<Consultation | undefined> =>
    tx('consultations', 'readonly', (s) => s.get(id) as IDBRequest<Consultation | undefined>),
  putConsultation: (c: Consultation): Promise<IDBValidKey> => tx('consultations', 'readwrite', (s) => s.put(c)),
  deleteConsultation: (id: string): Promise<undefined> => tx('consultations', 'readwrite', (s) => s.delete(id)),
  getSettings: (): Promise<ClinicSettings | undefined> =>
    tx('settings', 'readonly', (s) => s.get('clinic') as IDBRequest<ClinicSettings | undefined>),
  putSettings: (v: ClinicSettings): Promise<IDBValidKey> => tx('settings', 'readwrite', (s) => s.put(v, 'clinic')),
};

export const DEFAULT_DISCLAIMER =
  'This analysis and simulation are visual consultation aids generated from a photograph. They are indicative only, are not a medical diagnosis, and do not guarantee treatment outcomes. Suitability, dosing and expected results must be assessed by a qualified practitioner.';

export const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: 'JointGlow Aesthetics',
  practitioner: '',
  currency: 'USD',
  prices: {},
  disabledTreatments: [],
  disclaimer: DEFAULT_DISCLAIMER,
  autoCapture: true,
};
