"use client";

import { useEffect, useState } from "react";
import { RAW } from "./questions";
import { TEACHER_PASSWORD, COURSE_NAME } from "./config";

const DURATION = 2 * 60 * 60 * 1000; // 2 hours
const KEY = "bd-quiz-state-v1";
const RESULTS_KEY = "bd-quiz-results-v1"; // saved results - never deleted by the app
const LETTERS = ["A", "B", "C", "D"];

// Deterministic shuffle so option order stays the same after refresh
function seeded(i) {
  let t = ((i + 1) * 2654435761) >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const QUESTIONS = RAW.map(([q, ...opts], i) => {
  const rnd = seeded(i);
  const list = opts.map((text, k) => ({ text, ok: k === 0 }));
  for (let j = list.length - 1; j > 0; j--) {
    const k = Math.floor(rnd() * (j + 1));
    [list[j], list[k]] = [list[k], list[j]];
  }
  return { q, list };
});
const TOTAL = QUESTIONS.length;

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

const readResults = () => {
  try {
    const r = JSON.parse(localStorage.getItem(RESULTS_KEY));
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
};

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;

function ResultsPage() {
  const [pass, setPass] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [server, setServer] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!ok) return;
    const local = readResults();
    setRows(local);
    fetch("/api/results", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setServer(!!d.enabled);
        if (d.enabled) {
          const map = new Map();
          [...local, ...d.results].forEach((r) => map.set(r.id, r));
          setRows([...map.values()]);
        }
      })
      .catch(() => {});
  }, [ok]);

  if (!ok) {
    return (
      <div className="card">
        <h2>Results</h2>
        <p className="muted">Enter the teacher password to view student results.</p>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && (pass === TEACHER_PASSWORD ? setOk(true) : setErr("Wrong password."))}
          />
        </label>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button className="btn" onClick={() => (pass === TEACHER_PASSWORD ? setOk(true) : setErr("Wrong password."))}>
            Open results
          </button>
        </div>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => b.submittedAt - a.submittedAt);
  const shown = sorted.filter((r) => `${r.name} ${r.roll}`.toLowerCase().includes(q.toLowerCase()));

  const download = () => {
    const head = ["Name", "Roll No", "Course", "Correct", "Wrong", "Not answered", "Total", "Percentage", "Date"];
    const lines = [head, ...sorted.map((r) => [
      r.name, r.roll, r.course, r.correct, r.wrong, r.unanswered, r.total, r.pct + "%",
      new Date(r.submittedAt).toLocaleString(),
    ])].map((l) => l.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backend-development-results.csv";
    a.click();
  };

  return (
    <div className="card">
      <h2>Student Results</h2>
      <p className="muted">
        {rows.length} student(s) submitted.{" "}
        {server ? "Saved on the server (all devices)." : "Saved in this browser only."}
      </p>
      <div className="toolbar">
        <input className="search" placeholder="Search by name or roll no" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost small" onClick={download} disabled={!rows.length}>Download CSV</button>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>#</th><th>Name</th><th>Roll No</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>%</th><th>Date</th></tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="muted">No results yet.</td></tr>}
            {shown.map((r, n) => (
              <tr key={r.id}>
                <td>{n + 1}</td><td>{r.name}</td><td>{r.roll}</td>
                <td>{r.correct}</td><td>{r.wrong}</td><td>{r.unanswered}</td>
                <td><b>{r.pct}%</b></td>
                <td>{new Date(r.submittedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [st, setSt] = useState(null); // { startAt, answers, index, done }
  const [left, setLeft] = useState(DURATION);
  const [tab, setTab] = useState("test"); // "test" | "result"
  const [step, setStep] = useState("instructions"); // "instructions" | "register"
  const [form, setForm] = useState({ name: "", roll: "", course: COURSE_NAME });
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && saved.answers && saved.answers.length === TOTAL) setSt(saved);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (st) localStorage.setItem(KEY, JSON.stringify(st));
    else localStorage.removeItem(KEY);
  }, [st, ready]);

  useEffect(() => {
    if (!st) return;
    const tick = () => setLeft(Math.max(0, DURATION - (Date.now() - st.startAt)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [st?.startAt]);

  if (!ready) return null;

  const start = () => {
    const name = form.name.trim();
    const roll = form.roll.trim();
    const course = form.course.trim() || COURSE_NAME;
    if (!name) return setFormErr("Please enter your name.");
    if (!roll) return setFormErr("Please enter your roll number.");
    if (readResults().some((r) => r.roll.toLowerCase() === roll.toLowerCase()))
      return setFormErr("This roll number has already submitted the test.");
    setSt({
      student: { name, roll, course },
      startAt: Date.now(),
      answers: Array(TOTAL).fill(null),
      index: 0,
      done: false,
      record: null,
    });
  };

  const backHome = () => {
    setSt(null);
    setStep("instructions");
    setForm({ name: "", roll: "", course: COURSE_NAME });
    setFormErr("");
    setTab("test");
  };

  const Nav = () => (
    <div className="nav">
      <button className={tab === "test" ? "on" : ""} onClick={() => setTab("test")}>Test</button>
      <button className={tab === "result" ? "on" : ""} onClick={() => setTab("result")}>Result</button>
    </div>
  );

  // ---------- Home (no active test) ----------
  if (!st) {
    if (tab === "result") {
      return (
        <main className="wrap">
          <Nav />
          <ResultsPage />
        </main>
      );
    }

    // Page 1: instructions
    if (step === "instructions") {
      return (
        <main className="wrap">
          <Nav />
          <div className="card">
            <h1>Backend Development</h1>
            <p className="muted">Test Instructions</p>
            <ul className="rules">
              <li>This test has {TOTAL} multiple choice questions.</li>
              <li>Topics: ES6, React.js, Express.js, MongoDB, Firebase, Netlify, Vercel and LinkedIn.</li>
              <li>You have 2 hours to finish the test.</li>
              <li>The timer starts when you press the Start button and keeps running even if you refresh the page.</li>
              <li>Every question has 4 options. Choose only one.</li>
              <li>Once you choose an option, it is locked and cannot be changed.</li>
              <li>You must answer a question before you can go to the next one.</li>
              <li>Do not close or leave the page during the test.</li>
              <li>Your result will be shown to you after the last question.</li>
              <li>Enter your correct name and roll number on the next page.</li>
            </ul>
            <button className="btn" onClick={() => setStep("register")}>Continue</button>
          </div>
        </main>
      );
    }

    // Page 2: student details
    const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setFormErr(""); };
    return (
      <main className="wrap">
        <Nav />
        <div className="card">
          <h1>Student Details</h1>
          <p className="muted">Fill in your details, then press Start.</p>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set("name")} placeholder="Your full name" />
          </label>
          <label className="field">
            <span>Roll No</span>
            <input value={form.roll} onChange={set("roll")} placeholder="e.g. 101" />
          </label>
          <label className="field">
            <span>Course Name</span>
            <input value={form.course} onChange={set("course")} />
          </label>
          {formErr && <div className="error">{formErr}</div>}
          <div className="actions between">
            <button className="btn ghost" onClick={() => setStep("instructions")}>Back</button>
            <button className="btn" onClick={start}>Start</button>
          </div>
        </div>
      </main>
    );
  }

  const timeUp = left === 0;
  const answered = st.answers.filter((a) => a !== null).length;

  // ---------- Result screen ----------
  if (st.done) {
    const r = st.record;
    return (
      <main className="wrap">
        <div className="card result">
          <h2>Your Result</h2>
          <p className="muted">{r.name} &middot; Roll No {r.roll} &middot; {r.course}</p>
          <div className="pct">{r.pct}%</div>
          <div className="stats">
            <div className="stat"><b>{r.correct}</b>Correct</div>
            <div className="stat"><b>{r.wrong}</b>Wrong</div>
            <div className="stat"><b>{r.unanswered}</b>Not answered</div>
          </div>
          <p className="muted">Your result has been saved.</p>
          <button className="btn ghost" onClick={backHome}>Back to home</button>
        </div>
      </main>
    );
  }

  // ---------- Question screen ----------
  const finish = (state) => {
    const ans = state.answers;
    const c = ans.filter((a, n) => a !== null && QUESTIONS[n].list[a].ok).length;
    const got = ans.filter((a) => a !== null).length;
    const record = {
      id: `${state.student.roll}-${state.startAt}`,
      ...state.student,
      correct: c,
      wrong: got - c,
      unanswered: TOTAL - got,
      total: TOTAL,
      pct: Math.round((c / TOTAL) * 1000) / 10,
      submittedAt: Date.now(),
    };
    const all = readResults();
    if (!all.some((x) => x.id === record.id)) {
      localStorage.setItem(RESULTS_KEY, JSON.stringify([...all, record]));
      fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});
    }
    setSt({ ...state, done: true, record });
  };

  const i = st.index;
  const item = QUESTIONS[i];
  const picked = st.answers[i];
  const locked = picked !== null || timeUp;
  const isLast = i === TOTAL - 1;
  const canFinish = timeUp || (isLast && picked !== null);

  const choose = (k) => {
    if (locked) return;
    const answers = [...st.answers];
    answers[i] = k;
    setSt({ ...st, answers });
  };

  return (
    <main className="wrap">
      <div className="topbar">
        <div className="topbar-row">
          <span className="muted">Question {i + 1} of {TOTAL}</span>
          <span className={`timer ${left < 10 * 60 * 1000 ? "low" : ""}`}>{fmt(left)}</span>
        </div>
        <div className="bar"><div style={{ width: `${(answered / TOTAL) * 100}%` }} /></div>
      </div>

      <div className="card">
        {timeUp && <div className="notice">Time is up. Press &quot;See result&quot; to finish.</div>}
        <p className="qtext">{item.q}</p>
        <div className="options">
          {item.list.map((o, k) => (
            <button
              key={k}
              className={`opt ${picked === k ? "picked" : ""}`}
              disabled={locked}
              onClick={() => choose(k)}
            >
              <span className="key">{LETTERS[k]}</span>
              <span>{o.text}</span>
            </button>
          ))}
        </div>

        <div className="actions">
          {canFinish ? (
            <button className="btn" onClick={() => finish(st)}>See result</button>
          ) : (
            <button className="btn" disabled={picked === null} onClick={() => setSt({ ...st, index: i + 1 })}>
              Next question
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
