const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "scheduler.db"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
db.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS activities (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'Personal',
 date TEXT,
 start_time TEXT NOT NULL,
 end_time TEXT NOT NULL,
 priority INTEGER NOT NULL DEFAULT 4,
 recurring TEXT NOT NULL DEFAULT 'none',
 days TEXT NOT NULL DEFAULT '[]',
 flexible INTEGER NOT NULL DEFAULT 1,
 notes TEXT DEFAULT '',
 completed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT
);
CREATE TABLE IF NOT EXISTS completions (
 activity_id INTEGER NOT NULL,
 date TEXT NOT NULL,
 PRIMARY KEY (activity_id, date)
);
CREATE TABLE IF NOT EXISTS subtasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 activity_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 done INTEGER NOT NULL DEFAULT 0,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migration safety net: older copies of this DB may not have the `days`
// column yet (used by the "custom" recurring type below).
try { db.exec("ALTER TABLE activities ADD COLUMN days TEXT NOT NULL DEFAULT '[]'"); } catch (e) { /* already exists */ }

// ---------------------------------------------------------------------------
// Seed data — this is a versioned reset. Bumping SEED_VERSION replaces
// whatever is in the table with the corrected weekly template below, so a
// database created by an earlier (buggy) build of this app gets fixed too.
// ---------------------------------------------------------------------------
const SEED_VERSION = "4";
const seededVersion = db.prepare("SELECT value FROM settings WHERE key='seed_version'").get();

