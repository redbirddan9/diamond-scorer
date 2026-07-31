/**
 * Earned / Unearned Run Reconstruction.
 *
 * MLB Rule 9.16: determine how many runs would have scored in each half-inning
 * if errors, passed balls, and catcher's interference had not happened. Runs that
 * would not have scored in that clean reconstruction are unearned.
 *
 * This module also tracks which runner was tainted (reached or advanced on an
 * error, passed ball, or catcher's interference) so that tainted runs are never
 * credited as earned even if the clean count is high enough.
 */

import type {
  Base,
  BatterInput,
  Destination,
  GameEvent,
  GameSetup,
  GameState,
  LoggedPlay,
  RunnerInput,
  TeamSide,
} from "../types";
import { createInitialState, reduceEventsRaw } from "../engine";

/** Transform a single event into its "clean" version for reconstruction. */
function cleanEvent(ev: GameEvent): GameEvent | null {
  switch (ev.type) {
    case "pitch":
    case "sub":
    case "abs":
    case "position":
      return ev;
    case "runner":
      return cleanRunnerEvent(ev.input) ? ev : null;
    case "play":
      return cleanBatterInput(ev.input) ? { ...ev, input: cleanBatterInput(ev.input)! } : null;
  }
}

function cleanRunnerEvent(input: RunnerInput): boolean {
  // Passed balls are treated like errors for earned run purposes.
  return input.kind !== "passed-ball";
}

function cleanBatterInput(input: BatterInput): BatterInput | null {
  switch (input.kind) {
    case "hit": {
      // Remove the secondary error on a legitimate hit; keep the hit itself.
      if (!input.errorFielders?.length) return input;
      return { kind: "hit", bases: input.bases, groundRule: input.groundRule };
    }
    case "batted": {
      if (!input.errorFielders?.length) return input;
      // Without the error, the batter would have been retired if the error is
      // what allowed him to reach. Other retired runners stay out.
      const retired = new Set(input.retired);
      if (!retired.has("batter")) retired.add("batter");
      return {
        kind: "batted",
        batted: input.batted,
        fielders: input.fielders,
        retired: [...retired],
        errorFielders: undefined,
      };
    }
    case "dropped-third":
    case "catcher-interference":
      // In a clean inning these are simply strikeouts.
      return { kind: "strikeout", swinging: input.kind === "dropped-third" ? input.swinging : false };
    case "walk":
    case "hbp":
    case "sac-bunt":
    case "strikeout":
      return input;
  }
}

/** Replay the event log with errors removed and count runs per half-inning. */
export function cleanRunsPerHalfInning(setup: GameSetup, events: GameEvent[]): Map<string, number> {
  const clean = events.map(cleanEvent).filter((e): e is GameEvent => e !== null);
  const cleanState = reduceEventsRaw(setup, clean);
  const map = new Map<string, number>();
  for (const play of cleanState.plays) {
    const key = `${play.battingTeam}-${play.inning}-${play.half}`;
    map.set(key, (map.get(key) ?? 0) + play.runsScored.length);
  }
  return map;
}

/** Compute earned runs per play and return an updated state. */
export function computeEarnedRuns(setup: GameSetup, events: GameEvent[], state: GameState): GameState {
  const clean = cleanRunsPerHalfInning(setup, events);

  // Determine which scored runners are earned, per half-inning.
  const earnedByKey = new Map<string, string[]>();
  const earnedRunIdsByPlay = new Map<string, string[]>();

  for (const play of state.plays) {
    const key = `${play.battingTeam}-${play.inning}-${play.half}`;
    const earnedSoFar = earnedByKey.get(key) ?? [];
    const cleanRuns = clean.get(key) ?? 0;
    const earnedCap = cleanRuns - earnedSoFar.length;

    const playEarned: string[] = [];
    // Tainted runs are always unearned; do not count them toward the cap.
    const nonTainted = play.runsScored.filter((id) => !play.taintedRuns.includes(id));
    // Mark earned in scoring order up to the clean limit.
    for (const runnerId of nonTainted) {
      if (playEarned.length < earnedCap) playEarned.push(runnerId);
    }

    earnedRunIdsByPlay.set(play.id, playEarned);
    earnedByKey.set(key, [...earnedSoFar, ...playEarned]);
  }

  return {
    ...state,
    plays: state.plays.map((play) => ({
      ...play,
      earnedRunIds: earnedRunIdsByPlay.get(play.id) ?? [],
      resolution: {
        ...play.resolution,
        earnedRuns: (earnedRunIdsByPlay.get(play.id) ?? []).length,
      },
    })),
  };
}

/** Build a runner-state map during reduction. */
export function initRunnerState(): Record<string, { runnerId: string; responsiblePitcherId: string; tainted: boolean }> {
  return {};
}

/** Mark a runner as on base, responsible to the given pitcher. */
export function setRunner(
  map: Record<string, { runnerId: string; responsiblePitcherId: string; tainted: boolean }>,
  runnerId: string,
  pitcherId: string,
  tainted: boolean,
) {
  map[runnerId] = { runnerId, responsiblePitcherId: pitcherId, tainted };
}

/** Mark a runner as tainted due to an error/passed ball/catcher's interference. */
export function taintRunner(
  map: Record<string, { runnerId: string; responsiblePitcherId: string; tainted: boolean }>,
  runnerId: string,
) {
  const r = map[runnerId];
  if (r) r.tainted = true;
}

/** Remove a runner from the map (out or scored). */
export function removeRunner(
  map: Record<string, { runnerId: string; responsiblePitcherId: string; tainted: boolean }>,
  runnerId: string,
) {
  delete map[runnerId];
}

