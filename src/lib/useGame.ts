import { useCallback, useEffect, useMemo, useState } from "react";
import { getGame, saveGame } from "./storage/games";
import { reduceEvents } from "./scoring/engine";
import type { GameEvent, GameStatus, StoredGame } from "./scoring/types";

/**
 * Live game session: owns the event log, derives state through the rules
 * engine, and autosaves after every committed event.
 */
export function useGame(id: string) {
  const [game, setGame] = useState<StoredGame | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [redo, setRedo] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getGame(id).then((found) => {
      if (!active) return;
      setGame(found ?? null);
      setEvents(found?.events ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const state = useMemo(
    () => (game ? reduceEvents(game.setup, events) : null),
    [game, events],
  );

  const persist = useCallback(
    (next: GameEvent[], status?: GameStatus) => {
      setEvents(next);
      setGame((current) => {
        if (!current) return current;
        const updated = {
          ...current,
          events: next,
          status: status ?? current.status,
          updatedAt: new Date().toISOString(),
        };
        void saveGame(updated);
        return updated;
      });
    },
    [],
  );

  const commit = useCallback(
    (event: GameEvent) => {
      setRedo([]);
      persist([...events, event]);
    },
    [events, persist],
  );

  const undo = useCallback(() => {
    if (!events.length) return;
    const last = events[events.length - 1];
    setRedo((r) => [last, ...r]);
    persist(events.slice(0, -1));
  }, [events, persist]);

  const redoLast = useCallback(() => {
    if (!redo.length) return;
    const [next, ...rest] = redo;
    setRedo(rest);
    persist([...events, next]);
  }, [events, redo, persist]);

  /** Replace a past event; every later event is replayed automatically. */
  const replaceEvent = useCallback(
    (eventId: string, updater: (event: GameEvent) => GameEvent) => {
      persist(events.map((e) => (e.id === eventId ? updater(e) : e)));
    },
    [events, persist],
  );

  const deleteEvent = useCallback(
    (eventId: string) => persist(events.filter((e) => e.id !== eventId)),
    [events, persist],
  );

  const setStatus = useCallback(
    (status: GameStatus) => persist(events, status),
    [events, persist],
  );

  return {
    loading,
    game,
    state,
    events,
    canUndo: events.length > 0,
    canRedo: redo.length > 0,
    commit,
    undo,
    redo: redoLast,
    replaceEvent,
    deleteEvent,
    setStatus,
  };
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}