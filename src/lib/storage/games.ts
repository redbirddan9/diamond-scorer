/**
 * Offline-first persistence.
 *
 * IndexedDB is the local store (the browser equivalent of the SQLite file on
 * the cyberdeck). Everything is written locally; no network is ever required.
 */
import type { GameEvent, GameSetup, GameStatus, StoredGame } from "../scoring/types";

const DB_NAME = "scorebook";
const DB_VERSION = 1;
const STORE = "games";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function listGames(): Promise<StoredGame[]> {
  const all = await tx<StoredGame[]>("readonly", (s) => s.getAll() as IDBRequest<StoredGame[]>);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getGame(id: string): Promise<StoredGame | undefined> {
  return tx<StoredGame | undefined>(
    "readonly",
    (s) => s.get(id) as IDBRequest<StoredGame | undefined>,
  );
}

export async function saveGame(game: StoredGame): Promise<void> {
  await tx("readwrite", (s) => s.put({ ...game, updatedAt: new Date().toISOString() }));
}

export async function deleteGame(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function createGame(setup: GameSetup): Promise<StoredGame> {
  const game: StoredGame = {
    id: setup.id,
    setup,
    events: [],
    status: "in-progress",
    updatedAt: new Date().toISOString(),
  };
  await saveGame(game);
  return game;
}

export async function updateEvents(
  id: string,
  events: GameEvent[],
  status?: GameStatus,
): Promise<void> {
  const game = await getGame(id);
  if (!game) return;
  await saveGame({ ...game, events, status: status ?? game.status });
}

/* Roster templates ------------------------------------------------- */

const TEMPLATE_KEY = "scorebook.rosters";

export interface RosterTemplate {
  name: string;
  players: GameSetup["home"]["players"];
}

export function loadTemplates(): RosterTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "[]") as RosterTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplate(template: RosterTemplate) {
  const all = loadTemplates().filter((t) => t.name !== template.name);
  all.push(template);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(all));
}