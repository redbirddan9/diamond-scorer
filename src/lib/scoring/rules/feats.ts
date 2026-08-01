/** Game feat detection (no-hitter, perfect game, shutout). */

import type { GameState, TeamSide } from "../types";

export type GameFeat = "no-hitter" | "perfect-game" | "shutout";

export interface TeamFeat {
  team: TeamSide;
  feat: GameFeat;
}

function otherSide(side: TeamSide): TeamSide {
  return side === "away" ? "home" : "away";
}

function gameIsFinal(state: GameState): boolean {
  return state.over && state.winner !== null;
}

function hasNoHits(state: GameState, side: TeamSide): boolean {
  // side is the pitching team; check the opposing batting team's hits.
  return state.hits[otherSide(side)] === 0;
}

function allowedNoRunners(state: GameState, side: TeamSide): boolean {
  // No opposing batter or runner may reach a base (1, 2, 3, or 4).
  for (const play of state.plays) {
    if (play.battingTeam !== otherSide(side)) continue;
    const batterTo = play.resolution.batterTo;
    if (batterTo !== null && batterTo !== "out") {
      return false;
    }
    for (const adv of play.resolution.advances) {
      if (adv.to !== "out") {
        return false;
      }
    }
  }
  return true;
}

function allowedNoRuns(state: GameState, side: TeamSide): boolean {
  return state.score[otherSide(side)] === 0;
}

export function gameFeats(state: GameState): TeamFeat[] {
  if (!gameIsFinal(state)) return [];

  const feats: TeamFeat[] = [];
  for (const side of ["away", "home"] as TeamSide[]) {
    if (state.winner !== side) continue;
    const perfect = allowedNoRunners(state, side);
    const noHits = hasNoHits(state, side);
    const shutout = allowedNoRuns(state, side);

    if (perfect) {
      feats.push({ team: side, feat: "perfect-game" });
    } else if (noHits) {
      feats.push({ team: side, feat: "no-hitter" });
    } else if (shutout) {
      feats.push({ team: side, feat: "shutout" });
    }
  }
  return feats;
}
