// ---------------- State ----------------
let weightMode = 'cut';
let settingsMode = 'cut';
let currentExerciseId = null;
let liftMetric = 'weight';
let weightChart = null;
let liftChart = null;

let timerSeconds = 120;
let timerTotal = 120;
let timerInterval = null;
let timerRunning = false;

const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------------- Tabs ----------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------------- Weight tab mode switch ----------------
document.querySelectorAll('#tab-weight .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-weight .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    weightMode = btn.dataset.mode;
    loadWeightTab();
  });
});

// ---------------- Settings mode switch ----------------
document.querySelectorAll('#tab-settings .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-settings .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settingsMode = btn.dataset.modeSettings;
    loadGoalsForm();
  });
});

// ================= WEIGHT TAB =================
async function loadWeightTab(){
  const [goals, entries] = await Promise.all([
    fetch(`/api/goals/${weightMode}`).then(r => r.json()),
    fetch(`/api/weight/${weightMode}`).then(r => r.json())
  ]);

  document.getElementById('weight-date').value = todayISO();

  const todayEntry = entries.find(e => e.date === todayISO());
  document.getElementById('w-today').textContent = todayEntry ? todayEntry.weight.toFixed(1) : '—';

  const expected = computeExpectedWeight(goals, todayISO());
  document.getElementById('w-expected').textContent = expected != null ? expected.toFixed(1) : '—';

  const banner = document.getElementById('w-status-banner');
  const deltaEl = document.getElementById('w-delta');

  if (expected != null && todayEntry) {
    const delta = todayEntry.weight - expected;
    deltaEl.textContent = (delta > 0 ? '+' : '') + delta.toFixed(1);
    const dir = (goals.goal_weight >= goals.start_weight) ? 1 : -1;
    const score = delta * dir;
    banner.classList.remove('good', 'bad');
    if (score >= 0) {
      banner.classList.add('good');
      banner.textContent = `On pace or ahead of schedule (${Math.abs(delta).toFixed(1)} lbs ${dir > 0 ? 'above' : 'below'} projection).`;
    } else {
      banner.classList.add('bad');
      banner.textContent = `Behind schedule by ${Math.abs(delta).toFixed(1)} lbs — adjust intake or activity.`;
    }
  } else if (!goals.start_weight || !goals.goal_weight || !goals.goal_date) {
    deltaEl.textContent = '—';
    banner.classList.remove('good', 'bad');
    banner.textContent = 'Set your goal in Settings to see progress.';
  } else {
    deltaEl.textContent = '—';
    banner.classList.remove('good', 'bad');
    banner.textContent = "Log today's weight to see how you're tracking.";
  }

  const bfDisplay = document.getElementById('bf-target-display');
  if (goals.bodyfat_target && goals.bodyfat_target_weight) {
    bfDisplay.classList.remove('muted');
    bfDisplay.innerHTML = `Estimated <strong>${goals.bodyfat_target_weight} lbs</strong> at <strong>${goals.bodyfat_target}%</strong> body fat.`;
  } else {
    bfDisplay.classList.add('muted');
    bfDisplay.textContent = 'Not set — add it in Settings.';
  }

  renderWeightChart(goals, entries);
}

function computeExpectedWeight(goals, dateStr){
  if (!goals.start_weight || !goals.start_date || !goals.goal_weight || !goals.goal_date) return null;
  const start = new Date(goals.start_date).getTime();
  const goal = new Date(goals.goal_date).getTime();
  const now = new Date(dateStr).getTime();
  if (goal === start) return goals.goal_weight;
  const frac = (now - start) / (goal - start);
  const clamped = Math.max(0, Math.min(1, frac));
  return goals.start_weight + (goals.goal_weight - goals.start_weight) * clamped;
}

function renderWeightChart(goals, entries){
  const labels = entries.map(e => e.date);
  const actual = entries.map(e => e.weight);
  const expected = entries.map(e => computeExpectedWeight(goals, e.date));

  const ctx = document.getElementById('weight-chart');
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Actual', data: actual, borderColor: '#c9a02b', backgroundColor: 'transparent', tension: 0.25, pointRadius: 3 },
        { label: 'Expected', data: expected, borderColor: '#8b8b96', borderDash: [5,4], backgroundColor: 'transparent', tension: 0.25, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#ece8de' } } },
      scales: {
        x: { ticks: { color: '#8b8b96' }, grid: { color: '#2a2a33' } },
        y: { ticks: { color: '#8b8b96' }, grid: { color: '#2a2a33' } }
      }
    }
  });
}

document.getElementById('weight-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('weight-date').value;
  const weight = parseFloat(document.getElementById('weight-input').value);
  await fetch(`/api/weight/${weightMode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, weight })
  });
  document.getElementById('weight-input').value = '';
  loadWeightTab();
});

// ================= SETTINGS TAB =================
async function loadGoalsForm(){
  const goals = await fetch(`/api/goals/${settingsMode}`).then(r => r.json());
  document.getElementById('g-start-weight').value = goals.start_weight ?? '';
  document.getElementById('g-start-date').value = goals.start_date ?? '';
  document.getElementById('g-goal-weight').value = goals.goal_weight ?? '';
  document.getElementById('g-goal-date').value = goals.goal_date ?? '';
  document.getElementById('g-bf-target').value = goals.bodyfat_target ?? '';
  document.getElementById('g-bf-weight').value = goals.bodyfat_target_weight ?? '';
}

document.getElementById('goals-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    start_weight: parseFloat(document.getElementById('g-start-weight').value) || null,
    start_date: document.getElementById('g-start-date').value || null,
    goal_weight: parseFloat(document.getElementById('g-goal-weight').value) || null,
    goal_date: document.getElementById('g-goal-date').value || null,
    bodyfat_target: parseFloat(document.getElementById('g-bf-target').value) || null,
    bodyfat_target_weight: parseFloat(document.getElementById('g-bf-weight').value) || null
  };
  await fetch(`/api/goals/${settingsMode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (settingsMode === weightMode) loadWeightTab();
  alert('Goals saved.');
});

// ================= LIFTING TAB =================
async function loadExercises(){
  const exercises = await fetch('/api/exercises').then(r => r.json());
  const select = document.getElementById('exercise-select');
  select.innerHTML = '';
  exercises.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.name;
    select.appendChild(opt);
  });
  if (exercises.length && !currentExerciseId) {
    currentExerciseId = exercises[0].id;
  }
  if (currentExerciseId) {
    select.value = currentExerciseId;
    await onExerciseChange();
  }
}

