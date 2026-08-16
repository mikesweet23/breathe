(() => {
  const P = window.BreatheProgram;
  const KEYS = {
    core: "breathe_core_v2_main",
    preset: "breathe_custom_preset_v2",
    settings: "breathe_settings_v2",
    history: "breathe_history_v2",
  };

  const emptyCore = () => ({
    completedDays: [],
    streak: 0,
    lastDate: null,
    totalHold: 0,
    sessions: 0,
    longestStreak: 0,
  });

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private mode */
    }
  };

  const state = {
    tab: "today",
    core: (() => {
      const saved = read(KEYS.core, null);
      return saved
        ? {
            completedDays: saved.completedDays || [],
            streak: saved.streak || 0,
            lastDate: saved.lastDate || null,
            totalHold: saved.totalHold || 0,
            sessions: saved.sessions || 0,
            longestStreak: saved.longestStreak || 0,
          }
        : emptyCore();
    })(),
    preset: read(KEYS.preset, null),
    settings: (() => {
      const saved = read(KEYS.settings, {});
      return {
        soundOn: saved.soundOn ?? true,
        hapticsOn: saved.hapticsOn ?? true,
        useCustomBaseline: saved.useCustomBaseline ?? !!read(KEYS.preset, null),
        onboarded: saved.onboarded ?? false,
        reducedMotion: saved.reducedMotion ?? false,
      };
    })(),
    history: read(KEYS.history, []),
    toast: null,
    settingsOpen: false,
    presetOpen: false,
    onboardStep: 0,
    expandedDay: null,
    openPhases: { FOUNDATIONS: true, STAMINA: false, "CONTROL MASTERY": false },
    draftPreset: null,
    session: null,
  };

  const baseProgram = P.buildProgram();
  const program = () => P.applyPreset(baseProgram, state.preset, state.settings.useCustomBaseline);
  const currentDayNumber = () => P.nextProgramDay(state.core.completedDays);
  const persist = () => {
    write(KEYS.core, state.core);
    write(KEYS.preset, state.preset);
    write(KEYS.settings, state.settings);
    write(KEYS.history, state.history);
    document.body.classList.toggle("reduce", state.settings.reducedMotion);
  };

  let toastTimer = null;
  const toast = (message) => {
    state.toast = message;
    renderChrome();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      renderChrome();
    }, 2400);
  };

  let audioCtx = null;
  const beep = (freq = 660, seconds = 0.14) => {
    if (!state.settings.soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + seconds + 0.03);
    } catch {
      /* autoplay / unsupported */
    }
  };

  const haptic = (pattern = 40) => {
    if (!state.settings.hapticsOn) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore */
    }
  };

  const cueFor = (type) => {
    if (type === "kegel") {
      beep(780, 0.12);
      haptic([18, 24, 18]);
    } else if (type === "reverse") {
      beep(520, 0.16);
      haptic(36);
    } else if (type === "elevator") {
      beep(700, 0.12);
      haptic([12, 20, 28]);
    } else {
      beep(400, 0.1);
      haptic(12);
    }
  };

  let wakeLock = null;
  const lockScreen = async (on) => {
    try {
      if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      else {
        await wakeLock?.release();
        wakeLock = null;
      }
    } catch {
      wakeLock = null;
    }
  };

  let raf = 0;
  let phaseStarted = 0;
  const stopTimer = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const remainingAfter = (session, fromIndex) =>
    session.phases.slice(fromIndex).reduce((sum, phase) => sum + phase.duration, 0);

  const finishSession = () => {
    stopTimer();
    const session = state.session;
    if (!session || session.done) return;
    const hold = P.sessionHoldSeconds(session.day);
    state.core = P.applySessionComplete(state.core, { day: session.day.day, holdSeconds: hold });
    session.done = true;
    session.holdSeconds = hold;
    session.elapsed = (Date.now() - session.startedAt) / 1000;
    persist();
    beep(1200, 0.28);
    setTimeout(() => beep(1560, 0.36), 160);
    haptic([24, 40, 24, 40, 70]);
    lockScreen(false);
    render();
  };

  const startPhaseTimer = () => {
    stopTimer();
    const session = state.session;
    if (!session || session.paused || session.done || session.preparing) return;
    const phase = session.phases[session.index];
    if (!phase) return finishSession();
    phaseStarted = performance.now() - (phase.duration - session.remaining) * 1000;

    const tick = (now) => {
      if (!state.session || state.session.paused || state.session.done) return;
      const elapsed = (now - phaseStarted) / 1000;
      session.remaining = Math.max(0, phase.duration - elapsed);
      updateSessionLive();
      if (session.remaining <= 0.02) {
        if (session.index >= session.phases.length - 1) {
          finishSession();
          return;
        }
        session.index += 1;
        const next = session.phases[session.index];
        session.remaining = next.duration;
        cueFor(next.type);
        startPhaseTimer();
        renderSession();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const startPrepare = () => {
    const session = state.session;
    session.preparing = 3;
    renderSession();
    beep(520, 0.1);
    haptic(20);
    const step = () => {
      if (!state.session || state.session.done) return;
      if (session.preparing > 1) {
        session.preparing -= 1;
        beep(520, 0.1);
        haptic(20);
        renderSession();
        session.prepTimer = setTimeout(step, 900);
      } else {
        session.preparing = 0;
        cueFor(session.phases[0].type);
        startPhaseTimer();
        renderSession();
      }
    };
    session.prepTimer = setTimeout(step, 900);
  };

  const startSession = (dayPlan) => {
    const phases = P.buildPhases(dayPlan);
    state.session = {
      day: dayPlan,
      phases,
      index: 0,
      remaining: phases[0]?.duration || 0,
      paused: false,
      done: false,
      preparing: 3,
      holdSeconds: 0,
      elapsed: 0,
      startedAt: Date.now(),
      felt: null,
      prepTimer: null,
    };
    lockScreen(true);
    startPrepare();
    render();
  };

  const endSessionEarly = () => {
    if (!state.session) return;
    if (!state.session.done && !confirm("End session? This day will not be marked complete.")) return;
    clearTimeout(state.session.prepTimer);
    stopTimer();
    lockScreen(false);
    state.session = null;
    render();
  };

  const skipExercise = () => {
    const session = state.session;
    if (!session || session.done) return;
    const current = session.phases[session.index];
    const nextIndex = session.phases.findIndex(
      (phase, idx) => idx > session.index && phase.exerciseIdx !== current.exerciseIdx
    );
    if (nextIndex === -1) {
      finishSession();
      return;
    }
    session.index = nextIndex;
    session.remaining = session.phases[nextIndex].duration;
    session.preparing = 0;
    cueFor(session.phases[nextIndex].type);
    startPhaseTimer();
    renderSession();
  };

  const togglePause = () => {
    const session = state.session;
    if (!session || session.done || session.preparing) return;
    session.paused = !session.paused;
    if (session.paused) stopTimer();
    else startPhaseTimer();
    renderSession();
  };

  const rateSession = (felt) => {
    const session = state.session;
    if (!session) return;
    session.felt = felt;
    state.history = [
      {
        date: P.todayISO(),
        day: session.day.day,
        holdSeconds: session.holdSeconds,
        felt,
        durationSec: Math.round(session.elapsed),
      },
      ...state.history,
    ].slice(0, 60);
    persist();
    const recent = state.history.filter((item) => item.felt).slice(0, 3);
    if (recent.length === 3 && recent.every((item) => item.felt === "hard")) {
      toast("Three hard sessions — consider easing the preset");
    } else if (recent.length === 3 && recent.every((item) => item.felt === "easy")) {
      toast("Feeling easy — you can nudge the preset up");
    }
    renderSession();
  };

  const exportProgress = async () => {
    const payload = {
      core: state.core,
      preset: state.preset,
      settings: state.settings,
      history: state.history,
      exportedAt: new Date().toISOString(),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast("Progress copied to clipboard");
    } catch {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "breathe-progress.json";
      link.click();
      URL.revokeObjectURL(url);
      toast("Progress file downloaded");
    }
  };

  const importProgress = () => {
    const raw = prompt("Paste your Breathe backup JSON");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (!data.core || !Array.isArray(data.core.completedDays)) throw new Error("bad");
      state.core = { ...emptyCore(), ...data.core };
      state.preset = data.preset || null;
      state.settings = { ...state.settings, ...(data.settings || {}) };
      state.history = data.history || [];
      persist();
      toast("Progress restored");
      render();
    } catch {
      toast("Could not read that backup");
    }
  };

  const el = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content;
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const icon = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/></svg>',
    program: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 19V9m7 10V5m7 14v-7"/></svg>',
    guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/></svg>',
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.63.83 1.09 1.51 1.09H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  const exerciseStat = (exercise) => {
    if (exercise.type === "quick-flick") return `${exercise.reps} flicks`;
    if (exercise.type === "elevator") return `${exercise.reps}×3 levels`;
    if (exercise.type === "alternating") return `${exercise.reps} alt`;
    return `${exercise.reps}×${exercise.hold}s`;
  };

  const renderToday = (days) => {
    const dayNum = currentDayNumber();
    const day = days[dayNum - 1];
    const doneToday = state.core.lastDate === P.todayISO();
    const completed = state.core.completedDays.includes(day.day);
    const pct = Math.round((state.core.completedDays.length / 42) * 100);
    const missed =
      state.core.lastDate && P.daysBetween(state.core.lastDate, P.todayISO()) > 1 && !doneToday;
    const tip = P.TIPS[(day.day - 1) % P.TIPS.length];
    const allDone = state.core.completedDays.length >= 42;

    return `
      <section class="view wrap stack">
        <div class="hero-row">
          <div>
            <p class="kicker">${escapeHtml(P.greeting())}</p>
            <h1 class="hero-title serif">${allDone ? "Program complete" : doneToday ? "You're done for today" : missed ? "Welcome back" : "Today's session"}</h1>
          </div>
          <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        </div>
        ${missed ? `<div class="card tight"><p class="muted">Streak reset after a gap — pick up Day ${day.day}. Daily 5 minutes still wins.</p></div>` : ""}
        <article class="card today-card">
          <div class="today-head">
            <div>
              <p class="day-num">${day.isRecovery ? "Recovery" : day.challenge} · Day ${day.day}</p>
              <h2 class="serif" style="font-size:26px;margin-top:6px">${escapeHtml(day.focus)}</h2>
            </div>
          </div>
          <div class="meta-row">
            <span class="pill sage">${day.timeEst} min</span>
            <span class="pill">${day.exercises.length} exercises</span>
            ${state.settings.useCustomBaseline && state.preset ? `<span class="pill">Custom baseline</span>` : ""}
            ${completed ? `<span class="pill sage">Completed</span>` : ""}
          </div>
          <p class="benefit">${escapeHtml(day.benefit)}</p>
          <div class="ex-list">
            ${day.exercises
              .map(
                (exercise) => `
              <div class="ex">
                <b>${escapeHtml(exercise.name)}</b>
                <span class="stat">${escapeHtml(exerciseStat(exercise))}</span>
                <p>${escapeHtml(exercise.instruction)}</p>
              </div>`
              )
              .join("")}
          </div>
          <button class="btn btn-primary" data-start="${day.day}">${completed ? "Repeat session" : "Start session"}</button>
        </article>
        <article class="card tight">
          <p class="kicker">Coaching</p>
          <p style="margin-top:8px">${escapeHtml(tip)}</p>
        </article>
        <div class="stats">
          <div class="stat-box"><div class="lbl">Streak</div><div class="val">${state.core.streak}d</div></div>
          <div class="stat-box"><div class="lbl">Sessions</div><div class="val">${state.core.sessions}</div></div>
          <div class="stat-box"><div class="lbl">Left</div><div class="val">${Math.max(0, 42 - state.core.completedDays.length)}</div></div>
        </div>
      </section>
    `;
  };

  const renderProgram = (days) => {
    const current = currentDayNumber();
    return `
      <section class="view wrap stack">
        <div>
          <p class="kicker">42-day plan</p>
          <h1 class="hero-title serif">Program</h1>
        </div>
        ${["FOUNDATIONS", "STAMINA", "CONTROL MASTERY"]
          .map((phase) => {
            const group = days.filter((day) => day.challenge === phase);
            const done = group.filter((day) => state.core.completedDays.includes(day.day)).length;
            const open = state.openPhases[phase];
            return `
              <details class="card phase-card" data-phase="${phase}" ${open ? "open" : ""}>
                <summary>
                  <div>
                    <h3 class="serif" style="font-size:22px">${phase === "CONTROL MASTERY" ? "Control Mastery" : phase[0] + phase.slice(1).toLowerCase()}</h3>
                    <p class="muted">Days ${group[0].day}–${group[group.length - 1].day} · ${done}/${group.length}</p>
                  </div>
                  <div class="bar" style="width:88px"><i style="width:${(done / group.length) * 100}%"></i></div>
                </summary>
                <div class="phase-days">
                  ${group
                    .map((day) => {
                      const isDone = state.core.completedDays.includes(day.day);
                      const isCurrent = day.day === current;
                      const expanded = state.expandedDay === day.day;
                      return `
                        <div class="day-row ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
                          <button class="day-top" data-expand="${day.day}">
                            <div>
                              <strong>Day ${day.day}${day.isRecovery ? " · Recovery" : ""}</strong>
                              <p class="muted">${escapeHtml(day.focus)}</p>
                            </div>
                            <span class="faint">${isDone ? "Done" : day.timeEst + " min"}</span>
                          </button>
                          ${
                            expanded
                              ? `
                            <div class="day-detail">
                              <p class="benefit">${escapeHtml(day.benefit)}</p>
                              ${day.exercises
                                .map(
                                  (exercise) =>
                                    `<div class="ex"><b>${escapeHtml(exercise.name)}</b><span class="stat">${escapeHtml(exerciseStat(exercise))}</span><p>${escapeHtml(exercise.instruction)}</p></div>`
                                )
                                .join("")}
                              <button class="btn btn-primary" data-start="${day.day}">Start day ${day.day}</button>
                            </div>`
                              : ""
                          }
                        </div>`;
                    })
                    .join("")}
                </div>
              </details>`;
          })
          .join("")}
      </section>
    `;
  };

  const renderProgress = (days) => {
    const pct = Math.round((state.core.completedDays.length / 42) * 100);
    const current = currentDayNumber();
    const weeks = P.weeklyStats(state.core.completedDays);
    const avg = state.core.sessions ? Math.round(state.core.totalHold / state.core.sessions) : 0;
    return `
      <section class="view wrap stack">
        <div>
          <p class="kicker">Your work</p>
          <h1 class="hero-title serif">Progress</h1>
        </div>
        <article class="card stack">
          <div class="row-between">
            <div>
              <p class="muted">42-day completion</p>
              <p class="serif" style="font-size:32px">${pct}%</p>
            </div>
            <div class="ring" style="--p:${pct}"><span>${state.core.completedDays.length}/42</span></div>
          </div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="stats">
            <div class="stat-box"><div class="lbl">Sessions</div><div class="val">${state.core.sessions}</div></div>
            <div class="stat-box"><div class="lbl">Hold time</div><div class="val">${Math.round(state.core.totalHold / 60)}m</div></div>
            <div class="stat-box"><div class="lbl">Streak</div><div class="val">${state.core.streak}d</div></div>
            <div class="stat-box"><div class="lbl">Best streak</div><div class="val">${state.core.longestStreak}d</div></div>
            <div class="stat-box"><div class="lbl">Avg hold</div><div class="val">${avg}s</div></div>
            <div class="stat-box"><div class="lbl">Today</div><div class="val">${days[current - 1].day}</div></div>
          </div>
        </article>
        <article class="card">
          <p class="kicker">Calendar</p>
          <div class="grid-42" style="margin-top:12px">
            ${Array.from({ length: 42 }, (_, idx) => {
              const day = idx + 1;
              const done = state.core.completedDays.includes(day);
              return `<button class="cell ${done ? "done" : ""} ${day === current ? "current" : ""}" data-expand="${day}" aria-label="Day ${day}${done ? " complete" : ""}">${day}</button>`;
            }).join("")}
          </div>
        </article>
        <article class="card stack">
          <p class="kicker">Weekly completion</p>
          ${weeks
            .map(
              (week) => `
            <div class="week-row">
              <span>Week ${week.week}</span>
              <div class="bar"><i style="width:${(week.done / week.total) * 100}%"></i></div>
              <span class="faint">${week.done}/${week.total}</span>
            </div>`
            )
            .join("")}
        </article>
        ${
          state.history.length
            ? `<article class="card">
                <p class="kicker">Recent sessions</p>
                <ul class="history">
                  ${state.history
                    .slice(0, 8)
                    .map(
                      (item) =>
                        `<li><span>Day ${item.day} · ${item.date}</span><span class="faint">${item.felt || "—"} · ${item.holdSeconds}s hold</span></li>`
                    )
                    .join("")}
                </ul>
              </article>`
            : ""
        }
      </section>
    `;
  };

  const renderGuide = () => `
    <section class="view wrap stack">
      <article class="card">
        <h1 class="serif" style="font-size:26px">Guide · Discreet Core Control</h1>
        <p class="muted" style="margin-top:8px">Breath-led pelvic floor training for men. No awkward branding, just breath.</p>
      </article>
      ${P.GUIDE.map(
        (item) => `
        <article class="card">
          <h3 class="kicker" style="color:var(--sage)">${escapeHtml(item.t)}</h3>
          <p class="muted" style="margin-top:10px;line-height:1.6">${escapeHtml(item.b)}</p>
        </article>`
      ).join("")}
    </section>
  `;

  const renderOnboarding = () => {
    const slides = [
      {
        title: "Breathe",
        body: "A discreet 42-day program for breath and pelvic-floor control. Five quiet minutes a day. Nothing leaves this device.",
      },
      {
        title: "Exhale to lift",
        body: "Kegels ride the exhale. Reverse work rides the inhale — belly wide, floor drops. Never hold your breath. Effort stays around 60%.",
      },
      {
        title: "Daily beats heroic",
        body: "Foundations, stamina, then control mastery. Recovery days are lighter on purpose. Miss a day? Just start the next one.",
      },
    ];
    const slide = slides[state.onboardStep];
    return `
      <div class="sheet" id="onboard">
        <div class="scrim"></div>
        <div class="panel onboard">
          <div class="dots">${slides.map((_, idx) => `<i class="${idx === state.onboardStep ? "on" : ""}"></i>`).join("")}</div>
          <h2 class="serif">${escapeHtml(slide.title)}</h2>
          <p class="muted" style="font-size:16px;line-height:1.55">${escapeHtml(slide.body)}</p>
          <button class="btn btn-primary" data-onboard-next>${state.onboardStep === slides.length - 1 ? "Start day 1" : "Continue"}</button>
        </div>
      </div>
    `;
  };

  const renderSettings = () => `
    <div class="sheet" id="settings">
      <div class="scrim" data-close="settings"></div>
      <div class="panel">
        <div class="handle"></div>
        <div class="row-between">
          <h3 class="serif" style="font-size:22px">Settings</h3>
          <button class="icon-btn" data-close="settings" aria-label="Close">✕</button>
        </div>
        <div class="stack" style="margin-top:18px">
          ${[
            ["soundOn", "Sound cues", "Soft tones on each phase change"],
            ["hapticsOn", "Haptics", "Vibrate on lift, release, and finish"],
            ["reducedMotion", "Reduce motion", "Skip orb scaling if motion bothers you"],
          ]
            .map(
              ([key, title, sub]) => `
            <div class="row-between card tight">
              <div><p>${title}</p><p class="faint">${sub}</p></div>
              <button class="toggle ${state.settings[key] ? "on" : ""}" data-toggle="${key}" role="switch" aria-checked="${state.settings[key]}"><i></i></button>
            </div>`
            )
            .join("")}
          <button class="btn btn-ghost" data-open-preset>Adjust effort preset</button>
          <button class="btn btn-ghost" data-export>Copy progress backup</button>
          <button class="btn btn-ghost" data-import>Restore from backup</button>
          <button class="btn btn-danger" data-reset>Reset progress</button>
          <p class="faint" style="text-align:center">BREATHE v3 · Discreet · Offline · No data leaves this device</p>
        </div>
      </div>
    </div>
  `;

  const renderPreset = (days) => {
    const draft = state.draftPreset || state.preset || { ...P.DEFAULT_PRESET };
    const recDay = baseProgram[currentDayNumber() - 1];
    const fields = [
      { key: "longHold", label: "Long Hold", min: 3, max: 12, unit: "s" },
      { key: "rest", label: "Rest Between", min: 2, max: 8, unit: "s" },
      { key: "flicks", label: "Quick Flicks Reps", min: 8, max: 30, unit: "" },
      { key: "reverse", label: "Reverse Hold", min: 3, max: 10, unit: "s" },
      { key: "endurance", label: "Endurance Hold", min: 6, max: 15, unit: "s" },
    ];
    return `
      <div class="sheet" id="preset">
        <div class="scrim" data-close="preset"></div>
        <div class="panel">
          <div class="handle"></div>
          <div class="row-between">
            <div>
              <h3 class="serif" style="font-size:22px">Adjust preset</h3>
              <p class="faint">Shifts the whole program, keeps the progression.</p>
            </div>
            <button class="icon-btn" data-close="preset" aria-label="Close">✕</button>
          </div>
          <div class="stack" style="margin-top:16px">
            ${fields
              .map((field) => {
                const rec = P.recommendedValue(recDay, field.key);
                return `
                  <div class="slider-row">
                    <div class="row-between">
                      <div>
                        <p>${field.label}</p>
                        <p class="faint">Rec: ${rec}${field.unit} · ${field.min}–${field.max}${field.unit}</p>
                      </div>
                      <strong>${draft[field.key]}${field.unit}</strong>
                    </div>
                    <div class="stepper">
                      <button data-nudge="${field.key}" data-dir="-1">−</button>
                      <input type="range" min="${field.min}" max="${field.max}" value="${draft[field.key]}" data-slide="${field.key}">
                      <button data-nudge="${field.key}" data-dir="1">+</button>
                    </div>
                  </div>`;
              })
              .join("")}
            <div class="row-between card tight">
              <div>
                <p>Use custom baseline</p>
                <p class="faint">Applies to upcoming days</p>
              </div>
              <button class="toggle ${state.settings.useCustomBaseline ? "on" : ""}" data-toggle="useCustomBaseline" role="switch" aria-checked="${state.settings.useCustomBaseline}"><i></i></button>
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost" data-reset-preset>Recommended</button>
              <button class="btn btn-primary" data-save-preset>Save preset</button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const sessionCue = (type) => {
    if (type === "kegel") return "Lift & Hold";
    if (type === "reverse") return "Drop & Release";
    if (type === "elevator") return "Climb the floors";
    return "Rest & Breathe";
  };

  const renderSession = () => {
    const root = document.getElementById("session-root");
    if (!root || !state.session) return;
    const session = state.session;
    const phase = session.phases[session.index] || session.phases[0];
    const exercise = session.day.exercises[phase.exerciseIdx];
    const left = session.done ? 0 : remainingAfter(session, session.index) - (phase.duration - session.remaining);
    const progress = session.done ? 1 : 1 - session.remaining / phase.duration;
    const preparing = session.preparing > 0;

    root.innerHTML = session.done
      ? `
      <section class="session done">
        <div class="session-top">
          <div>
            <p class="kicker">Day ${session.day.day} complete</p>
            <p>${escapeHtml(session.day.focus)}</p>
          </div>
          <button class="icon-btn" data-end-session aria-label="Close">✕</button>
        </div>
        <div class="session-main">
          <div class="orb-wrap"><div class="orb"></div></div>
          <h2 class="serif" style="font-size:32px">Nice work</h2>
          <p class="muted">${session.holdSeconds}s of hold · ${session.day.exercises.length} exercises · streak ${state.core.streak}d</p>
          <div style="width:min(420px,100%)">
            <p class="kicker" style="margin-bottom:8px">How did that feel?</p>
            <div class="feel">
              <button data-felt="easy" aria-pressed="${session.felt === "easy"}">Easy</button>
              <button data-felt="ok" aria-pressed="${session.felt === "ok"}">Just right</button>
              <button data-felt="hard" aria-pressed="${session.felt === "hard"}">Hard</button>
            </div>
          </div>
        </div>
        <div class="session-foot">
          <button class="btn btn-primary" data-end-session>Back to today</button>
        </div>
      </section>`
      : `
      <section class="session" data-type="${preparing ? "rest" : phase.type}" ${phase.step ? `data-step="${phase.step}"` : ""} ${preparing ? "data-prep" : ""}>
        <div class="session-top">
          <div>
            <p class="kicker">${escapeHtml(exercise?.name || "Session")}</p>
            <p>Rep ${phase.rep} / ${exercise?.reps || 1} · Day ${session.day.day}</p>
          </div>
          <div class="top-actions">
            <button class="icon-btn ${state.settings.soundOn ? "chip" : ""}" data-toggle="soundOn" aria-label="Sound">♫</button>
            <button class="icon-btn" data-end-session aria-label="End session">✕</button>
          </div>
        </div>
        <div class="session-main">
          <p class="muted">${preparing ? "Get settled" : `Exercise ${phase.exerciseIdx + 1} of ${session.day.exercises.length}`}</p>
          <p class="phase-label">${preparing ? "STARTING" : escapeHtml(phase.label)}</p>
          <div class="orb-wrap">
            <div class="orb-ring" style="--p:${Math.round((preparing ? (4 - session.preparing) / 3 : progress) * 100)}"></div>
            <div class="orb"></div>
          </div>
          <div class="count" data-count>${preparing ? session.preparing : Math.ceil(session.remaining)}</div>
          <p class="muted">${preparing ? "Breathe. Soften the jaw." : sessionCue(phase.type)}</p>
          <p class="faint">${session.paused ? "Paused" : P.formatClock(left) + " left"}</p>
        </div>
        <div class="session-foot">
          <div class="bar"><i style="width:${((session.index + (preparing ? 0 : progress)) / session.phases.length) * 100}%"></i></div>
          <div class="btn-row">
            <button class="btn btn-ghost" data-pause ${preparing ? "disabled" : ""}>${session.paused ? "Resume" : "Pause"}</button>
            <button class="btn btn-ghost" data-skip ${preparing ? "disabled" : ""}>Skip exercise</button>
          </div>
        </div>
      </section>`;

    bindSession(root);
  };

  const updateSessionLive = () => {
    const session = state.session;
    if (!session || session.done) return;
    const count = document.querySelector("[data-count]");
    const ring = document.querySelector(".orb-ring");
    const bar = document.querySelector(".session-foot .bar > i");
    const leftLabel = document.querySelector(".session-main .faint");
    const phase = session.phases[session.index];
    if (count) count.textContent = String(Math.ceil(session.remaining));
    if (ring) ring.style.setProperty("--p", String(Math.round((1 - session.remaining / phase.duration) * 100)));
    if (bar) {
      const progress = 1 - session.remaining / phase.duration;
      bar.style.width = `${((session.index + progress) / session.phases.length) * 100}%`;
    }
    if (leftLabel && !session.paused) {
      const left = remainingAfter(session, session.index) - (phase.duration - session.remaining);
      leftLabel.textContent = `${P.formatClock(left)} left`;
    }
  };

  const bindSession = (root) => {
    root.querySelector("[data-end-session]")?.addEventListener("click", endSessionEarly);
    root.querySelector("[data-pause]")?.addEventListener("click", togglePause);
    root.querySelector("[data-skip]")?.addEventListener("click", skipExercise);
    root.querySelectorAll("[data-felt]").forEach((button) => {
      button.addEventListener("click", () => rateSession(button.dataset.felt));
    });
    root.querySelector("[data-toggle='soundOn']")?.addEventListener("click", () => {
      state.settings.soundOn = !state.settings.soundOn;
      persist();
      renderSession();
    });
  };

  const renderChrome = () => {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();
    if (state.toast) {
      const node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      node.textContent = state.toast;
      document.body.appendChild(node);
    }
  };

  const render = () => {
    persist();
    const root = document.getElementById("app");
    const days = program();
    const tabs = [
      ["today", "Today", icon.today],
      ["program", "Program", icon.program],
      ["progress", "Progress", icon.progress],
      ["guide", "Guide", icon.guide],
    ];

    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <div class="mark">B</div>
            <span class="brand-name serif">BREATHE</span>
            <span class="brand-sub">CORE CONTROL & BREATH</span>
          </div>
          <div class="top-actions">
            <div class="chip" title="Streak"><span>🔥</span><strong>${state.core.streak}</strong></div>
            <button class="icon-btn" data-open-settings aria-label="Settings">${icon.gear}</button>
          </div>
        </div>
      </header>
      <main id="view">
        ${
          state.tab === "today"
            ? renderToday(days)
            : state.tab === "program"
              ? renderProgram(days)
              : state.tab === "progress"
                ? renderProgress(days)
                : renderGuide()
        }
      </main>
      <nav class="nav">
        <div class="nav-inner">
          ${tabs
            .map(
              ([id, label, svg]) => `
            <button class="nav-btn ${state.tab === id ? "active" : ""}" data-tab="${id}">
              ${svg}<span>${label}</span>${state.tab === id ? '<span class="dot"></span>' : ""}
            </button>`
            )
            .join("")}
        </div>
      </nav>
      ${!state.settings.onboarded ? renderOnboarding() : ""}
      ${state.settingsOpen ? renderSettings() : ""}
      ${state.presetOpen ? renderPreset(days) : ""}
      <div id="session-root"></div>
    `;

    bindApp(root);
    renderChrome();
    if (state.session) renderSession();
  };

  const bindApp = (root) => {
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.tab = button.dataset.tab;
        render();
      });
    });
    root.querySelector("[data-open-settings]")?.addEventListener("click", () => {
      state.settingsOpen = true;
      render();
    });
    root.querySelectorAll("[data-close]").forEach((node) => {
      node.addEventListener("click", () => {
        if (node.dataset.close === "settings") state.settingsOpen = false;
        if (node.dataset.close === "preset") state.presetOpen = false;
        render();
      });
    });
    root.querySelectorAll("[data-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.toggle;
        state.settings[key] = !state.settings[key];
        persist();
        render();
      });
    });
    root.querySelectorAll("[data-start]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = program()[Number(button.dataset.start) - 1];
        startSession(day);
      });
    });
    root.querySelectorAll("[data-expand]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = Number(button.dataset.expand);
        state.expandedDay = state.expandedDay === day ? null : day;
        const plan = program()[day - 1];
        if (plan) state.openPhases[plan.challenge] = true;
        if (state.tab !== "program") state.tab = "program";
        render();
      });
    });
    root.querySelectorAll("details[data-phase]").forEach((node) => {
      node.addEventListener("toggle", () => {
        state.openPhases[node.dataset.phase] = node.open;
      });
    });
    root.querySelector("[data-onboard-next]")?.addEventListener("click", () => {
      if (state.onboardStep < 2) state.onboardStep += 1;
      else {
        state.settings.onboarded = true;
        persist();
      }
      render();
    });
    root.querySelector("[data-open-preset]")?.addEventListener("click", () => {
      state.draftPreset = { ...(state.preset || P.DEFAULT_PRESET) };
      state.presetOpen = true;
      state.settingsOpen = false;
      render();
    });
    root.querySelectorAll("[data-slide]").forEach((input) => {
      input.addEventListener("input", () => {
        state.draftPreset = state.draftPreset || { ...(state.preset || P.DEFAULT_PRESET) };
        state.draftPreset[input.dataset.slide] = Number(input.value);
        render();
      });
    });
    root.querySelectorAll("[data-nudge]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = button.dataset.nudge;
        const dir = Number(button.dataset.dir);
        const spec = {
          longHold: [3, 12],
          rest: [2, 8],
          flicks: [8, 30],
          reverse: [3, 10],
          endurance: [6, 15],
        }[field];
        state.draftPreset = state.draftPreset || { ...(state.preset || P.DEFAULT_PRESET) };
        state.draftPreset[field] = P.clamp(state.draftPreset[field] + dir, spec[0], spec[1]);
        render();
      });
    });
    root.querySelector("[data-save-preset]")?.addEventListener("click", () => {
      state.preset = { ...(state.draftPreset || P.DEFAULT_PRESET) };
      state.settings.useCustomBaseline = true;
      state.presetOpen = false;
      persist();
      toast("Preset saved — applies to upcoming days");
      render();
    });
    root.querySelector("[data-reset-preset]")?.addEventListener("click", () => {
      state.preset = null;
      state.draftPreset = { ...P.DEFAULT_PRESET };
      state.settings.useCustomBaseline = false;
      state.presetOpen = false;
      persist();
      toast("Reset to recommended");
      render();
    });
    root.querySelector("[data-reset]")?.addEventListener("click", () => {
      if (!confirm("Reset all progress?")) return;
      state.core = emptyCore();
      state.history = [];
      persist();
      toast("Progress reset");
      state.settingsOpen = false;
      render();
    });
    root.querySelector("[data-export]")?.addEventListener("click", exportProgress);
    root.querySelector("[data-import]")?.addEventListener("click", importProgress);
  };

  window.addEventListener("beforeunload", (event) => {
    if (state.session && !state.session.done) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.session && !state.session.done) {
      lockScreen(true);
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  persist();
  render();
})();
