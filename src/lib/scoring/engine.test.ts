import { describe, expect, it } from "vitest";
import { createInitialState, currentBatterId, reduceEvents } from "./engine";
import { buildScorecard } from "./scorecard";
import { inferRetired, resolvePlay, validate } from "./rules";
import type { BatterInput, GameEvent, GameSetup, RunnerInput } from "./types";

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

  it("rejects impossible plays", () => {
    const state = createInitialState(setup);
    state.outs = 2;
    state.bases[3] = "A9";
    const resolution = resolvePlay(state, flyOut, { "3": 4 });
    expect(validate(state, flyOut, resolution).length).toBeGreaterThan(0);
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

describe("out inference from the fielding sequence", () => {
  const withRunnerOnFirst = (fielders: number[]) => {
    let state = createInitialState(setup);
    state = reduceEvents(setup, [
      { id: "s1", ts: "", type: "play", batterId: "A1", input: single },
    ]);
    const inferred = inferRetired(state.bases, "ground", fielders);
    return { state, inferred };
  };

  it("puts the batter out on 5-3", () => {
    const { state, inferred } = withRunnerOnFirst([5, 3]);
    expect(inferred).toEqual(["batter"]);
    const res = resolvePlay(state, {
      kind: "batted",
      batted: "ground",
      fielders: [5, 3],
      retired: inferred!,
    });
    expect(res.classification).toBe("OUT");
    expect(res.advances.find((a) => a.from === 1)?.to).toBe(2);
  });

  it("scores 5-4 with a runner on first as a fielder's choice", () => {
    const { state, inferred } = withRunnerOnFirst([5, 4]);
    expect(inferred).toEqual([1]);
    const res = resolvePlay(state, {
      kind: "batted",
      batted: "ground",
      fielders: [5, 4],
      retired: inferred!,
    });
    expect(res.classification).toBe("FC");
    expect(res.batterTo).toBe(1);
    expect(res.outsRecorded).toBe(1);
  });

  it("scores 6-4-3 as a double play", () => {
    const { state, inferred } = withRunnerOnFirst([6, 4, 3]);
    expect(inferred).toEqual([1, "batter"]);
    const res = resolvePlay(state, {
      kind: "batted",
      batted: "ground",
      fielders: [6, 4, 3],
      retired: inferred!,
    });
    expect(res.classification).toBe("DP");
    expect(res.outsRecorded).toBe(2);
  });

  it("asks the scorer when the throw goes to a base nobody is forced to", () => {
    const { inferred } = withRunnerOnFirst([5, 5]);
    expect(inferred).toBeNull();
    const empty = createInitialState(setup);
    expect(inferRetired(empty.bases, "ground", [6, 4])).toBeNull();
    expect(inferRetired(empty.bases, "fly", [9])).toBeNull();
  });
});

describe("circled base for outs on the basepaths", () => {
  function runAny(inputs: (BatterInput | RunnerInput)[]) {
    const events: GameEvent[] = [];
    let state = createInitialState(setup);
    for (const input of inputs) {
      const runnerKinds = ["steal", "wild-pitch", "passed-ball", "balk", "defensive-indifference", "pickoff"];
      events.push(
        runnerKinds.includes(input.kind)
          ? { id: `c${seq++}`, ts: "", type: "runner", input: input as RunnerInput }
          : {
              id: `c${seq++}`,
              ts: "",
              type: "play",
              batterId: currentBatterId(state),
              input: input as BatterInput,
            },
      );
      state = reduceEvents(setup, events);
    }
    return state;
  }
  /** Circle recorded in the first batter's box of the first inning. */
  const firstBox = (state: ReturnType<typeof runAny>) =>
    buildScorecard(state, "away")[0].cells[1]?.outOnBases;

  it("circles second base for the runner forced on a 6-4-3 double play", () => {
    const state = runAny([
      single,
      { kind: "batted", batted: "ground", fielders: [6, 4, 3], retired: [1, "batter"] },
    ]);
    expect(firstBox(state)).toEqual({ base: 2 });
  });

  it("circles second base for the runner retired on a fielder's choice", () => {
    const state = runAny([
      single,
      { kind: "batted", batted: "ground", fielders: [5, 4], retired: [1] },
    ]);
    expect(firstBox(state)).toEqual({ base: 2 });
  });

  it("circles second base with CS on a caught stealing", () => {
    const state = runAny([single, { kind: "steal", attempts: [{ from: 1, safe: false }] }]);
    expect(firstBox(state)).toEqual({ base: 2, label: "CS" });
  });

  it("circles first base with PO on a pickoff", () => {
    const state = runAny([single, { kind: "pickoff", from: 1, out: true, fielders: [1, 3] }]);
    expect(firstBox(state)).toEqual({ base: 1, label: "PO" });
  });
});

describe("third-out run scoring (Rule 5.08(a) / 5.09)", () => {
  /** Runners on first and third with the given number of outs already recorded. */
  const firstAndThird = (outs: number) => [
    ...Array.from({ length: outs }, () => strikeout),
    { kind: "hit", bases: 3 } as BatterInput,
    { kind: "walk" } as BatterInput,
  ];

  it("does not score the runner from third when the batter is the third out (4-3)", () => {
    const state = run([
      ...firstAndThird(2),
      { kind: "batted", batted: "ground", fielders: [4, 3], retired: ["batter"] },
    ]);
    expect(state.score.away).toBe(0);
    const last = state.plays[state.plays.length - 1];
    expect(last.resolution.runs).toBe(0);
    expect(last.resolution.rbi).toBe(0);
    expect(last.runsScored).toEqual([]);
    // Half inning is over.
    expect(state.half).toBe("bottom");
    expect(state.outs).toBe(0);
  });

  it("still scores the runner from third on the same play with only one out", () => {
    const state = run([
      ...firstAndThird(1),
      { kind: "batted", batted: "ground", fielders: [4, 3], retired: ["batter"] },
    ]);
    expect(state.score.away).toBe(1);
    expect(state.outs).toBe(2);
  });

  it("does not score on a force out for the third out with the bases loaded", () => {
    const state = run([
      strikeout,
      strikeout,
      single,
      { kind: "walk" },
      { kind: "walk" },
      { kind: "batted", batted: "ground", fielders: [6, 4], retired: [1] },
    ]);
    expect(state.score.away).toBe(0);
    expect(state.plays[state.plays.length - 1].resolution.rbi).toBe(0);
  });

  it("counts the run on a time play (tag out for the third out)", () => {
    const events: GameEvent[] = [];
    let state = createInitialState(setup);
    for (const input of firstAndThird(2)) {
      events.push({ id: `t${seq++}`, ts: "", type: "play", batterId: currentBatterId(state), input });
      state = reduceEvents(setup, events);
    }
    events.push({
      id: `t${seq++}`,
      ts: "",
      type: "runner",
      input: { kind: "steal", attempts: [{ from: 3, safe: true }, { from: 1, safe: false }] },
    });
    state = reduceEvents(setup, events);
    expect(state.score.away).toBe(1);
    expect(state.half).toBe("bottom");
  });
});
