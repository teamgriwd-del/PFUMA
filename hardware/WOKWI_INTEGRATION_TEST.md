# Testing the Full Hardware↔Software Pipeline Without Physical Hardware

This is a **software integration test rig** — it proves the entire chain (device pairing → real telemetry → real storage → "Live Physical Device" on the dashboard) actually works, today, using free browser-based simulation instead of waiting for real parts to arrive and be soldered.

It is **not** the real hardware design. The real physical firmware (SF7 LoRa, compact binary packet) lives in `hardware/collar_node/firmware/collar_node.ino` and `hardware/base_station/firmware/base_station.ino` — see `hardware/HARDWARE_DESIGN.md` and the wiring diagrams for that. This test rig substitutes public MQTT-over-WiFi for the LoRa hop, because [Wokwi](https://wokwi.com) (the free browser simulator) has no built-in SX1278/LoRa part. Everything **downstream of the base station is identical** to the real thing — same JSON shape, same `/api/iot/telemetry` endpoint, same pairing rules, same database.

## What you need

- A free [wokwi.com](https://wokwi.com) account (browser-based, no install).
- [ngrok](https://ngrok.com) (free tier) — to expose your local Flask API to the internet, since Wokwi's simulated ESP32 runs in the cloud/your browser, not on your LAN.
- The PFUMA backend and web app running locally (`backend/` and `npm run dev`, per `SETUP.md`).

## Step-by-step

### 1. Start your backend and expose it
```bash
cd backend
python app.py
```
In a second terminal:
```bash
ngrok http 5000
```
Copy the `https://xxxx.ngrok-free.app` URL ngrok prints.

### 2. Configure the two Wokwi sketches
- Open [`hardware/pfuma collar/sketch.ino`](pfuma%20collar/sketch.ino) — this is the **collar**. Check `COLLAR_ID` (default `CN001SIM`).
- Open [`hardware/pfuma/sketch.ino`](pfuma/sketch.ino) — this is the **base station**. Set:
  - `API_URL` to your ngrok URL + `/api/iot/telemetry` (e.g. `https://xxxx.ngrok-free.app/api/iot/telemetry`)
  - `FORWARD_TO_API` to `true`
  - Note `STATION_ID` (default `BS01SIM`)

### 3. Pair both devices in the app first
Telemetry from an unpaired device is rejected (this is the real security model, not relaxed for the test rig). Log in as a Farmer, go to the **IoT Monitor** tab, and pair:
1. `BS01SIM` (or whatever you set `STATION_ID` to) — the base station.
2. `CN001SIM` (or whatever you set `COLLAR_ID` to) — the collar, optionally attached to one of your registered animals so its readings show up on that animal's dashboard.

### 4. Run both simulations
Upload each folder to a Wokwi project (or open the two `wokwi-project.txt` links directly if you're using the ones already downloaded — [`hardware/pfuma`](pfuma) and [`hardware/pfuma collar`](pfuma%20collar) — then re-apply the edits from Step 2 in the Wokwi editor since downloaded copies don't auto-sync back). Click **Play (▶)** on **both** — order doesn't matter, but the base station needs to be running to receive.

Watch the two Serial Monitors:
- Collar: `[TX OK] {"id":"CN001SIM",...}` every 3 seconds.
- Base station: `[LINK] RX nn bytes` then `[API] POST .../api/iot/telemetry -> 200`.

### 5. Watch it land in the real app
Open the paired animal's **IoT Monitor** tab in the PFUMA web app. Within ~8 seconds (the dashboard's poll interval) the status badge should flip to **"Live · Physical Device"** and show the real values coming out of the Wokwi simulation — proving the full pairing → telemetry → storage → dashboard pipeline end-to-end.

## Why this is a legitimate test, not a shortcut

- The Flask endpoints, pairing rules, database schema, and dashboard logic are **exactly** what real hardware will hit — nothing is mocked or bypassed on the software side.
- The only substitution is the radio hop (LoRa → MQTT), which is purely a Wokwi tooling limitation, not a PFUMA design choice.
- A public MQTT broker (`broker.hivemq.com`) is shared with the entire internet — the topic string is your only isolation. If you see telemetry you didn't send, or want stronger isolation for a real demo, make the topic string in both sketches more unique (e.g. append today's date) before a public demonstration.

## Known gaps vs. real hardware

- No GPS: the collar sketch uses a potentiometer to fake "in zone / out of zone," so `lat`/`lon`/`gpsAcc` are never sent — those columns stay `NULL` for simulated readings. Real hardware sends real coordinates.
- No RSSI: MQTT has no equivalent signal-strength reading, so `rssi` stays `NULL` for simulated readings.
- No real LoRa range/capacity behaviour — the "Network Capacity" numbers in `HARDWARE_DESIGN.md` don't apply here since there's no radio contention over a public MQTT broker.