document.getElementById('exercise-select').addEventListener('change', (e) => {
  currentExerciseId = e.target.value;
  onExerciseChange();
});

document.getElementById('add-exercise-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-exercise-input');
  const name = input.value.trim();
  if (!name) return;
  const ex = await fetch('/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  }).then(r => r.json());
  input.value = '';
  currentExerciseId = ex.id;
  await loadExercises();
});

async function onExerciseChange(){
  await Promise.all([loadPreviousSession(), loadTodaySets(), loadLiftChart()]);
}

async function loadPreviousSession(){
  const data = await fetch(`/api/sets/${currentExerciseId}/previous-session?date=${todayISO()}`).then(r => r.json());
  const card = document.getElementById('prev-session-card');
  const list = document.getElementById('prev-session-list');
  list.innerHTML = '';
  if (!data.date) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  document.querySelector('#prev-session-card .card-title').textContent = `Last session (${data.date}) — beat this`;
  data.sets.forEach(s => {
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML = `<span>Set ${s.set_number}</span><span class="badge">${s.weight} lbs × ${s.reps} reps</span>`;
    list.appendChild(row);
  });
}

async function loadTodaySets(){
  const all = await fetch(`/api/sets/${currentExerciseId}`).then(r => r.json());
  const todaySets = all.filter(s => s.date === todayISO());
  const list = document.getElementById('today-sets-list');
  list.innerHTML = '';
  todaySets.forEach(s => {
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML = `<span>Set ${s.set_number}</span><span class="badge">${s.weight} lbs × ${s.reps} reps</span>`;
    list.appendChild(row);
  });
}

document.getElementById('set-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentExerciseId) { alert('Add an exercise first.'); return; }
  const weight = parseFloat(document.getElementById('set-weight').value);
  const reps = parseInt(document.getElementById('set-reps').value, 10);
  await fetch('/api/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise_id: currentExerciseId, date: todayISO(), weight, reps })
  });
  document.getElementById('set-reps').value = '';
  await Promise.all([loadTodaySets(), loadLiftChart()]);
  startTimer(); // auto-start rest timer once reps are logged
});

document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    liftMetric = btn.dataset.metric;
    loadLiftChart();
  });
});

async function loadLiftChart(){
  if (!currentExerciseId) return;
  const sets = await fetch(`/api/sets/${currentExerciseId}`).then(r => r.json());
  const byDate = {};
  sets.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = { maxWeight: 0, maxReps: 0 };
    byDate[s.date].maxWeight = Math.max(byDate[s.date].maxWeight, s.weight);
    byDate[s.date].maxReps = Math.max(byDate[s.date].maxReps, s.reps);
  });
  const dates = Object.keys(byDate).sort();
  const values = dates.map(d => liftMetric === 'weight' ? byDate[d].maxWeight : byDate[d].maxReps);

  const ctx = document.getElementById('lift-chart');
  if (liftChart) liftChart.destroy();
  liftChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: liftMetric === 'weight' ? 'Top weight (lbs)' : 'Top reps',
        data: values,
        borderColor: '#c9a02b',
        backgroundColor: 'rgba(201,160,43,0.15)',
        fill: true,
        tension: 0.25,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#ece8de' } } },
      scales: {
        x: { ticks: { color: '#8b8b96' }, grid: { color: '#2a2a33' } },
        y: { ticks: { color: '#8b8b96' }, grid: { color: '#2a2a33' } }
      }
    }
  });
}

// ================= REST TIMER =================
const timerDisplay = document.getElementById('timer-display');
const timerBar = document.getElementById('timer-bar');

function formatTime(s){
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function updateTimerUI(){
  timerDisplay.textContent = formatTime(Math.max(0, timerSeconds));
  const pct = Math.max(0, (timerSeconds / timerTotal) * 100);
  timerBar.style.width = pct + '%';
}

function startTimer(){
  clearInterval(timerInterval);
  timerSeconds = 120;
  timerTotal = 120;
  timerRunning = true;
  updateTimerUI();
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerUI();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      playChime();
    }
  }, 1000);
}

function resetTimer(){
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 120;
  timerTotal = 120;
  updateTimerUI();
}

document.getElementById('timer-start').addEventListener('click', () => {
  if (!timerRunning) startTimer();
});
document.getElementById('timer-reset').addEventListener('click', resetTimer);

function playChime(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    // three short beeps
    [0, 0.35, 0.7].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  } catch (e) {
    console.warn('Audio chime failed', e);
  }
}

// ================= INIT =================
(async function init(){
  updateTimerUI();
  await loadGoalsForm();
  await loadWeightTab();
  await loadExercises();
})();
