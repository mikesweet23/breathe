const RECOVERY_DAYS = new Set([7, 14, 21, 28, 35, 42]);

const DAY_FOCUS = [
  "Connection & Awareness",
  "Pelvic Floor Mapping",
  "Breath Sync",
  "Gentle Activation",
  "Release & Relax",
  "Stability Base",
  "Recovery • Breath & Release",
  "Quick Response",
  "Sustained Engagement",
  "Coordination",
  "Control Introduction",
  "Endurance Base",
  "Release Focus",
  "Recovery • Reset",
  "Longer Holds",
  "Flick Power",
  "Mixed Control",
  "Stamina Build",
  "Breath Mastery",
  "Active Recovery Light",
  "Peak Endurance",
  "Flick + Hold",
  "Deep Release",
  "Recovery • Lengthen",
  "Elevator Intro",
  "Alternating Control",
  "Precision Holds",
  "Recovery • Flow",
  "Advanced Stamina",
  "Flick Ladder",
  "Elevator Mastery",
  "Alternating Power",
  "Control Under Fatigue",
  "Recovery • Integration",
  "Mastery Hold",
  "Speed + Control",
  "Peak Control",
  "Advanced Alternating",
  "Endurance Test",
  "Recovery • Open",
  "Full Integration",
  "Final Mastery",
];

const DAY_BENEFIT = [
  "Build mind-muscle link, reduce leaks",
  "Improve start-stop control",
  "Coordinate diaphragm & pelvic floor",
  "Prevent hypertonic tension",
  "Increase blood flow & firmness",
  "Support lower back stability",
  "Restore, prevent over-tightening",
  "Sharper quick contraction for urgency",
  "Stronger longer contraction",
  "Better continence during movement",
  "Foundation for stamina",
  "Reduce post-void dribble",
  "Essential for pain-free function",
  "Consolidate neural pathways",
  "Longer hold = stronger closure",
  "Fast-twitch for cough/sneeze",
  "Switch quickly between tension & release",
  "Build fatigue resistance",
  "Deep diaphragmatic release",
  "Maintain without strain",
  "Hold firm under load",
  "Combine speed & strength",
  "Release is half the skill",
  "Adapt & grow",
  "Graded control, not all-or-nothing",
  "Master on/off switching",
  "Sustain strength longer",
  "Light flush, stay mobile",
  "Hold through urge waves",
  "Quick flicks protect",
  "Climb strength in steps",
  "Control during arousal",
  "Hold when tired, key for control",
  "Let go fully",
  "Peak strength + control",
  "Fast response when needed",
  "Highest level coordination",
  "Switch fast, stay relaxed",
  "Test full capacity",
  "Open & lengthen",
  "Own your control",
  "Complete program",
];

const TIPS = [
  "Breathe normally during holds — never hold your breath. That's how you over-recruit glutes.",
  "50% of control is release. If you can't fully relax after a rep, you're too tight.",
  "Do sessions after a bathroom visit, not with a full bladder.",
  "Sit or lie initially. Standing is harder — save it for week 3+.",
  "Reverse kegels aren't pushing — it's letting the floor drop like an elevator down.",
  "Daily 5 min beats 20 min twice a week. Neuromuscular learning loves frequency.",
  "If you feel tailbone or lower abs ache, you're doing reverse right. Sharp pain = stop.",
  "Pair with a habit: after brushing teeth, before bed. Adherence is everything.",
];

const GUIDE = [
  {
    t: "How to find it (male)",
    b: "1) Stop urine mid-stream once to feel it — don’t train this way. 2) Imagine lifting testes slightly without squeezing glutes. 3) You should feel a gentle lift behind the pubic bone, not a butt clench. If glutes or abs fire hard, ease to 40% effort.",
  },
  {
    t: "Why reverse kegels are essential",
    b: "Only doing kegels = hypertonic floor = urgency, dribble, pelvic pain, premature ejaculation. Reverse is active release: inhale, belly expands 360°, pelvic floor drops like an elevator down. Train 50/50. Recovery days are only reverse + light hold to prevent tension.",
  },
  {
    t: "Breathing coordination",
    b: "EXHALE • LIFT for kegels (exhale helps lift). INHALE • RELEASE for reverse (inhale helps drop). Never hold your breath. If you hold your breath you’re using abs/glutes to cheat.",
  },
  {
    t: "Common mistakes",
    b: "• Too much force (60–70% max is enough) • Squeezing glutes • Holding breath • Training with a full bladder • Only kegels, no reverse • Skipping days then doubling — daily 5 min beats an occasional 20 min.",
  },
  {
    t: "Benefits you may notice",
    b: "• Less post-void dribble • Firmer erections via bulbocavernosus • Better control during arousal • Less urgency when coughing/sneezing • Lower back support. Takes 2–4 weeks of daily practice.",
  },
  {
    t: "Science & sources",
    b: "Mayo Clinic: pelvic floor exercises help male incontinence and sexual health. Harvard Health: kegel + reverse helps prevent hypertonic issues. NHS: daily short pelvic floor sessions are recommended for adherence and motor learning. Note: daily light practice beats every-other-day for neuromuscular learning.",
  },
  {
    t: "Disclaimer",
    b: "Not medical advice. For educational purposes. If you have pelvic pain, prostatitis, recent surgery, or incontinence, talk to a GP or pelvic physio. Stop if you feel pain.",
  },
];