if (!seededVersion || seededVersion.value !== SEED_VERSION) {
  const wipe = db.prepare("DELETE FROM activities");
  const setVer = db.prepare("INSERT INTO settings(key,value) VALUES('seed_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const add = db.prepare(`INSERT INTO activities
   (title,category,date,start_time,end_time,priority,recurring,days,flexible,notes)
   VALUES (?,?,?,?,?,?,?,?,?,?)`);

  const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;
  const D = a => JSON.stringify(a);

  const tx = db.transaction(() => {
    wipe.run();
    [
      // ==================== SENIN — Data Warehouse ========================
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([MON]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:40", 1, "custom", D([MON]), 0, ""],
      ["Mandi + sarapan", "Rest", null, "05:40", "06:30", 5, "custom", D([MON]), 1, ""],
      ["Persiapan/perjalanan", "Rest", null, "06:30", "07:30", 5, "custom", D([MON]), 1, ""],
      ["KP", "KP", null, "07:40", "10:20", 2, "custom", D([MON]), 0, "KP pagi (sebelum Data Warehouse)"],
      ["Data Warehouse", "Academic", null, "10:21", "12:00", 1, "custom", D([MON]), 0, "Kuliah"],
      ["ISHOMA + makan", "Rest", null, "12:00", "13:00", 1, "custom", D([MON]), 0, "Istirahat, sholat, makan"],
      ["KP", "KP", null, "13:00", "16:40", 2, "custom", D([MON]), 0, "KP siang"],
      ["Pulang + istirahat", "Rest", null, "16:40", "17:30", 5, "custom", D([MON]), 1, ""],
      ["Ashar", "Worship", null, "17:30", "18:00", 1, "custom", D([MON]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([MON]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([MON]), 0, ""],
      ["Review Data Warehouse", "Academic", null, "19:45", "20:45", 2, "custom", D([MON]), 0, ""],
      ["Santai + persiapan besok", "Rest", null, "20:45", "22:00", 5, "custom", D([MON]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([MON]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([MON]), 1, ""],

      // ==================== SELASA — Metodologi + Python ==================
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([TUE]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:40", 1, "custom", D([TUE]), 0, ""],
      ["Mandi + sarapan", "Rest", null, "05:40", "06:30", 5, "custom", D([TUE]), 1, ""],
      ["Persiapan/perjalanan", "Rest", null, "06:30", "07:30", 5, "custom", D([TUE]), 1, ""],
      ["KP", "KP", null, "07:40", "12:00", 2, "custom", D([TUE]), 0, "KP pagi"],
      ["ISHOMA + makan", "Rest", null, "12:00", "13:00", 1, "custom", D([TUE]), 0, "Istirahat, sholat, makan"],
      ["Metodologi Penelitian", "Academic", null, "13:00", "14:40", 1, "custom", D([TUE]), 0, "Kuliah"],
      ["KP", "KP", null, "14:40", "16:40", 2, "custom", D([TUE]), 0, "KP sore"],
      ["Pulang + istirahat", "Rest", null, "16:40", "17:30", 5, "custom", D([TUE]), 1, ""],
      ["Ashar", "Worship", null, "17:30", "18:00", 1, "custom", D([TUE]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([TUE]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([TUE]), 0, ""],
      ["Python / Pandas", "Data Analyst", null, "19:45", "21:00", 3, "custom", D([TUE]), 1, ""],
      ["Tugas/review ringan", "Personal", null, "21:00", "22:00", 4, "custom", D([TUE]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([TUE]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([TUE]), 1, ""],

      // ==================== RABU — Intensif Bahasa Inggris ================
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([WED]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:35", 1, "custom", D([WED]), 0, ""],
      ["Mandi + sarapan", "Rest", null, "05:35", "06:20", 5, "custom", D([WED]), 1, ""],
      ["Persiapan/perjalanan", "Rest", null, "06:20", "07:30", 5, "custom", D([WED]), 1, ""],
      ["KP", "KP", null, "07:40", "08:35", 2, "custom", D([WED]), 0, "KP pagi"],
      ["Intensif Bahasa Inggris", "English", null, "08:40", "10:20", 1, "custom", D([WED]), 0, "Kuliah"],
      ["KP", "KP", null, "10:20", "12:00", 2, "custom", D([WED]), 0, "KP siang"],
      ["ISHOMA + makan", "Rest", null, "12:00", "13:00", 1, "custom", D([WED]), 0, "Istirahat, sholat, makan"],
      ["KP", "KP", null, "13:00", "16:40", 2, "custom", D([WED]), 0, "KP sore"],
      ["Pulang + istirahat", "Rest", null, "16:40", "17:30", 5, "custom", D([WED]), 1, ""],
      ["Ashar", "Worship", null, "17:30", "18:00", 1, "custom", D([WED]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([WED]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([WED]), 0, ""],
      ["English practice", "English", null, "19:45", "20:45", 2, "custom", D([WED]), 1, ""],
      ["Santai/review ringan", "Rest", null, "20:45", "22:00", 5, "custom", D([WED]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([WED]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([WED]), 1, ""],

      // ==================== KAMIS — Pemodelan Data =========================
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([THU]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:40", 1, "custom", D([THU]), 0, ""],
      ["Mandi + sarapan", "Rest", null, "05:40", "06:30", 5, "custom", D([THU]), 1, ""],
      ["Persiapan/perjalanan", "Rest", null, "06:30", "07:30", 5, "custom", D([THU]), 1, ""],
      ["KP", "KP", null, "07:40", "08:40", 2, "custom", D([THU]), 0, "KP pagi"],
      ["Pemodelan Data", "Academic", null, "08:41", "12:00", 1, "custom", D([THU]), 0, "Kuliah"],
      ["ISHOMA + makan", "Rest", null, "12:00", "13:00", 1, "custom", D([THU]), 0, "Istirahat, sholat, makan"],
      ["KP", "KP", null, "13:00", "16:40", 2, "custom", D([THU]), 0, "KP sore"],
      ["Pulang + istirahat", "Rest", null, "16:40", "17:30", 5, "custom", D([THU]), 1, ""],
      ["Ashar", "Worship", null, "17:30", "18:00", 1, "custom", D([THU]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([THU]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([THU]), 0, ""],
      ["Review Pemodelan Data", "Academic", null, "19:45", "20:45", 2, "custom", D([THU]), 0, ""],
      ["Santai", "Rest", null, "20:45", "22:00", 5, "custom", D([THU]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([THU]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([THU]), 1, ""],

      // ==================== JUMAT — KP + Manajemen Proyek + Bootcamp ======
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([FRI]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:40", 1, "custom", D([FRI]), 0, ""],
      ["Mandi + sarapan", "Rest", null, "05:40", "06:30", 5, "custom", D([FRI]), 1, ""],
      ["Persiapan/perjalanan", "Rest", null, "06:30", "07:30", 5, "custom", D([FRI]), 1, ""],
      ["KP", "KP", null, "07:40", "12:00", 2, "custom", D([FRI]), 0, "KP pagi"],
      ["ISHOMA + makan", "Rest", null, "12:00", "13:00", 1, "custom", D([FRI]), 0, "Istirahat, sholat, makan"],
      ["Manajemen Proyek", "Academic", null, "13:30", "16:40", 1, "custom", D([FRI]), 0, "Kuliah"],
      ["Pulang", "Rest", null, "16:40", "17:30", 5, "custom", D([FRI]), 1, ""],
      ["Ashar", "Worship", null, "17:30", "18:00", 1, "custom", D([FRI]), 0, ""],
      ["Maghrib + persiapan bootcamp", "Rest", null, "18:00", "19:00", 2, "custom", D([FRI]), 0, ""],
      ["Bootcamp", "Bootcamp", null, "19:00", "21:00", 2, "custom", D([FRI]), 0, "Malam"],
      ["Isya", "Worship", null, "21:00", "21:30", 1, "custom", D([FRI]), 0, "Setelah Bootcamp"],
      ["Makan + santai", "Rest", null, "21:30", "22:15", 5, "custom", D([FRI]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:15", "22:30", 5, "custom", D([FRI]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([FRI]), 1, ""],

      // ==================== SABTU — Bootcamp + Data Analyst ================
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([SAT]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:45", 1, "custom", D([SAT]), 0, ""],
      ["Sarapan", "Rest", null, "05:45", "06:30", 5, "custom", D([SAT]), 1, ""],
      ["Deep Work Data Analyst", "Data Analyst", null, "06:30", "08:00", 3, "custom", D([SAT]), 1, "Python → Pandas → SQL → Project (rotasi tiap minggu)"],
      ["Bootcamp", "Bootcamp", null, "09:00", "11:00", 2, "custom", D([SAT]), 0, "Weekend"],
      ["Istirahat", "Rest", null, "11:00", "12:00", 5, "custom", D([SAT]), 1, ""],
      ["Dzuhur + makan", "Worship", null, "12:00", "13:00", 1, "custom", D([SAT]), 0, ""],
      ["Tidur siang", "Rest", null, "13:00", "14:30", 5, "custom", D([SAT]), 1, ""],
      ["Project Data Analyst", "Data Analyst", null, "14:30", "16:00", 3, "custom", D([SAT]), 1, ""],
      ["Olahraga/jalan santai", "Health", null, "16:00", "17:00", 3, "custom", D([SAT]), 1, ""],
      ["Ashar + mandi", "Worship", null, "17:00", "18:00", 1, "custom", D([SAT]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([SAT]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([SAT]), 0, ""],
      ["Review materi", "Personal", null, "19:45", "20:45", 4, "custom", D([SAT]), 1, ""],
      ["Free time", "Rest", null, "20:45", "22:00", 5, "custom", D([SAT]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([SAT]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([SAT]), 1, ""],

      // ==================== MINGGU — Bootcamp + Project + Recovery ========
      ["Subuh", "Worship", null, "04:45", "05:15", 1, "custom", D([SUN]), 0, ""],
      ["Qur'an", "Worship", null, "05:15", "05:45", 1, "custom", D([SUN]), 0, ""],
      ["Sarapan + santai", "Rest", null, "05:45", "07:30", 5, "custom", D([SUN]), 1, ""],
      ["Persiapan Bootcamp", "Rest", null, "07:30", "08:30", 5, "custom", D([SUN]), 1, ""],
      ["Bootcamp", "Bootcamp", null, "09:00", "11:00", 2, "custom", D([SUN]), 0, "Weekend"],
      ["Istirahat", "Rest", null, "11:00", "12:00", 5, "custom", D([SUN]), 1, ""],
      ["Dzuhur + makan", "Worship", null, "12:00", "13:00", 1, "custom", D([SUN]), 0, ""],
      ["Tidur siang", "Rest", null, "13:00", "14:30", 5, "custom", D([SUN]), 1, ""],
      ["Project Data Analyst / SQL / Pandas", "Data Analyst", null, "14:30", "16:00", 3, "custom", D([SUN]), 1, ""],
      ["Olahraga/jalan santai", "Health", null, "16:00", "17:00", 3, "custom", D([SUN]), 1, ""],
      ["Ashar + mandi", "Worship", null, "17:00", "18:00", 1, "custom", D([SUN]), 0, ""],
      ["Maghrib + Qur'an", "Worship", null, "18:00", "19:00", 1, "custom", D([SUN]), 0, ""],
      ["Isya", "Worship", null, "19:00", "19:45", 1, "custom", D([SUN]), 0, ""],
      ["Weekly Review", "Personal", null, "19:45", "20:30", 4, "custom", D([SUN]), 1, ""],
      ["Planning minggu depan", "Personal", null, "20:30", "21:00", 4, "custom", D([SUN]), 1, ""],
      ["Free time", "Rest", null, "21:00", "22:00", 5, "custom", D([SUN]), 1, ""],
      ["Persiapan tidur", "Rest", null, "22:00", "22:30", 5, "custom", D([SUN]), 1, ""],
      ["Tidur", "Rest", null, "22:30", "23:59", 5, "custom", D([SUN]), 1, ""]
    ].forEach(x => add.run(...x));
    setVer.run(SEED_VERSION);
  });
  tx();
}

// ---------------------------------------------------------------------------
// Date / time helpers
// ---------------------------------------------------------------------------
// NOTE: earlier versions of this file called `iso(d)` with `d` already a
// Date object AND concatenated it with a string, which crashed the whole
// request (and therefore left Calendar / Dashboard blank) the moment any
// one-off ("Sekali") activity existed. toISO() below only ever accepts a
// Date object; parseISO() only ever accepts a "YYYY-MM-DD" string. Keeping
// those separate is what was actually broken before.
function toISO(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function parseISO(s) { return new Date(s + "T00:00:00"); }

function occursOn(a, d) {
  const wd = d.getDay();
  const base = a.date ? parseISO(a.date) : null;
  let days = [];
  try { days = JSON.parse(a.days || "[]"); } catch (e) { days = []; }
  return (
    (a.recurring === "daily") ||
    (a.recurring === "weekdays" && wd >= 1 && wd <= 5) ||
    (a.recurring === "weekend" && (wd === 0 || wd === 6)) ||
    (a.recurring === "weekly" && base && wd === base.getDay()) ||
    (a.recurring === "custom" && days.includes(wd)) ||
    (a.recurring === "none" && a.date === toISO(d))
  );
}

function expand(a, from, to) {
  const out = [];
  const d = parseISO(from), end = parseISO(to);
  while (d <= end) {
    if (occursOn(a, d)) out.push({ ...a, occurrence_date: toISO(d) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function mins(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function hhmm(n) { n = Math.max(0, Math.min(1439, n)); return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); }
function overlaps(a, b) { return mins(a.start_time) < mins(b.end_time) && mins(b.start_time) < mins(a.end_time); }

function generateDay(rows, date) {
  const doneSet = new Set(db.prepare("SELECT activity_id FROM completions WHERE date=?").all(date).map(r => r.activity_id));
  const items = rows.flatMap(a => expand(a, date, date)).map(x => ({ ...x, date: x.occurrence_date, completed: doneSet.has(x.id) ? 1 : 0 }));
  items.sort((a, b) => a.priority - b.priority || mins(a.start_time) - mins(b.start_time));
  const accepted = [], conflicts = [];
  for (const item of items) {
    const hit = accepted.filter(x => overlaps(item, x));
    if (!hit.length) { accepted.push(item); continue; }
    const stronger = hit.filter(x => x.priority <= item.priority);
    if (item.flexible && stronger.length) {
      let duration = mins(item.end_time) - mins(item.start_time), placed = null;
      const anchors = accepted.filter(x => x.priority <= item.priority).sort((a, b) => mins(a.end_time) - mins(b.end_time));
      let cursor = mins(item.start_time);
      for (const a of anchors) {
        if (cursor + duration <= mins(a.start_time)) { placed = { s: cursor, e: cursor + duration }; break; }
        cursor = Math.max(cursor, mins(a.end_time));
      }
      if (!placed && cursor + duration <= 1439) placed = { s: cursor, e: cursor + duration };
      if (placed) {
        item.original_start = item.start_time; item.original_end = item.end_time;
        item.start_time = hhmm(placed.s); item.end_time = hhmm(placed.e); item.auto_moved = true;
        accepted.push(item); continue;
      }
    }
    conflicts.push({ ...item, conflicts_with: hit.map(x => x.title) });
  }
  accepted.sort((a, b) => mins(a.start_time) - mins(b.start_time));
  return { items: accepted, conflicts };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
// Attaches subtask_total / subtask_done to a list of activity rows in one
// query, so list views (Dashboard/Calendar/My Schedule) can show a progress
// badge without an extra request per activity.
function withSubtaskCounts(rows) {
  const counts = db.prepare(
    "SELECT activity_id, COUNT(*) AS total, SUM(done) AS done FROM subtasks GROUP BY activity_id"
  ).all();
  const map = new Map(counts.map(c => [c.activity_id, { total: c.total, done: c.done || 0 }]));
  return rows.map(r => {
    const c = map.get(r.id);
    return { ...r, subtask_total: c ? c.total : 0, subtask_done: c ? c.done : 0 };
  });
}

app.get("/api/activities", (req, res) => {
  let rows = db.prepare("SELECT * FROM activities ORDER BY start_time,id").all();
  rows = withSubtaskCounts(rows);
  if (req.query.from && req.query.to) {
    rows = rows.flatMap(a => expand(a, req.query.from, req.query.to));
    const done = new Set(
      db.prepare("SELECT activity_id, date FROM completions WHERE date BETWEEN ? AND ?")
        .all(req.query.from, req.query.to)
        .map(r => r.activity_id + "|" + r.date)
    );
    rows = rows.map(x => ({ ...x, completed: done.has(x.id + "|" + x.occurrence_date) ? 1 : 0 }));
  }
  res.json(rows);
});

app.post("/api/activities", (req, res) => {
  const x = req.body;
  if (!x.title || !x.start_time || !x.end_time) return res.status(400).json({ error: "Judul, mulai, dan selesai wajib diisi." });
  if (mins(x.end_time) <= mins(x.start_time)) return res.status(400).json({ error: "Jam selesai harus setelah jam mulai." });
  const r = db.prepare(`INSERT INTO activities(title,category,date,start_time,end_time,priority,recurring,days,flexible,notes)
   VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    x.title, x.category || "Personal", x.date || null, x.start_time, x.end_time,
    +x.priority || 4, x.recurring || "none", JSON.stringify(x.days || []), x.flexible ? 1 : 0, x.notes || ""
  );
  res.json(db.prepare("SELECT * FROM activities WHERE id=?").get(r.lastInsertRowid));
});

