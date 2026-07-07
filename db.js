const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Railway: mount a volume at /data for persistence. Falls back to local file otherwise.
const dataDir = fs.existsSync('/data') ? '/data' : __dirname;
const db = new Database(path.join(dataDir, 'ironlog.db'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  mode TEXT PRIMARY KEY,
  start_weight REAL,
  start_date TEXT,
  goal_weight REAL,
  goal_date TEXT,
  bodyfat_target REAL,
  bodyfat_target_weight REAL
);

CREATE TABLE IF NOT EXISTS weight_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  UNIQUE(mode, date)
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  exercise_id INTEGER NOT NULL,
  UNIQUE(day, exercise_id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER,
  time TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// seed default goal rows for the two modes if not present
const seed = db.prepare(`INSERT OR IGNORE INTO goals (mode, start_weight, start_date, goal_weight, goal_date, bodyfat_target, bodyfat_target_weight) VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL)`);
seed.run('cut');
seed.run('bulk');

module.exports = db;
