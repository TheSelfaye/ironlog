const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- GOALS ----------
app.get('/api/goals/:mode', (req, res) => {
  const row = db.prepare('SELECT * FROM goals WHERE mode = ?').get(req.params.mode);
  if (!row) return res.status(404).json({ error: 'unknown mode' });
  res.json(row);
});

app.post('/api/goals/:mode', (req, res) => {
  const { mode } = req.params;
  const { start_weight, start_date, goal_weight, goal_date, bodyfat_target, bodyfat_target_weight } = req.body;
  db.prepare(`
    INSERT INTO goals (mode, start_weight, start_date, goal_weight, goal_date, bodyfat_target, bodyfat_target_weight)
    VALUES (@mode, @start_weight, @start_date, @goal_weight, @goal_date, @bodyfat_target, @bodyfat_target_weight)
    ON CONFLICT(mode) DO UPDATE SET
      start_weight=@start_weight, start_date=@start_date, goal_weight=@goal_weight,
      goal_date=@goal_date, bodyfat_target=@bodyfat_target, bodyfat_target_weight=@bodyfat_target_weight
  `).run({ mode, start_weight, start_date, goal_weight, goal_date, bodyfat_target, bodyfat_target_weight });
  res.json(db.prepare('SELECT * FROM goals WHERE mode = ?').get(mode));
});

// ---------- WEIGHT ENTRIES ----------
app.get('/api/weight/:mode', (req, res) => {
  const rows = db.prepare('SELECT * FROM weight_entries WHERE mode = ? ORDER BY date ASC').all(req.params.mode);
  res.json(rows);
});


app.post('/api/weight/:mode', (req, res) => {
  const { mode } = req.params;
  const { date, weight } = req.body;
  if (!date || weight == null) return res.status(400).json({ error: 'date and weight required' });
  db.prepare(`
    INSERT INTO weight_entries (mode, date, weight) VALUES (?, ?, ?)
    ON CONFLICT(mode, date) DO UPDATE SET weight = excluded.weight
  `).run(mode, date, weight);
  res.json({ ok: true });
});

app.delete('/api/weight/entry/:id', (req, res) => {
  db.prepare('DELETE FROM weight_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- EXERCISES ----------
app.get('/api/exercises', (req, res) => {
  res.json(db.prepare('SELECT * FROM exercises ORDER BY name ASC').all());
});

app.post('/api/exercises', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const info = db.prepare('INSERT INTO exercises (name) VALUES (?)').run(name.trim());
    res.json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (e) {
    const existing = db.prepare('SELECT * FROM exercises WHERE name = ?').get(name.trim());
    if (existing) return res.json(existing);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/exercises/:id', (req, res) => {
  db.prepare('DELETE FROM sets WHERE exercise_id = ?').run(req.params.id);
  db.prepare('DELETE FROM exercises WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- SETS ----------
app.get('/api/sets/:exerciseId', (req, res) => {
  const rows = db.prepare('SELECT * FROM sets WHERE exercise_id = ? ORDER BY date ASC, set_number ASC').all(req.params.exerciseId);
  res.json(rows);
});

app.post('/api/sets', (req, res) => {
  const { exercise_id, date, weight, reps } = req.body;
  if (!exercise_id || weight == null || reps == null) return res.status(400).json({ error: 'exercise_id, weight, reps required' });
  const d = date || todayISO();
  const countRow = db.prepare('SELECT COUNT(*) as c FROM sets WHERE exercise_id = ? AND date = ?').get(exercise_id, d);
  const set_number = countRow.c + 1;
  const info = db.prepare('INSERT INTO sets (exercise_id, date, weight, reps, set_number) VALUES (?, ?, ?, ?, ?)')
    .run(exercise_id, d, weight, reps, set_number);
  res.json({ id: info.lastInsertRowid, exercise_id, date: d, weight, reps, set_number });
});

app.delete('/api/sets/:id', (req, res) => {
  db.prepare('DELETE FROM sets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sets/:exerciseId/previous-session', (req, res) => {
  const { exerciseId } = req.params;
  const today = req.query.date || todayISO();
  const priorDateRow = db.prepare(`
    SELECT DISTINCT date FROM sets
    WHERE exercise_id = ? AND date < ?
    ORDER BY date DESC LIMIT 1
  `).get(exerciseId, today);
  if (!priorDateRow) return res.json({ date: null, sets: [] });
  const sets = db.prepare('SELECT * FROM sets WHERE exercise_id = ? AND date = ? ORDER BY set_number ASC')
    .all(exerciseId, priorDateRow.date);
  res.json({ date: priorDateRow.date, sets });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`IronLog running on port ${PORT}`));
