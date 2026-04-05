# Website Use Tracker (Chrome Extension)

Tracks active website usage time in Chrome and stores sessions in IndexedDB.

## Features
- Tracks active tab domains (`http/https`) and time spent.
- Popup shows tracking status (instead of full stats UI).
- Dedicated dashboard page for analytics.
- Aggregates usage for:
  - Daily
  - Weekly (Monday-start)
  - Monthly
- Alerts:
  - Daily website alerts at 1 hour and 3 hours (per website, once each threshold per day).
  - Weekly website alert at 5 hours (per website, once per week).
- Thought Pause:
  - Shows a gentle in-page prompt: `Pause — What are you thinking right now?`
  - Trigger support:
    - First visit per domain/day
    - Continuous usage (default 5 minutes) per domain/day
    - Rapid switching (default 3 switches in 60s, cooldown controlled)
    - Threshold-linked prompts (1h/3h daily, 5h weekly)
  - Configurable pause list or all tracked sites
  - Quiet hours, cooldown, strict mode, quick choices, optional note
  - Per-site/day snooze: \"Don't show again for this site today\"
- Behavioral Analytics:
  - Active-tab domain switch events stored in `tab_events`
  - Revisit speed buckets (0-30s, 30-60s, 1-3m, 3-10m, 10m+)
  - Bounce pair analysis (top transitions + highlight rules)
  - 10-minute switching timeline
  - Rapid loop metrics (count, average, longest, histogram)
  - Top-domain activity heatmap by hour
- Revisit Loop Detector:
  - Detects rapid switching loops between 2-3 domains in a rolling window.
  - Shows a gentle popup: “You've switched X times in Y minutes. Still intentional?”
  - Actions: continue, take break, snooze today, dismiss.
- Study Mode:
  - Manual start/stop focus sessions from the popup.
  - Tracks active-tab study time while the mode is on.
  - Records which websites were visited during that session and how often.
  - Lets you configure distracting domains and URL patterns, such as `https://www.youtube.com/shorts/*`.
  - Separates time spent on distracting sites and short-form doomscroll surfaces like YouTube Shorts and Instagram Reels.
- Shows:
  - Total tracked time
  - Number of unique websites used
  - Website with maximum time spent
  - Top 10 websites only
- Clear data options:
  - Clear selected period
  - Clear all data

## Install (Unpacked)
1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Users/rahulsawant/Documents/ai/websiteUseTrackerAddon`

## Notes
- Data is retained in the extension's IndexedDB storage.
- Only active tab time is tracked; inactive/idle periods are not counted as active browsing time.
- Dashboard can be opened from extension popup via **Open Dashboard**.
- Thought Pause settings can be opened from extension popup via **Thought Pause Settings**.
- Study Mode can be started and stopped from the extension popup.
- On abrupt browser close, usage is recovered up to the last heartbeat/update point.
- Session retention is capped to the latest 90 days (automatic daily cleanup) for:
  - tracking sessions
  - thought pause events
  - study sessions
  - per-day/per-week alert metadata used for dedupe

## Thought Pause Data
- Stored in IndexedDB store: `thought_pauses`
- Fields:
  - `id` (auto)
  - `timestamp`
  - `dateKey` (`YYYY-MM-DD`)
  - `domain`
  - `url` (optional)
  - `triggerType` (`first_visit | continuous_5min | rapid_switch | threshold_1h | threshold_3h | threshold_5h_weekly`)
  - `choice` (quick option / continue / null)
  - `note` (optional)

## Tab Event Data
- Stored in IndexedDB store: `tab_events`
- Logged when active tab changes to a different domain (`tabActivated`/`tabUpdated complete`)
- Fields:
  - `id` (auto)
  - `timestamp`
  - `dateKey`
  - `domain`
  - `prevDomain`
  - `url`
  - `hour`
  - `minuteBucket`
  - `isTracked`

## Revisit Loop Data
- Loop settings are configurable in Options:
  - `enabled`
  - `windowMinutes`
  - `minSwitches`
  - `maxUniqueDomains`
  - `cooldownMinutes`
- Loop prompts are stored in IndexedDB store: `loop_prompts`
  - `id`, `timestamp`, `dateKey`, `switchCount`, `windowMinutes`, `domains`, `action`
- Loop prompt data follows the same 90-day retention cleanup policy.

## Study Mode Data
- Study sessions are stored in IndexedDB store: `study_sessions`
- Each record contains:
  - `dateKey`
  - `startTime`
  - `endTime`
  - `durationMs`
  - `activeStudyTimeMs`
  - `distractionTimeMs`
  - `doomscrollTimeMs`
  - `focusTimeMs`
  - `focusRatio`
  - `uniqueSites`
  - `totalSwitches`
  - `sites` (per-domain duration and visit count)
  - `distractingSites`
  - `doomscrollSurfaces`
