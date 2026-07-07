# IronLog

A personal weight + lifting tracker.

- **Weight tab**: log daily weight, see what you're "expected" to weigh based on a goal line you set, and whether you're ahead/behind. Two independent modes — Cut and Lean Bulk — each with their own start/goal weight, dates, and an optional body-fat % target with an estimated target weight.
- **Lifting tab**: pick or add a lift, log sets (weight × reps), see last session's numbers to beat, a 2-minute rest timer that auto-starts after you log a set (with an audio chime when it ends), and a progress chart (weight or reps over time) per lift.
- **Settings tab**: configure the goal line for Cut and Lean Bulk separately.

Single-user app, no login — it's meant for one person's own data.

## Deploy on Railway

1. Go to railway.app → New Project → Deploy from GitHub repo → pick this repo.
2. Railway auto-detects Node.js and runs `npm install` then `npm start`.
3. Add a volume mounted at `/data` (Settings → Volumes) so your SQLite data survives redeploys.
4. Settings → Networking → Generate Domain for a public URL.
