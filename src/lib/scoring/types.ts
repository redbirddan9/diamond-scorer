/**
 * Core domain types for the scorebook.
 *
 * The application is event sourced: `GameSetup` + `GameEvent[]` fully determine
 * every derived artifact. Events record ONLY what the scorer observed on the
 * field ("what happened"); the rules layer (src/lib/scoring/rules) decides the
 * official scoring result ("how it is scored"). No UI component decides rules.
 */

export type Handedness = "R" | "L" | "S";
export type TeamSide = "away" | "home";
export type Half = "top" | "bottom";
export type Base = 1 | 2 | 3;
/** 4 = home plate (run scored), "out" = retired on the play. */
export type Destination = 1 | 2 | 3 | 4 | "out";
/** Key used for advancement overrides: "batter" or the base a runner came from. */
export type RunnerKey = "batter" | "1" | "2" | "3";

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
  /** Player ids in batting order. */
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

/* ------------------------------------------------------------------ *
 * Observations — what the scorer saw
 * ------------------------------------------------------------------ */

export type BattedBallType = "ground" | "fly" | "line" | "popup" | "bunt";
/** Who the defense retired on the play. */
export type OutTarget = "batter" | Base;

/**
 * A secondary defensive error committed AFTER the primary result is already
 * established (e.g. a clean double, then the right fielder boots the ball and
 * the batter takes third). It never changes the primary classification.
 */
export interface SecondaryError {
  /** Position number that committed the error (1-9). */
  fielder: number;
  /** Whose advancement the error caused. */
  runner: RunnerKey;
  /** Extra bases gained because of the error. Defaults to 1. */
  bases?: number;
}

export type BatterInput =
  | {
      kind: "hit";
      bases: 1 | 2 | 3 | 4;
      groundRule?: boolean;
      secondary?: SecondaryError;
    }
  | { kind: "strikeout"; swinging: boolean }
  | {
      kind: "dropped-third";
      swinging: boolean;
      cause: "wild-pitch" | "passed-ball" | "throw";
      batterSafe: boolean;
      fielders?: number[];
      errorFielders?: number[];
    }
  | { kind: "walk"; intentional?: boolean }
  | { kind: "hbp" }
  | {
      kind: "batted";
      batted: BattedBallType;
      /** Position numbers in scoring order, e.g. [6,4,3]. */
      fielders: number[];
      /** Everyone the defense retired on this continuous play. */
      retired: OutTarget[];
      errorFielders?: number[];
      secondary?: SecondaryError;
    }
  | { kind: "sac-bunt"; fielders: number[]; retired?: OutTarget[] };

export type RunnerInput =
  | { kind: "steal"; attempts: { from: Base; safe: boolean }[] }
  | { kind: "wild-pitch" }
  | { kind: "passed-ball" }
  | { kind: "balk" }
  | { kind: "defensive-indifference"; runners: Base[] }
  | {
      kind: "pickoff";
      from: Base;
      out: boolean;
      fielders?: number[];
      errorFielders?: number[];
    };

export type PlayInput = BatterInput | RunnerInput;

/* ------------------------------------------------------------------ *
 * Official scoring result
 * ------------------------------------------------------------------ */

export type PlayClassification =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "K"
  | "BB"
  | "IBB"
  | "HBP"
  | "CI"
  | "E"
  | "FC"
  | "SF"
  | "SH"
  | "DP"
  | "TP"
  | "OUT"
  | "SB"
  | "CS"
  | "WP"
  | "PB"
  | "BALK"
  | "DI"
  | "PO";

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
  | "pickoff"
  | "caught-stealing"
  | "defensive-indifference"
  | "other";

export interface Advance {
  runnerId: string;
  from: Base;
  to: Destination;
  reason: AdvanceReason;
  /** Position number charged with an error that caused this movement. */
  errorFielder?: number;
}

/**
 * A notation that belongs on a basepath of the scorecard diamond (SB, CS, WP,
 * PB, E9 …). `base` is the base the runner was heading for (1-4).
 */
export interface BasepathMark {
  runnerId: string;
  base: number;
  label: string;
  /** Runner was retired attempting that base — circle the corner. */
  out?: boolean;
}

/** The full, official outcome of one play as decided by the rules layer. */
export interface PlayResolution {
  classification: PlayClassification;
  /** null for plays with no batter (steals, wild pitches, pickoffs …). */
  batterTo: Destination | null;
  advances: Advance[];
  rbi: number;
  outsRecorded: number;
  runs: number;
  fielders: number[];
  errorFielders: number[];
  earnedRuns: boolean;
  isHit: boolean;
  isAtBat: boolean;
  isPlateAppearance: boolean;
  isStrikeout: boolean;
  isWalk: boolean;
  /** Basepath notations produced by this play. */
  marks: BasepathMark[];
  /** Runner keys whose destination the engine could not infer with certainty. */
  uncertain: RunnerKey[];
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export interface PlayEvent {
  id: string;
  type: "play";
  ts: string;
  batterId: string;
  input: BatterInput;
  /** Scorer overrides for runner destinations, keyed by RunnerKey. */
  overrides?: Partial<Record<RunnerKey, Destination>>;
  note?: string;
}

export interface RunnerEvent {
  id: string;
  type: "runner";
  ts: string;
  input: RunnerInput;
  overrides?: Partial<Record<RunnerKey, Destination>>;
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
  kind?: "PH" | "PR" | "P" | "DEF";
  base?: Base;
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
  battingTeam: TeamSide;
  battingSlot: number;
}

/** A play, with the resolved official result and its game context. */
export interface LoggedPlay {
  id: string;
  ts: string;
  type: "play" | "runner";
  /** null for runner-only plays. */
  batterId: string | null;
  input: PlayInput;
  resolution: PlayResolution;
  inning: number;
  half: Half;
  battingTeam: TeamSide;
  /** Batting order slot of the batter, null for runner-only plays. */
  slot: number | null;
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
  playerNames: Record<string, string>;
  plays: LoggedPlay[];
  over: boolean;
  challenges: Record<TeamSide, number>;
  absLog: AbsChallengeLog[];
  subLog: SubRecord[];
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