const DEFAULT_PRESET = {
  longHold: 4,
  rest: 3,
  flicks: 10,
  reverse: 5,
  endurance: 6,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function exerciseSeconds(exercise) {
  if (exercise.type === "quick-flick") return (exercise.hold + exercise.rest) * exercise.reps;
  if (exercise.type === "elevator") return (exercise.hold * 3 + exercise.rest) * exercise.reps;
  if (exercise.type === "alternating") {
    return (exercise.hold + (exercise.reverseHold || 5) + exercise.rest) * exercise.reps;
  }
  return (exercise.hold + exercise.rest) * exercise.reps;
}

function holdSeconds(exercise) {
  if (exercise.type === "quick-flick") return exercise.hold * exercise.reps;
  if (exercise.type === "elevator") return exercise.hold * 3 * exercise.reps;
  if (exercise.type === "alternating") return exercise.hold * exercise.reps;
  return exercise.hold * exercise.reps;
}

function timeEstimate(exercises) {
  const total = exercises.reduce((sum, exercise) => sum + exerciseSeconds(exercise), 0);
  return Math.max(3, Math.round(total / 60));
}

function phaseForDay(day) {
  if (day <= 14) return "FOUNDATIONS";
  if (day <= 28) return "STAMINA";
  return "CONTROL MASTERY";
}

function buildDayExercises(day) {
  const progress = (day - 1) / 41;
  const longHold = Math.round(clamp(3 + progress * 7, 3, 10));
  const flicks = Math.round(clamp(10 + progress * 12, 10, 22));
  const reverse = Math.round(clamp(4 + progress * 4, 4, 8));
  const endurance = Math.round(clamp(6 + progress * 6, 6, 12));
  const rest = day <= 28 ? 3 : 2;
  const recovery = RECOVERY_DAYS.has(day);

  if (recovery) {
    return [
      {
        id: `d${day}-rev`,
        name: "Reverse Kegel Breathing",
        hold: reverse,
        rest: reverse,
        reps: 6,
        type: "reverse",
        instruction: "Inhale deep into belly, let pelvic floor drop and widen. No pushing.",
      },
      {
        id: `d${day}-light`,
        name: "Light Hold & Release",
        hold: Math.max(3, longHold - 2),
        rest: 4,
        reps: 5,
        type: "long-hold",
        instruction: "Gentle 40% lift, then fully let go. Focus on release.",
      },
    ];
  }

  if (day <= 14) {
    return [
      {
        id: `d${day}-flick`,
        name: "Quick Flicks",
        hold: 1,
        rest: day < 5 ? 2 : 3,
        reps: flicks,
        type: "quick-flick",
        instruction: "Fast lift 1s, quick release. Like stopping flow quickly.",
      },
      {
        id: `d${day}-hold`,
        name: "Long Hold",
        hold: longHold,
        rest,
        reps: clamp(5 + Math.floor(day / 2), 5, 8),
        type: "long-hold",
        instruction: "Lift and hold, breathe normally. Stop if you hold breath.",
      },
      {
        id: `d${day}-rev`,
        name: "Reverse Breathing",
        hold: reverse,
        rest: reverse,
        reps: 5,
        type: "reverse",
        instruction: "360° belly breath, pelvic floor expands on inhale.",
      },
    ];
  }

  if (day <= 28) {
    return [
      {
        id: `d${day}-hold`,
        name: "Long Hold",
        hold: longHold,
        rest,
        reps: 7,
        type: "long-hold",
        instruction: "Progressive strength. Full release between.",
      },
      {
        id: `d${day}-end`,
        name: "Endurance Hold",
        hold: endurance,
        rest: 4,
        reps: 3,
        type: "endurance",
        instruction: "70% effort, long hold. The money rep.",
      },
      {
        id: `d${day}-flick`,
        name: "Quick Flicks",
        hold: 1,
        rest: 2,
        reps: flicks,
        type: "quick-flick",
        instruction: "Explosive fast-twitch recruitment.",
      },
      {
        id: `d${day}-rev`,
        name: "Reverse Breathing",
        hold: reverse,
        rest: reverse,
        reps: 6,
        type: "reverse",
        instruction: "Critical: train relaxation to avoid tightness.",
      },
    ];
  }

  const elevator = clamp(3 + Math.floor((day - 28) / 3), 3, 5);
  return [
    {
      id: `d${day}-elev`,
      name: "Elevator",
      hold: elevator,
      rest: 2,
      reps: 4,
      type: "elevator",
      instruction: "3 floors: 30% → 60% → 90%, then drop.",
    },
    {
      id: `d${day}-alt`,
      name: "Alternating Control",
      hold: longHold,
      rest: 3,
      reps: 5,
      type: "alternating",
      reverseHold: reverse,
      instruction: `Kegel ${longHold}s + Reverse ${reverse}s + Rest. Switch fast.`,
    },
    {
      id: `d${day}-hold`,
      name: "Long Hold",
      hold: longHold,
      rest: 2,
      reps: 6,
      type: "long-hold",
      instruction: "Peak hold with minimal rest.",
    },
    {
      id: `d${day}-rev`,
      name: "Reverse Breathing",
      hold: reverse,
      rest: reverse,
      reps: 6,
      type: "reverse",
      instruction: "Master the let-go after effort.",
    },
  ];
}

function buildProgram() {
  const days = [];
  for (let day = 1; day <= 42; day += 1) {
    const exercises = buildDayExercises(day);
    days.push({
      day,
      challenge: phaseForDay(day),
      focus: DAY_FOCUS[day - 1],
      benefit: DAY_BENEFIT[day - 1],
      timeEst: timeEstimate(exercises),
      exercises,
      isRecovery: RECOVERY_DAYS.has(day),
    });
  }
  return days;
}

function applyPreset(program, preset, enabled) {
  if (!preset || !enabled) return program;
  const delta = {
    longHold: preset.longHold - DEFAULT_PRESET.longHold,
    rest: preset.rest - DEFAULT_PRESET.rest,
    flicks: preset.flicks - DEFAULT_PRESET.flicks,
    reverse: preset.reverse - DEFAULT_PRESET.reverse,
    endurance: preset.endurance - DEFAULT_PRESET.endurance,
  };

  return program.map((day) => {
    const exercises = day.exercises.map((exercise) => {
      let hold = exercise.hold;
      let rest = clamp(exercise.rest + delta.rest, 2, 8);
      let reps = exercise.reps;
      let reverseHold = exercise.reverseHold;

      if (exercise.type === "long-hold") hold = clamp(exercise.hold + delta.longHold, 3, 12);
      if (exercise.type === "quick-flick") reps = clamp(exercise.reps + delta.flicks, 8, 30);
      if (exercise.type === "reverse") {
        hold = clamp(exercise.hold + delta.reverse, 3, 10);
        rest = clamp(exercise.rest + delta.reverse, 3, 10);
      }
      if (exercise.type === "endurance") hold = clamp(exercise.hold + delta.endurance, 6, 15);
      if (exercise.type === "elevator") hold = clamp(exercise.hold + delta.longHold, 3, 12);
      if (exercise.type === "alternating") {
        hold = clamp(exercise.hold + delta.longHold, 3, 12);
        if (reverseHold) reverseHold = clamp(reverseHold + delta.reverse, 3, 10);
      }

      return { ...exercise, hold, rest, reps, reverseHold };
    });

    return { ...day, exercises, timeEst: timeEstimate(exercises) };
  });
}

function buildPhases(dayPlan) {
  const phases = [];
  dayPlan.exercises.forEach((exercise, exerciseIdx) => {
    for (let rep = 1; rep <= exercise.reps; rep += 1) {
      const base = { exerciseIdx, exerciseId: exercise.id, rep };
      if (exercise.type === "quick-flick") {
        phases.push({ label: "LIFT", duration: exercise.hold, type: "kegel", ...base });
        phases.push({ label: "RELEASE", duration: exercise.rest, type: "rest", ...base });
      } else if (exercise.type === "long-hold") {
        phases.push({ label: "LIFT • HOLD", duration: exercise.hold, type: "kegel", ...base });
        phases.push({ label: "RELEASE", duration: exercise.rest, type: "rest", ...base });
      } else if (exercise.type === "endurance") {
        phases.push({ label: "HOLD", duration: exercise.hold, type: "kegel", ...base });
        phases.push({ label: "BREATHE", duration: exercise.rest, type: "rest", ...base });
      } else if (exercise.type === "reverse") {
        phases.push({ label: "INHALE • RELEASE", duration: exercise.hold, type: "reverse", ...base });
        phases.push({ label: "EXHALE", duration: exercise.rest, type: "rest", ...base });
      } else if (exercise.type === "elevator") {
        phases.push({ label: "LEVEL 1", duration: exercise.hold, type: "elevator", step: 1, ...base });
        phases.push({ label: "LEVEL 2", duration: exercise.hold, type: "elevator", step: 2, ...base });
        phases.push({ label: "LEVEL 3", duration: exercise.hold, type: "elevator", step: 3, ...base });
        phases.push({ label: "DROP", duration: exercise.rest, type: "rest", ...base });
      } else if (exercise.type === "alternating") {
        phases.push({ label: "EXHALE • LIFT", duration: exercise.hold, type: "kegel", ...base });
        phases.push({
          label: "INHALE • RELEASE",
          duration: exercise.reverseHold || 5,
          type: "reverse",
          ...base,
        });
        phases.push({ label: "REST", duration: exercise.rest, type: "rest", ...base });
      }
    }
  });
  return phases;
}

function nextProgramDay(completedDays) {
  for (let day = 1; day <= 42; day += 1) {
    if (!completedDays.includes(day)) return day;
  }
  return 42;
}

function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(fromISO, toISO) {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function applySessionComplete(core, { day, holdSeconds: hold, date = todayISO() }) {
  const already = core.completedDays.includes(day);
  const completedDays = already
    ? core.completedDays
    : [...core.completedDays, day].sort((a, b) => a - b);

  let streak = core.streak;
  let longestStreak = core.longestStreak;
  if (!already) {
    if (!core.lastDate) streak = 1;
    else {
      const gap = daysBetween(core.lastDate, date);
      if (gap === 1) streak = core.streak + 1;
      else if (gap === 0) streak = core.streak;
      else streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  return {
    completedDays,
    streak,
    lastDate: date,
    totalHold: core.totalHold + hold,
    sessions: core.sessions + (already ? 0 : 1),
    longestStreak,
  };
}

function sessionHoldSeconds(dayPlan) {
  return dayPlan.exercises.reduce((sum, exercise) => sum + holdSeconds(exercise), 0);
}

function recommendedValue(baseDay, key) {
  if (!baseDay) return "–";
  if (key === "longHold") {
    return (
      baseDay.exercises.find((exercise) => exercise.type === "long-hold")?.hold ??
      baseDay.exercises.find((exercise) => exercise.type === "alternating")?.hold ??
      5
    );
  }
  if (key === "rest") return baseDay.exercises[0]?.rest ?? 3;
  if (key === "flicks") return baseDay.exercises.find((exercise) => exercise.type === "quick-flick")?.reps ?? 12;
  if (key === "reverse") return baseDay.exercises.find((exercise) => exercise.type === "reverse")?.hold ?? 5;
  if (key === "endurance") return baseDay.exercises.find((exercise) => exercise.type === "endurance")?.hold ?? 8;
  return "–";
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function weeklyStats(completedDays) {
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const start = week * 7 + 1;
    const end = Math.min(42, (week + 1) * 7);
    weeks.push({
      week: week + 1,
      done: completedDays.filter((day) => day >= start && day <= end).length,
      total: end - start + 1,
    });
  }
  return weeks;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const api = {
  RECOVERY_DAYS,
  TIPS,
  GUIDE,
  DEFAULT_PRESET,
  clamp,
  buildProgram,
  applyPreset,
  buildPhases,
  nextProgramDay,
  todayISO,
  daysBetween,
  applySessionComplete,
  sessionHoldSeconds,
  recommendedValue,
  greeting,
  weeklyStats,
  formatClock,
  exerciseSeconds,
};

if (typeof window !== "undefined") window.BreatheProgram = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
