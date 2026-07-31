import { describe, expect, it } from "vitest";
import { applyEvent, createInitialState, currentBatterId, reduceEvents } from "./engine";
import { resolvePlay, validate } from "./rules";
import type { BatterInput, GameEvent, GameSetup } from "./types";

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

const single: BatterInput = { kind: "hit", bases: 1 };
const homer: BatterInput = { kind: "hit", bases: 4 };
const groundOut: BatterInput = { kind: "batted", batted: "ground", fielders: [6, 3], retired: ["batter"] };
const flyOut: BatterInput = { kind: "batted", batted: "fly", fielders: [9], retired: ["batter"] };
const strikeout: BatterInput = { kind: "strikeout", swinging: true };

let seq = 0;
function run(inputs: BatterInput[], s: GameSetup = setup) {
  const events: GameEvent[] = [];
  let state = createInitialState(s);
  for (const input of inputs) {
    events.push({
      id: `e${seq++}`,
      ts: "",
      type: "play",
      batterId: currentBatterId(state),
      input,
    });
    state = reduceEvents(s, events);
  }
  return state;
}

describe("rules engine", () => {
  it("places the batter on first for a single", () => {
    const state = run([single]);
    expect(state.bases[1]).toBe("A1");
    expect(state.hits.away).toBe(1);
  });

  it("forces runners on a walk only when required", () => {
    const forced = run([single, { kind: "walk" }]);
    expect(forced.bases[2]).toBe("A1");
    const notForced = run([{ kind: "hit", bases: 2 }, { kind: "walk" }]);
    expect(notForced.bases[2]).toBe("A1");
    expect(notForced.bases[1]).toBe("A2");
  });

  it("clears the bases and credits RBIs on a home run", () => {
    const state = run([single, single, homer]);
    expect(state.score.away).toBe(3);
    expect(state.plays[2].resolution.rbi).toBe(3);
  });

  it("switches half innings automatically after three outs", () => {
    const state = run([strikeout, groundOut, flyOut]);
    expect(state.half).toBe("bottom");
    expect(state.outs).toBe(0);
  });

  it("classifies a sacrifice fly automatically and awards the RBI", () => {
    const state = createInitialState(setup);
    state.bases[3] = "A9";
    const resolution = resolvePlay(state, flyOut, { "3": 4 });
    expect(resolution.classification).toBe("SF");
    expect(resolution.rbi).toBe(1);
    expect(resolution.isAtBat).toBe(false);
  });

  it("classifies a fielder's choice when the batter reaches and a runner is out", () => {
    const state = createInitialState(setup);
    state.bases[1] = "A9";
    const resolution = resolvePlay(state, {
      kind: "batted",
      batted: "ground",
      fielders: [6, 4],
      retired: [1],
    });
    expect(resolution.classification).toBe("FC");
    expect(resolution.batterTo).toBe(1);
  });

  it("classifies a double play and withholds the RBI", () => {
    const state = createInitialState(setup);
    state.bases[1] = "A8";
    state.bases[3] = "A9";
    const resolution = resolvePlay(
      state,
      { kind: "batted", batted: "ground", fielders: [6, 4, 3], retired: [1, "batter"] },
      { "3": 4 },
    );
    expect(resolution.classification).toBe("DP");
    expect(resolution.rbi).toBe(0);
  });

  it("awards no RBI on an error", () => {
    const state = createInitialState(setup);
    state.bases[3] = "A9";
    const resolution = resolvePlay(
      state,
      { kind: "batted", batted: "ground", fielders: [6], retired: [], errorFielders: [6] },
      { "3": 4 },
    );
    expect(resolution.classification).toBe("E");
    expect(resolution.rbi).toBe(0);
  });

  it("skips the advancement menu when nothing is uncertain", () => {
    const empty = createInitialState(setup);
    expect(resolvePlay(empty, single).uncertain).toHaveLength(0);
    expect(resolvePlay(empty, strikeout).uncertain).toHaveLength(0);
    const runnerOn = createInitialState(setup);
    runnerOn.bases[1] = "A9";
    expect(resolvePlay(runnerOn, { kind: "walk" }).uncertain).toHaveLength(0);
    expect(resolvePlay(runnerOn, homer).uncertain).toHaveLength(0);
  });

  it("asks for input when a runner may tag from second", () => {
    const state = createInitialState(setup);
    state.bases[2] = "A9";
    expect(resolvePlay(state, flyOut).uncertain).toEqual(["2"]);
  });

  it("wipes the run when the batter makes the third out", () => {
    const state = createInitialState(setup);
    state.outs = 2;
    state.bases[3] = "A9";
    const resolution = resolvePlay(state, flyOut, { "3": 4 });
    expect(resolution.runs).toBe(0);
    expect(resolution.classification).toBe("OUT");
    expect(validate(state, flyOut, resolution)).toHaveLength(0);
  });

  it("ends the inning with no run on a 1st-and-3rd, two-out 4-3 groundout", () => {
    let state = createInitialState(setup);
    state.outs = 2;
    state.bases[1] = "A8";
    state.bases[3] = "A9";
    const groundout = {
      kind: "batted" as const,
      batted: "ground" as const,
      fielders: [4, 3],
      retired: ["batter" as const],
    };
    const resolution = resolvePlay(state, groundout, { "3": 4 });
    expect(resolution.runs).toBe(0);
    state = applyEvent(state, {
      id: "g1",
      ts: "",
      type: "play",
      batterId: "A1",
      input: groundout,
      overrides: { "3": 4 },
    });
    expect(state.score.away).toBe(0);
    expect(state.half).toBe("bottom");
    expect(state.outs).toBe(0);
  });

  it("keeps a double a double when a secondary error adds a base", () => {
    const state = createInitialState(setup);
    const input = {
      kind: "hit" as const,
      bases: 2 as const,
      secondary: { fielder: 9, runner: "batter" as const },
    };
    const resolution = resolvePlay(state, input, {}, "A1");
    expect(resolution.classification).toBe("2B");
    expect(resolution.batterTo).toBe(3);
    expect(resolution.errorFielders).toEqual([9]);
    expect(resolution.marks).toEqual([{ runnerId: "A1", base: 3, label: "E9" }]);
  });

  it("advances runners on defensive indifference without crediting a steal", () => {
    const state = createInitialState(setup);
    state.bases[1] = "A9";
    const resolution = resolvePlay(state, { kind: "defensive-indifference", runners: [1] });
    expect(resolution.classification).toBe("DI");
    expect(resolution.advances[0].to).toBe(2);
    expect(resolution.marks[0].label).toBe("DI");
  });

  it("handles stolen bases and caught stealing", () => {
    let state = createInitialState(setup);
    const events: GameEvent[] = [
      { id: "s0", ts: "", type: "play", batterId: "A1", input: single },
      { id: "s1", ts: "", type: "runner", input: { kind: "steal", attempts: [{ from: 1, safe: true }] } },
    ];
    state = reduceEvents(setup, events);
    expect(state.bases[2]).toBe("A1");
    expect(state.plays[1].resolution.classification).toBe("SB");
  });

  it("places an automatic runner on second in extra innings", () => {
    const short: GameSetup = { ...setup, innings: 1 };
    const state = run([groundOut, groundOut, groundOut, groundOut, groundOut, groundOut], short);
    expect(state.inning).toBe(2);
    expect(state.bases[2]).toBe("A3");
  });

  it("ends the game when the home team leads after the last inning", () => {
    const short: GameSetup = { ...setup, innings: 1 };
    const state = run([groundOut, groundOut, groundOut, homer], short);
    expect(state.over).toBe(true);
    expect(state.winner).toBe("home");
  });

  it("charges an error for every fielder selected", () => {
    const state = reduceEvents(setup, [
      {
        id: "err",
        ts: "",
        type: "play",
        batterId: "A1",
        input: { kind: "batted", batted: "ground", fielders: [6, 3], retired: [], errorFielders: [6, 3] },
      },
    ]);
    expect(state.errors.home).toBe(2);
  });

  it("keeps the challenge when a call is overturned", () => {
    const state = reduceEvents(setup, [
      { id: "a1", type: "abs", ts: "", caller: "batter", outcome: "strike-overturned" },
      { id: "a2", type: "abs", ts: "", caller: "pitcher", outcome: "ball-confirmed" },
    ]);
    expect(state.challenges.away).toBe(2);
    expect(state.challenges.home).toBe(1);
    expect(state.balls).toBe(2);
  });
});
