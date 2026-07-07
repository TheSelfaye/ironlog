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
  `).run({