app.put("/api/activities/:id", (req, res) => {
  const x = req.body;
  if (mins(x.end_time) <= mins(x.start_time)) return res.status(400).json({ error: "Jam selesai harus setelah jam mulai." });
  db.prepare(`UPDATE activities SET title=?,category=?,date=?,start_time=?,end_time=?,priority=?,recurring=?,days=?,flexible=?,notes=?,completed=? WHERE id=?`)
    .run(x.title, x.category, x.date || null, x.start_time, x.end_time, +x.priority || 4, x.recurring || "none",
      JSON.stringify(x.days || []), x.flexible ? 1 : 0, x.notes || "", x.completed ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/activities/:id", (req, res) => {
  db.prepare("DELETE FROM subtasks WHERE activity_id=?").run(req.params.id);
  db.prepare("DELETE FROM activities WHERE id=?").run(req.params.id); res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Subtasks — a simple checklist attached to one activity. Shared across all
// occurrences of a recurring activity (same as notes), not per-occurrence.
// ---------------------------------------------------------------------------
app.get("/api/activities/:id/subtasks", (req, res) => {
  const rows = db.prepare("SELECT * FROM subtasks WHERE activity_id=? ORDER BY sort_order,id").all(req.params.id);
  res.json(rows);
});

app.post("/api/activities/:id/subtasks", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Judul subtugas wajib diisi." });
  const activityId = +req.params.id;
  const exists = db.prepare("SELECT 1 FROM activities WHERE id=?").get(activityId);
  if (!exists) return res.status(404).json({ error: "Aktivitas tidak ditemukan." });
  const next = db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM subtasks WHERE activity_id=?").get(activityId).n;
  const r = db.prepare("INSERT INTO subtasks(activity_id,title,sort_order) VALUES(?,?,?)").run(activityId, title, next);
  res.json(db.prepare("SELECT * FROM subtasks WHERE id=?").get(r.lastInsertRowid));
});

app.put("/api/subtasks/:id", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Judul subtugas wajib diisi." });
  db.prepare("UPDATE subtasks SET title=? WHERE id=?").run(title, req.params.id);
  res.json({ ok: true });
});

app.patch("/api/subtasks/:id/toggle", (req, res) => {
  const row = db.prepare("SELECT done FROM subtasks WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Subtugas tidak ditemukan." });
  db.prepare("UPDATE subtasks SET done=? WHERE id=?").run(row.done ? 0 : 1, req.params.id);
  res.json({ ok: true, done: !row.done });
});

