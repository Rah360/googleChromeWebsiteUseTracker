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
- On abrupt browser close, usage is recovered up to the last heartbeat/update point.
- Session retention is capped to the latest 90 days (automatic daily cleanup).
