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
import { createInitialState, reduceEvents } from "../engine";

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
      // Without the error, the batter is retired. If the defense also retired other runners,
      // keep those outs and remove the error fielders.
      return {
        kind: "batted",
        batted: input.batted,
        fielders: input.fielders,
        retired: input.retired.filter((r) => r !== "batter"),
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
  const cleanState = reduceEvents(setup, clean);
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

  // Tally actual runs per half-inning and tainted/unearned runs.
  const actualRunsByKey = new Map<string, { total: number; tainted: number }>();
  const playEarned = new Map<string, number>();

  for (const play of state.plays) {
    const key = `${play.battingTeam}-${play.inning}-${play.half}`;
    const { total, tainted } = actualRunsByKey.get(key) ?? { total: 0, tainted: 0 };
    const newTotal = total + play.runsScored.length;
    const newTainted = tainted + play.taintedRuns.length;
    actualRunsByKey.set(key, { total: newTotal, tainted: newTainted });

    const cleanRuns = clean.get(key) ?? 0;
    // Tainted runs are always unearned. Non-tainted runs are earned up to the clean limit.
    const nonTainted = play.runsScored.length - play.taintedRuns.length;
    const earnedAlready = total - tainted; // earned runs assigned before this play
    const earned = Math.max(0, Math.min(nonTainted, cleanRuns - earnedAlready));
    playEarned.set(play.id, earned);
  }

  return {
    ...state,
    plays: state.plays.map((play) => ({
      ...play,
      resolution: { ...play.resolution, earnedRuns: playEarned.get(play.id) ?? 0 },
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