app.delete("/api/subtasks/:id", (req, res) => {
  db.prepare("DELETE FROM subtasks WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
app.patch("/api/activities/:id/toggle", (req, res) => {
  const date = req.query.date || (req.body && req.body.date);
  if (!date) return res.status(400).json({ error: "Tanggal wajib diisi untuk menandai selesai." });
  const activityId = +req.params.id;
  const exists = db.prepare("SELECT 1 FROM completions WHERE activity_id=? AND date=?").get(activityId, date);
  if (exists) db.prepare("DELETE FROM completions WHERE activity_id=? AND date=?").run(activityId, date);
  else db.prepare("INSERT INTO completions(activity_id,date) VALUES(?,?)").run(activityId, date);
  res.json({ ok: true, completed: !exists });
});

app.get("/api/schedule", (req, res) => {
  const date = req.query.date || toISO(new Date());
  const rows = withSubtaskCounts(db.prepare("SELECT * FROM activities").all());
  res.json({ date, ...generateDay(rows, date) });
});

app.post("/api/auto-schedule", (req, res) => {
  const date = req.body.date || toISO(new Date());
  const rows = withSubtaskCounts(db.prepare("SELECT * FROM activities").all());
  const result = generateDay(rows, date);
  res.json(result);
});

app.get("/api/stats", (req, res) => {
  const date = req.query.date || toISO(new Date());
  const rows = db.prepare("SELECT * FROM activities").all().flatMap(a => expand(a, date, date));
  const doneSet = new Set(db.prepare("SELECT activity_id FROM completions WHERE date=?").all(date).map(r => r.activity_id));
  const total = rows.length, done = rows.filter(x => doneSet.has(x.id)).length;
  const by = {}; rows.forEach(x => by[x.category] = (by[x.category] || 0) + 1);
  res.json({ total, done, pct: total ? Math.round(done / total * 100) : 0, by });
});

// ---------------------------------------------------------------------------
// Habit streaks — only counts categories that represent personal habits
// (ibadah, olahraga, belajar mandiri), not institutional/fixed schedule
// blocks like KP, Kuliah, or Bootcamp which aren't really "habits" to track.
// ---------------------------------------------------------------------------
const HABIT_CATEGORIES = ["Worship", "Health", "Data Analyst", "English", "Personal"];

app.get("/api/habits", (req, res) => {
  const rows = db.prepare("SELECT * FROM activities").all()
    .filter(a => a.recurring !== "none" && HABIT_CATEGORIES.includes(a.category));

  // Group by exact title+category — a habit like "Qur'an" is often stored as
  // several rows (one per weekday it happens on), so its streak has to look
  // across the whole group, not just a single day-of-week row.
  const groups = {};
  rows.forEach(a => {
    const key = a.title + "|" + a.category;
    (groups[key] ||= { title: a.title, category: a.category, rows: [] }).rows.push(a);
  });

  const allCompletions = db.prepare("SELECT activity_id, date FROM completions").all();
  const completedSet = new Set(allCompletions.map(r => r.activity_id + "|" + r.date));

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const result = Object.values(groups).map(g => {
    const rowForDate = d => g.rows.find(r => occursOn(r, d));

    // Current streak: walk backward from today. A missed *past* occurrence
    // breaks it; today not being done yet does not (it's still pending).
    let current = 0;
    let d = new Date(today);
    for (let i = 0; i < 3650; i++) {
      const r = rowForDate(d);
      if (r) {
        const done = completedSet.has(r.id + "|" + toISO(d));
        if (done) current++;
        else if (i !== 0) break; // missed on a past day => streak ends
      }
      d.setDate(d.getDate() - 1);
    }

    // Best streak ever: scan forward from the earliest completion on record.
    const ids = g.rows.map(r => r.id);
    const groupDates = allCompletions.filter(c => ids.includes(c.activity_id)).map(c => c.date).sort();
    let best = current;
    if (groupDates.length) {
      let run = 0;
      let dd = parseISO(groupDates[0]);
      while (dd <= today) {
        const r = rowForDate(dd);
        if (r) {
          if (completedSet.has(r.id + "|" + toISO(dd))) { run++; best = Math.max(best, run); }
          else run = 0;
        }
        dd.setDate(dd.getDate() + 1);
      }
    }
    return { title: g.title, category: g.category, current, best };
  }).sort((a, b) => b.current - a.current || b.best - a.best);

  res.json(result);
});

app.listen(PORT, () => console.log(`Life Scheduler running at http://localhost:${PORT}`));