import { describe, expect, it } from "vitest";
import {
  createInitialState,
  currentBatterId,
  proposePlay,
  reduceEvents,
} from "./engine";
import type { GameEvent, GameSetup, PlayResult } from "./types";

function team(prefix: string): GameSetup["home"] {
  const players = Array.from({ length: 9 }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    number: String(i + 1),
    name: `${prefix} Player ${i + 1}`,
    position: String(i + 1),
  }));
  return { name: prefix, players, lineup: players.map((p) => p.id), pitcherId: `${prefix}1` };
}

const setup: GameSetup = {
  id: "test",
  createdAt: new Date().toISOString(),
  date: "2026-07-27",
  umpires: {},
  innings: 9,
  away: team("A"),
  home: team("H"),
};

let seq = 0;
function play(result: PlayResult, state = createInitialState(setup)) {
  const draft = proposePlay(state, result);
  return { ...draft, id: `e${seq++}`, ts: new Date().toISOString() } as GameEvent;
}

function run(results: PlayResult[]) {
  const events: GameEvent[] = [];
  let state = createInitialState(setup);
  for (const r of results) {
    const ev = play(r, state);
    events.push(ev);
    state = reduceEvents(setup, events);
  }
  return state;
}

describe("rules engine", () => {
  it("places the batter on first for a single", () => {
    const state = run(["1B"]);
    expect(state.bases[1]).toBe("A1");
    expect(state.hits.away).toBe(1);
    expect(state.outs).toBe(0);
  });

  it("forces the runner from first on a walk only when required", () => {
    const state = run(["1B", "BB"]);
    expect(state.bases[1]).toBe("A2");
    expect(state.bases[2]).toBe("A1");
  });

  it("does not advance a runner on second on a walk with first empty", () => {
    const state = run(["2B", "BB"]);
    expect(state.bases[2]).toBe("A1");
    expect(state.bases[1]).toBe("A2");
  });

  it("clears the bases and credits RBIs on a home run", () => {
    const state = run(["1B", "1B", "HR"]);
    expect(state.score.away).toBe(3);
    expect(state.bases[1]).toBeNull();
    expect(state.plays[2].rbi).toBe(3);
  });

  it("records outs and ends the half inning after three", () => {
    const state = run(["K_SWING", "GO", "PO"]);
    expect(state.half).toBe("bottom");
    expect(state.inning).toBe(1);
    expect(state.outs).toBe(0);
  });

  it("advances the batting order and resets the count", () => {
    const state = run(["K_SWING"]);
    expect(currentBatterId(state)).toBe("A2");
    expect(state.strikes).toBe(0);
  });

  it("scores the runner from third on a sacrifice fly without an at-bat", () => {
    const state = run(["3B", "SF"]);
    expect(state.score.away).toBe(1);
    expect(state.outs).toBe(1);
    expect(state.plays[1].rbi).toBe(1);
  });

  it("retires the lead runner on a fielder's choice", () => {
    const state = run(["1B", "FC"]);
    expect(state.outs).toBe(1);
    expect(state.bases[1]).toBe("A2");
    expect(state.bases[2]).toBeNull();
  });

  it("awards no RBI on an error", () => {
    const state = run(["3B", "E"]);
    expect(state.plays[1].rbi).toBe(0);
  });

  it("replays deterministically from the event log", () => {
    const results: PlayResult[] = ["1B", "2B", "K_SWING", "HR", "GO", "PO"];
    const a = run(results);
    const b = run(results);
    expect(b.score).toEqual(a.score);
    expect(b.plays.length).toBe(a.plays.length);
  });
});
describe("extra innings, game end and ABS challenges", () => {
  const short: GameSetup = { ...setup, innings: 1 };

  function runWith(s: GameSetup, results: PlayResult[]) {
    const events: GameEvent[] = [];
    let state = createInitialState(s);
    for (const r of results) {
      const draft = proposePlay(state, r);
      events.push({ ...draft, id: `x${seq++}`, ts: "" } as GameEvent);
      state = reduceEvents(s, events);
    }
    return state;
  }

  it("places an automatic runner on second in extra innings", () => {
    // 1-inning game, both teams go in order -> extras.
    const state = runWith(short, ["GO", "GO", "GO", "GO", "GO", "GO"]);
    expect(state.inning).toBe(2);
    expect(state.over).toBe(false);
    expect(state.bases[2]).toBe("A3");
    expect(state.ghostRunner).toBe("A3");
  });

  it("ends the game when the home team leads after the last inning", () => {
    const state = runWith(short, ["GO", "GO", "GO", "HR"]);
    expect(state.over).toBe(true);
    expect(state.winner).toBe("home");
  });

  it("charges an error for every fielder selected", () => {
    let state = createInitialState(setup);
    const draft = proposePlay(state, "E", [6, 3]);
    state = reduceEvents(setup, [{ ...draft, id: "e-err", ts: "" } as GameEvent]);
    expect(state.errors.home).toBe(2);
  });

  it("keeps the challenge when a call is overturned and adds to the count", () => {
    const state = reduceEvents(setup, [
      { id: "a1", type: "abs", ts: "", caller: "batter", outcome: "strike-overturned" },
      { id: "a2", type: "abs", ts: "", caller: "pitcher", outcome: "ball-confirmed" },
    ]);
    expect(state.challenges.away).toBe(2); // overturned: retained
    expect(state.challenges.home).toBe(1); // stands: used
    expect(state.balls).toBe(2);
  });

  it("grants a challenge in extras to a team that has none left", () => {
    const events: GameEvent[] = [
      { id: "b1", type: "abs", ts: "", caller: "batter", outcome: "strike-confirmed" },
      { id: "b2", type: "abs", ts: "", caller: "batter", outcome: "strike-confirmed" },
    ];
    let state = reduceEvents(short, events);
    expect(state.challenges.away).toBe(0);
    for (const r of ["GO", "GO", "GO", "GO", "GO", "GO"] as PlayResult[]) {
      const draft = proposePlay(state, r);
      events.push({ ...draft, id: `y${seq++}`, ts: "" } as GameEvent);
      state = reduceEvents(short, events);
    }
    expect(state.inning).toBe(2);
    expect(state.challenges.away).toBe(1);
  });
});
