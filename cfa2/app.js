(function () {
  "use strict";

  // ---------- State ----------
  const KEY = "cfa-daily-v2";
  const blank = { completed: {}, scores: {}, streak: 0, lastDay: null, missed: [], examDate: null };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.assign({}, blank, s, {
        completed: s.completed || {}, scores: s.scores || {}, missed: s.missed || []
      });
    } catch (e) { return Object.assign({}, blank, { completed: {}, scores: {}, missed: [] }); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  let state = load();
  let tab = "today";
  let session = null;

  const $app = document.getElementById("app");

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const dayKey = (d) => (d || new Date()).toLocaleDateString("en-CA");
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const byId = (id) => LESSONS.find((l) => l.id === id);

  function nextLesson() { return LESSONS.find((l) => !state.completed[l.id]) || null; }
  function doneToday() { return state.lastDay === dayKey(); }
  function currentStreak() {
    if (state.lastDay === dayKey() || state.lastDay === yesterdayKey()) return state.streak;
    return 0;
  }
  function daysToExam() {
    if (!state.examDate) return null;
    const ms = new Date(state.examDate + "T00:00:00") - new Date(dayKey() + "T00:00:00");
    return Math.round(ms / 86400000);
  }
  function pill(topicKey) {
    const t = TOPICS[topicKey];
    return '<span class="pill" style="background:' + t.color + '">' + esc(t.name) + "</span>";
  }
  function planLine(left) {
    const d = daysToExam();
    if (d === null) return "Set your exam date in Settings to get a daily pace.";
    if (left === 0) return "Course complete. Use Review and the Course tab to revise.";
    if (d <= 0) return "Your exam date has passed. Update it in Settings.";
    if (d >= left) return left + " lesson" + (left > 1 ? "s" : "") + " left and " + d + " days to go. One a day finishes with " + (d - left) + " spare day" + (d - left === 1 ? "" : "s") + " for revision.";
    return left + " lessons left but only " + d + " days: aim for about " + Math.ceil(left / d) + " lessons a day to finish in time.";
  }

  // ---------- Views ----------
  function viewToday() {
    const done = LESSONS.filter((l) => state.completed[l.id]).length;
    const total = LESSONS.length;
    const pct = Math.round((done / total) * 100);
    const exam = daysToExam();
    const next = nextLesson();

    let html = "<h1>CFA Daily</h1><p class='muted'>One short lesson a day. Level 1.</p>";
    html += '<div class="stats">' +
      '<div class="stat"><b>' + currentStreak() + '</b><span>day streak</span></div>' +
      '<div class="stat"><b>' + done + "/" + total + '</b><span>lessons done</span></div>' +
      '<div class="stat"><b>' + (exam === null ? "-" : exam < 0 ? "Past" : exam) + '</b><span>' + (exam === null ? "set exam date" : "days to exam") + "</span></div></div>";
    html += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    html += '<p class="muted plan" style="margin-top:8px">' + esc(planLine(total - done)) + "</p>";

    if (!next) {
      html += '<div class="card center"><div class="big">🎉</div><h3>You finished every lesson</h3>' +
        '<p class="muted">Use Review to drill missed questions, or reopen any lesson from the Course tab.</p></div>';
    } else if (doneToday()) {
      html += '<div class="card center"><div class="big">✅</div><h3>Today is done</h3>' +
        '<p class="muted">Nice work. Come back tomorrow to keep your streak. Next up: ' + esc(next.title) + ".</p>" +
        '<button class="btn secondary" data-act="start" data-id="' + next.id + '">Do the next lesson anyway</button></div>';
    } else {
      html += '<div class="card"><div class="row"><span class="muted">Today\'s lesson · ' + next.order + " of " + countInTopic(next.topic) + '</span><span class="muted">~' + next.minutes + " min</span></div>" +
        "<h2 style='margin-top:8px'>" + esc(next.title) + "</h2>" + pill(next.topic) +
        "<p class='muted' style='margin-top:10px'>" + esc(next.summary) + "</p>" +
        '<button class="btn" data-act="start" data-id="' + next.id + '">Start lesson</button></div>';
    }

    if (state.missed.length) {
      html += '<div class="card row"><div><h3>' + state.missed.length + " question" + (state.missed.length > 1 ? "s" : "") + " to review</h3>" +
        '<span class="muted">They come back until you get them right.</span></div>' +
        '<button class="btn small" data-act="tab" data-tab="review">Review</button></div>';
    }

    html += "<h2>Course progress</h2>";
    Object.keys(TOPICS).forEach((k) => {
      const ls = LESSONS.filter((l) => l.topic === k);
      if (!ls.length) return;
      const d = ls.filter((l) => state.completed[l.id]).length;
      html += '<div style="margin:10px 0"><div class="row"><span>' + esc(TOPICS[k].name) +
        '</span><span class="muted">' + d + "/" + ls.length + " · exam weight " + esc(TOPICS[k].weight) + "</span></div>" +
        '<div class="bar"><i style="width:' + (d / ls.length) * 100 + '%;background:' + TOPICS[k].color + '"></i></div></div>';
    });
    return html;
  }

  function countInTopic(k) { return LESSONS.filter((l) => l.topic === k).length; }

  function viewLibrary() {
    let html = "<h1>Course</h1><p class='muted'>Tap any lesson to study it again.</p>";
    Object.keys(TOPICS).forEach((k) => {
      const ls = LESSONS.filter((l) => l.topic === k);
      if (!ls.length) return;
      html += "<h2>" + esc(TOPICS[k].name) + '</h2><div class="card" style="padding:4px 16px">';
      ls.forEach((l) => {
        const sc = state.scores[l.id];
        html += '<div class="lesson-item" data-act="start" data-id="' + l.id + '"><div><div><span class="num">' + l.order + ".</span> " + esc(l.title) +
          '</div><span class="muted">~' + l.minutes + " min" + (sc !== undefined ? " · best " + sc + "/" + l.quiz.length : "") + "</span></div>" +
          (state.completed[l.id] ? '<span class="check">✓</span>' : '<span class="muted">›</span>') + "</div>";
      });
      html += "</div>";
    });
    return html;
  }

  function viewReview() {
    if (session && session.mode === "review") return viewQuestion();
    const html = "<h1>Review</h1>";
    if (!state.missed.length) {
      return html + '<div class="card center"><div class="big">🧠</div><h3>Nothing to review</h3>' +
        '<p class="muted">Questions you miss in lessons will show up here.</p></div>';
    }
    return html + "<p class='muted'>" + state.missed.length + " question(s) waiting. Get one right to clear it.</p>" +
      '<button class="btn" data-act="startReview">Start review</button>';
  }

  function viewSettings() {
    return "<h1>Settings</h1>" +
      '<div class="card"><h3>Exam date</h3><p class="muted">Used for the countdown and daily pace on the Today screen.</p>' +
      '<input type="date" id="examDate" value="' + esc(state.examDate || "") + '"></div>' +
      '<div class="card"><h3>Install on your phone</h3><p class="muted">iPhone: Share → Add to Home Screen. ' +
      "Android/Chrome: menu → Install app. It then works offline like a normal app.</p></div>" +
      '<div class="card"><h3>Reset progress</h3><p class="muted">Clears streak, completed lessons and review queue on this device.</p>' +
      '<button class="btn secondary" data-act="reset">Reset everything</button></div>' +
      '<p class="muted">CFA Daily is an independent study aid and is not affiliated with CFA Institute. ' +
      "Lessons are written in original wording as a companion to, not a replacement for, the official curriculum. Check formulas and rules against it.</p>";
  }

  // ---------- Lesson session ----------
  // phases: read -> practice -> quiz -> done
  function startLesson(id) {
    const lesson = byId(id);
    if (!lesson) return;
    session = { mode: "lesson", lesson: lesson, phase: "read", qi: 0, correct: 0, answered: null, showSol: false, finished: false };
    tab = "today";
    render();
    window.scrollTo(0, 0);
  }

  function startReview() {
    session = { mode: "review", queue: state.missed.slice(), idx: 0, answered: null };
    render();
  }

  function stepBar(n) {
    return '<div class="steps">' + [0, 1, 2].map((i) => '<i class="' + (i <= n ? "on" : "") + '"></i>').join("") + "</div>";
  }

  function viewLesson() {
    const L = session.lesson;
    const topBar = '<button class="btn small secondary" data-act="exit">← Back</button>';

    if (session.phase === "read") {
      let html = topBar + stepBar(0) + pill(L.topic) +
        "<h1 style='margin-top:8px'>" + esc(L.title) + "</h1>" +
        "<p class='muted'>Lesson " + L.order + " · ~" + L.minutes + " min</p>" +
        '<p class="lead">' + rich(L.summary) + "</p>" +
        '<div class="goal"><b>By the end you can</b>' + rich(L.objective) + "</div>";
      L.sections.forEach((s) => {
        html += '<div class="card sec"><h3>' + esc(s.heading) + "</h3>" +
          s.body.map((p) => "<p>" + rich(p) + "</p>").join("") +
          (s.bullets && s.bullets.length ? '<ul class="points">' + s.bullets.map((b) => "<li>" + rich(b) + "</li>").join("") + "</ul>" : "") +
          "</div>";
      });
      if (L.formulas && L.formulas.length) {
        html += '<div class="card"><h3>Key formulas</h3>' + L.formulas.map((f) => '<div class="formula">' + esc(f) + "</div>").join("") + "</div>";
      }
      html += '<button class="btn" data-act="toPractice">' + (L.example ? "Worked example & recap →" : "Recap →") + "</button>";
      return html;
    }

    if (session.phase === "practice") {
      let html = topBar + stepBar(1) + "<h1>" + esc(L.title) + "</h1>";
      if (L.example) {
        html += '<div class="card"><h3>Worked example: ' + esc(L.example.title) + "</h3>" +
          "<p>" + rich(L.example.problem) + "</p>" +
          (session.showSol
            ? '<div class="sol"><b>Solution</b><p style="margin:6px 0 0">' + rich(L.example.solution) + "</p></div>"
            : '<p class="muted" style="margin-bottom:10px">Try it yourself first, then check.</p><button class="btn secondary" data-act="showSol">Show solution</button>') +
          "</div>";
      }
      html += '<div class="card warn"><h3>Common exam traps</h3><ul class="points">' + L.mistakes.map((m) => "<li>" + rich(m) + "</li>").join("") + "</ul></div>" +
        '<div class="card"><h3>Recap</h3><ul class="points">' + L.recap.map((m) => "<li>" + rich(m) + "</li>").join("") + "</ul></div>" +
        '<button class="btn" data-act="toQuiz">Take the quiz (' + L.quiz.length + " questions) →</button>";
      return html;
    }

    if (session.phase === "quiz") return viewQuestion();

    // done
    const total = L.quiz.length;
    const nxt = nextLesson();
    return stepBar(2) + '<div class="card center"><div class="big">' + (session.correct === total ? "🌟" : "👍") + "</div>" +
      "<h2 style='margin-top:0'>Lesson complete</h2><p>You got <b>" + session.correct + " of " + total + "</b> right.</p>" +
      '<p class="muted">' + (currentStreak() > 0 ? "🔥 " + currentStreak() + "-day streak" : "") + "</p>" +
      (state.missed.some((m) => m.lessonId === L.id) ? '<p class="muted">Missed questions were added to your Review queue.</p>' : "") + "</div>" +
      '<button class="btn" data-act="exit">Done</button>' +
      (nxt && nxt.id !== L.id ? '<div class="gap"></div><button class="btn secondary" data-act="start" data-id="' + nxt.id + '">Next: ' + esc(nxt.title) + "</button>" : "");
  }

  function currentQuestion() {
    if (session.mode === "review") {
      const m = session.queue[session.idx];
      if (!m) return null;
      const l = byId(m.lessonId);
      return l && l.quiz[m.qi] ? { q: l.quiz[m.qi], lesson: l, qi: m.qi } : null;
    }
    return { q: session.lesson.quiz[session.qi], lesson: session.lesson, qi: session.qi };
  }

  function viewQuestion() {
    const cur = currentQuestion();
    if (!cur) {
      session = null;
      return "<h1>Review</h1><div class='card center'><div class='big'>🎯</div><h3>Review finished</h3>" +
        "<p class='muted'>" + state.missed.length + " question(s) still in the queue.</p></div>";
    }
    const q = cur.q;
    const a = session.answered;
    let html = '<button class="btn small secondary" data-act="exit">← Back</button>';
    if (session.mode === "lesson") {
      html += stepBar(2) + "<p class='muted'>Question " + (session.qi + 1) + " of " + cur.lesson.quiz.length + "</p>";
    } else {
      html += "<p class='muted' style='margin-top:12px'>Review " + (session.idx + 1) + " of " + session.queue.length + " · " + esc(cur.lesson.title) + "</p>";
    }
    html += "<h2 style='margin-top:6px'>" + rich(q.q) + "</h2>";
    q.options.forEach((o, i) => {
      let cls = "opt";
      if (a !== null) { if (i === q.answer) cls += " good"; else if (i === a) cls += " bad"; }
      html += '<button class="' + cls + '" data-act="answer" data-i="' + i + '"' + (a !== null ? " disabled" : "") + ">" + esc(o) + "</button>";
    });
    if (a !== null) {
      html += '<div class="why"><b>' + (a === q.answer ? "Correct." : "Not quite.") + "</b> " + rich(q.why) + "</div>" +
        '<div style="margin-top:14px"><button class="btn" data-act="next">Next →</button></div>';
    }
    return html;
  }

  function answer(i) {
    if (!session || session.answered !== null) return;
    session.answered = i;
    const cur = currentQuestion();
    const right = i === cur.q.answer;
    const idx = state.missed.findIndex((m) => m.lessonId === cur.lesson.id && m.qi === cur.qi);
    if (right) {
      if (session.mode === "lesson") session.correct++;
      if (idx >= 0) state.missed.splice(idx, 1);
    } else if (idx < 0) {
      state.missed.push({ lessonId: cur.lesson.id, qi: cur.qi });
    }
    save();
    render();
  }

  function next() {
    session.answered = null;
    if (session.mode === "review") { session.idx++; render(); return; }
    session.qi++;
    if (session.qi >= session.lesson.quiz.length) {
      completeLesson();
      session.phase = "done";
    }
    render();
    window.scrollTo(0, 0);
  }

  function completeLesson() {
    const L = session.lesson;
    const today = dayKey();
    state.scores[L.id] = Math.max(state.scores[L.id] || 0, session.correct);
    if (!state.completed[L.id]) state.completed[L.id] = today;
    if (state.lastDay !== today) {
      state.streak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1;
      state.lastDay = today;
    }
    save();
  }

  // ---------- Render & events ----------
  function render() {
    let html;
    if (session && session.mode === "lesson") html = viewLesson();
    else if (tab === "today") html = viewToday();
    else if (tab === "library") html = viewLibrary();
    else if (tab === "review") html = viewReview();
    else html = viewSettings();
    $app.innerHTML = html;
    const inLesson = !!(session && session.mode === "lesson");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab && !inLesson));
    const d = document.getElementById("examDate");
    if (d) d.addEventListener("change", () => { state.examDate = d.value || null; save(); });
  }

  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("#tabs button");
    if (tabBtn) { session = null; tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "start") startLesson(el.dataset.id);
    else if (act === "toPractice") { session.phase = "practice"; session.showSol = false; render(); window.scrollTo(0, 0); }
    else if (act === "showSol") { session.showSol = true; render(); }
    else if (act === "toQuiz") { session.phase = "quiz"; session.qi = 0; session.correct = 0; session.answered = null; render(); window.scrollTo(0, 0); }
    else if (act === "answer") answer(parseInt(el.dataset.i, 10));
    else if (act === "next") next();
    else if (act === "exit") { session = null; render(); window.scrollTo(0, 0); }
    else if (act === "tab") { session = null; tab = el.dataset.tab; render(); }
    else if (act === "startReview") startReview();
    else if (act === "reset") {
      if (confirm("Erase all progress on this device?")) { state = Object.assign({}, blank, { completed: {}, scores: {}, missed: [] }); save(); render(); }
    }
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
