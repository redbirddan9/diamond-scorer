/**
 * Core domain types for the scorebook.
 *
 * The application is event-sourced: `GameSetup` + `GameEvent[]` fully
 * determine every derived artifact (game state, scorebook, box score, stats).
 */

export type Handedness = "R" | "L" | "S";
export type TeamSide = "away" | "home";
export type Half = "top" | "bottom";
export type Base = 1 | 2 | 3;
/** 4 = home plate (run scored), "out" = retired on the play. */
export type Destination = 1 | 2 | 3 | 4 | "out";

export interface Player {
  id: string;
  number?: string;
  name: string;
  position: string;
  bats?: Handedness;
  throws?: Handedness;
}

export interface TeamSetup {
  name: string;
  players: Player[];
  /** Player ids, batting order slots 1-9. */
  lineup: string[];
  pitcherId: string;
}

export interface Umpires {
  home?: string;
  first?: string;
  second?: string;
  third?: string;
}

export interface GameSetup {
  id: string;
  createdAt: string;
  date: string;
  startTime?: string;
  stadium?: string;
  city?: string;
  attendance?: string;
  notes?: string;
  /** Universal DH: pitcher does not bat. */
  useDh?: boolean;
  /** Track balls/strikes/fouls during the game. */
  trackPitches?: boolean;
  umpires: Umpires;
  innings: number;
  away: TeamSetup;
  home: TeamSetup;
}

export type PlayResult =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "GRD"
  | "K_SWING"
  | "K_LOOK"
  | "BB"
  | "IBB"
  | "HBP"
  | "E"
  | "FC"
  | "SF"
  | "SH"
  | "GO"
  | "PF"
  | "LO"
  | "PO"
  | "DP"
  | "TP"
  | "CI"
  | "OBSTRUCTION"
  | "INTERFERENCE";

export type AdvanceReason =
  | "hit"
  | "walk"
  | "error"
  | "fielders-choice"
  | "wild-pitch"
  | "passed-ball"
  | "stolen-base"
  | "balk"
  | "sacrifice"
  | "force-out"
  | "tag-out"
  | "double-play"
  | "pickoff"
  | "caught-stealing"
  | "defensive-indifference"
  | "obstruction"
  | "interference"
  | "other";

export interface Advance {
  runnerId: string;
  from: Base;
  to: Destination;
  reason: AdvanceReason;
}

export interface PlayEvent {
  id: string;
  type: "play";
  ts: string;
  batterId: string;
  result: PlayResult;
  /** Position numbers in scoring order, e.g. [6,4,3]. */
  fielders: number[];
  /** Where the batter ends up. "out" for retired batters. */
  batterTo: Destination;
  advances: Advance[];
  rbi: number;
  /** Every fielder charged with an error on the play. */
  errorFielders?: number[];
  earnedRuns?: boolean;
  note?: string;
}

export interface RunnerEvent {
  id: string;
  type: "runner";
  ts: string;
  advances: Advance[];
  note?: string;
}

export interface PitchEvent {
  id: string;
  type: "pitch";
  ts: string;
  call: "ball" | "strike" | "foul";
}

export interface SubEvent {
  id: string;
  type: "sub";
  ts: string;
  team: TeamSide;
  outPlayerId: string;
  inPlayerId: string;
  /** 0-based batting order slot; omitted for pure defensive swaps. */
  slot?: number;
  position?: string;
  /** What kind of substitution this is. */
  kind?: "PH" | "PR" | "P" | "DEF";
  /** For pinch runners: the base the replaced runner occupied. */
  base?: Base;
  /** Display name of the incoming player (rosters are open-ended). */
  inPlayerName?: string;
}

export type AbsCaller = "pitcher" | "catcher" | "batter";
export type AbsOutcome =
  | "ball-confirmed"
  | "ball-overturned"
  | "strike-confirmed"
  | "strike-overturned";

/** Automated Ball-Strike challenge. */
export interface AbsEvent {
  id: string;
  type: "abs";
  ts: string;
  caller: AbsCaller;
  outcome: AbsOutcome;
}

export type GameEvent = PlayEvent | RunnerEvent | PitchEvent | SubEvent | AbsEvent;

export interface AbsChallengeLog {
  inning: number;
  half: Half;
  team: TeamSide;
  caller: AbsCaller;
  outcome: AbsOutcome;
  retained: boolean;
}

/** A substitution as it happened, used to annotate the scorecard. */
export interface SubRecord {
  team: TeamSide;
  kind: "PH" | "PR" | "P" | "DEF";
  inning: number;
  half: Half;
  slot?: number;
  outPlayerId: string;
  inPlayerId: string;
  position?: string;
  /** Batting team + slot when the change happened (used for pitcher marks). */
  battingTeam: TeamSide;
  battingSlot: number;
}

export interface LoggedPlay extends PlayEvent {
  inning: number;
  half: Half;
  battingTeam: TeamSide;
  slot: number;
  pitcherId: string;
  outsBefore: number;
  runsScored: string[];
  pitchCount: number;
}

export interface GameState {
  setup: GameSetup;
  inning: number;
  half: Half;
  outs: number;
  balls: number;
  strikes: number;
  bases: Record<Base, string | null>;
  score: Record<TeamSide, number>;
  hits: Record<TeamSide, number>;
  errors: Record<TeamSide, number>;
  lineScore: Record<TeamSide, number[]>;
  lineup: Record<TeamSide, string[]>;
  slot: Record<TeamSide, number>;
  pitcher: Record<TeamSide, string>;
  pitchesThrown: Record<string, number>;
  positions: Record<TeamSide, Record<string, string>>;
  /** Every player id seen so far (rosters plus substitutes) mapped to a name. */
  playerNames: Record<string, string>;
  plays: LoggedPlay[];
  over: boolean;
  /** ABS challenges remaining for each team. */
  challenges: Record<TeamSide, number>;
  absLog: AbsChallengeLog[];
  subLog: SubRecord[];
  /** Extra-innings automatic runner, per half inning. */
  ghostRunner: string | null;
  winner: TeamSide | null;
}

export type GameStatus = "in-progress" | "final" | "archived";

export interface StoredGame {
  id: string;
  setup: GameSetup;
  events: GameEvent[];
  status: GameStatus;
  updatedAt: string;
}