const assert = require("assert");
const P = require("../js/program.js");

const program = P.buildProgram();
assert.strictEqual(program.length, 42, "program has 42 days");
assert.ok(program.every((day) => day.exercises.length >= 2), "each day has exercises");
assert.deepStrictEqual(
  program.filter((day) => day.isRecovery).map((day) => day.day),
  [7, 14, 21, 28, 35, 42],
  "recovery days"
);
assert.strictEqual(program[0].challenge, "FOUNDATIONS");
assert.strictEqual(program[14].challenge, "STAMINA");
assert.strictEqual(program[28].challenge, "CONTROL MASTERY");
assert.ok(program[0].timeEst >= 3);

const scaled = P.applyPreset(program, { ...P.DEFAULT_PRESET, longHold: 8, flicks: 20 }, true);
assert.ok(scaled[0].exercises.find((ex) => ex.type === "long-hold").hold > program[0].exercises.find((ex) => ex.type === "long-hold").hold);
assert.ok(scaled[0].exercises.find((ex) => ex.type === "quick-flick").reps > program[0].exercises.find((ex) => ex.type === "quick-flick").reps);
assert.deepStrictEqual(P.applyPreset(program, P.DEFAULT_PRESET, false), program);

const phases = P.buildPhases(program[0]);
assert.ok(phases.length > 4);
assert.ok(phases.every((phase) => phase.duration > 0 && phase.label));

assert.strictEqual(P.nextProgramDay([]), 1);
assert.strictEqual(P.nextProgramDay([1, 2, 4]), 3);
assert.strictEqual(P.nextProgramDay(Array.from({ length: 42 }, (_, i) => i + 1)), 42);

const core = {
  completedDays: [],
  streak: 0,
  lastDate: null,
  totalHold: 0,
  sessions: 0,
  longestStreak: 0,
};
const afterFirst = P.applySessionComplete(core, { day: 1, holdSeconds: 40, date: "2026-08-16" });
assert.deepStrictEqual(afterFirst.completedDays, [1]);
assert.strictEqual(afterFirst.streak, 1);
assert.strictEqual(afterFirst.sessions, 1);

const afterRepeat = P.applySessionComplete(afterFirst, { day: 1, holdSeconds: 10, date: "2026-08-16" });
assert.strictEqual(afterRepeat.sessions, 1);
assert.strictEqual(afterRepeat.streak, 1);
assert.strictEqual(afterRepeat.totalHold, 50);

const afterNext = P.applySessionComplete(afterFirst, { day: 2, holdSeconds: 20, date: "2026-08-17" });
assert.strictEqual(afterNext.streak, 2);
assert.strictEqual(afterNext.longestStreak, 2);

const afterGap = P.applySessionComplete(afterNext, { day: 3, holdSeconds: 20, date: "2026-08-20" });
assert.strictEqual(afterGap.streak, 1);
assert.strictEqual(afterGap.longestStreak, 2);

assert.strictEqual(P.formatClock(65), "1:05");
assert.strictEqual(P.formatClock(0.2), "0:01");
assert.strictEqual(P.daysBetween("2026-08-16", "2026-08-18"), 2);
assert.ok(P.greeting(new Date("2026-08-16T08:00:00")).includes("morning"));
assert.strictEqual(P.weeklyStats([1, 2, 8])[0].done, 2);

console.log("All program tests passed");
