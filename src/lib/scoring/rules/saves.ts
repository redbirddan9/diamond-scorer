/** Save, Blown Save, and Hold tracking (MLB Rule 9.19). */

import type { GameState, TeamSide } from "../types";

interface PitchingAppearance {
  pitcherId: string;
  team: TeamSide;
  startPlayIndex: number;
  endPlayIndex: number;
  outs: number;
}

interface ScoreSnapshot {
  away: number;
  home: number;
}

function otherSide(side: TeamSide): TeamSide {
  return side === "away" ? "home" : "away";
}

/** Score before each play. snapshots[0] = 0-0, snapshots[i] = score before play i. */
function scoreSnapshots(state: GameState): ScoreSnapshot[] {
  const snapshots: ScoreSnapshot[] = [{ away: 0, home: 0 }];
  for (const play of state.plays) {
    const last = snapshots[snapshots.length - 1];
    const runs = play.runsScored.length;
    snapshots.push(
      play.battingTeam === "away"
        ? { away: last.away + runs, home: last.home }
        : { away: last.away, home: last.home + runs },
    );
  }
  return snapshots;
}

function buildAppearances(state: GameState, side: TeamSide): PitchingAppearance[] {
  const subs = state.subLog.filter(
    (s) => s.team === side && s.newPitcherId && s.previousPitcherId,
  );
  const appearances: PitchingAppearance[] = [];

  if (subs.length === 0) {
    const pitcherId = state.setup[side].pitcherId;
    if (pitcherId) {
      appearances.push({
        pitcherId,
        team: side,
        startPlayIndex: 0,
        endPlayIndex: state.plays.length,
        outs: 0,
      });
    }
    return appearances;
  }

  // Starting pitcher: from the beginning until the first pitching sub.
  appearances.push({
    pitcherId: subs[0].previousPitcherId!,
    team: side,
    startPlayIndex: 0,
    endPlayIndex: subs[0].playIndex ?? 0,
    outs: 0,
  });

  // Each subsequent pitcher: from the sub's play index until the next pitching sub or end.
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const nextSub = subs[i + 1];
    appearances.push({
      pitcherId: sub.newPitcherId!,
      team: side,
      startPlayIndex: sub.playIndex ?? 0,
      endPlayIndex: nextSub ? (nextSub.playIndex ?? state.plays.length) : state.plays.length,
      outs: 0,
    });
  }

  return appearances;
}

function addOuts(state: GameState, appearances: PitchingAppearance[]) {
  for (const app of appearances) {
    for (let i = app.startPlayIndex; i < app.endPlayIndex; i++) {
      const play = state.plays[i];
      if (play && play.pitcherId === app.pitcherId && play.battingTeam !== app.team) {
        app.outs += play.resolution.outsRecorded;
      }
    }
  }
}

function isSaveSituation(snapshot: ScoreSnapshot, side: TeamSide): boolean {
  const lead = snapshot[side] - snapshot[otherSide(side)];
  return lead > 0 && lead <= 3;
}

export interface PitchingDecisionsSummary {
  pitcherId: string;
  saveOpportunities: number;
  saves: number;
  blownSaves: number;
  holds: number;
}

export function pitchingDecisions(state: GameState, side: TeamSide): PitchingDecisionsSummary[] {
  const snapshots = scoreSnapshots(state);
  const appearances = buildAppearances(state, side);
  addOuts(state, appearances);

  const decisions: Map<string, PitchingDecisionsSummary> = new Map();
  const winningPitcherId = state.setup.decisions?.win;
  const teamWon = state.winner === side;

  for (const app of appearances) {
    const entryScore = snapshots[app.startPlayIndex] ?? { away: 0, home: 0 };
    const exitScore = snapshots[app.endPlayIndex] ?? entryScore;
    const enteredSaveSituation = isSaveSituation(entryScore, side);
    const isReliever = app.startPlayIndex > 0;
    const isFinishing = app.endPlayIndex === state.plays.length;
    const isWinning = winningPitcherId === app.pitcherId;

    // Minimum lead at any point during the appearance (after the pitcher entered).
    let minLead = entryScore[side] - entryScore[otherSide(side)];
    for (let i = app.startPlayIndex + 1; i <= app.endPlayIndex; i++) {
      const s = snapshots[i] ?? exitScore;
      const lead = s[side] - s[otherSide(side)];
      if (lead < minLead) minLead = lead;
    }

    const leftWithLead = exitScore[side] > exitScore[otherSide(side)];
    const leadLost = minLead <= 0;

    const summary = decisions.get(app.pitcherId) ?? {
      pitcherId: app.pitcherId,
      saveOpportunities: 0,
      saves: 0,
      blownSaves: 0,
      holds: 0,
    };

    if (enteredSaveSituation) summary.saveOpportunities += 1;

    // Save: finishing pitcher, not winning, team won, at least 1/3 IP, and
    // either entered in a save situation or pitched 3+ innings.
    if (
      isFinishing &&
      teamWon &&
      !isWinning &&
      app.outs >= 1 &&
      (enteredSaveSituation || app.outs >= 9)
    ) {
      summary.saves += 1;
    }

    // Blown save: entered a save situation and the lead was lost.
    if (enteredSaveSituation && leadLost) {
      summary.blownSaves += 1;
    }

    // Hold: entered a save situation, recorded an out, left with the lead, not the winner, and not the finishing pitcher.
    if (enteredSaveSituation && app.outs >= 1 && leftWithLead && !isWinning && isReliever && !isFinishing) {
      summary.holds += 1;
    }

    decisions.set(app.pitcherId, summary);
  }

  return [...decisions.values()];
}
