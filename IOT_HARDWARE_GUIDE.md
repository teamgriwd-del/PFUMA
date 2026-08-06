# PFUMA: IoT Hardware Guide

This guide covers the **Physical Hardware Layer** of PFUMA: how to connect a real collar (CN-01) and base station (BS-01) to your farm and your PFUMA account, and how the Proteus/Arduino simulation setup works for development.

**Where things stand today:** device pairing, real telemetry storage, and the app's IoT Monitor display are all wired end-to-end and verified working. When a paired collar has reported within the last ~20 seconds, the dashboard shows its real readings (temperature, heart rate, GPS, battery, RSSI) and is clearly labelled "Live · Physical Collar." When it hasn't (no hardware built yet, or a collar's gone quiet), the dashboard falls back to a clearly-labelled "Demo Simulation" so the app is still usable for demos without hardware in hand.

---

## 1. Connecting Your Physical Hardware — Farmer/Installer Setup

### Real wiring diagrams and reference photos

This section is the walkthrough; for the actual build reference, use:
- [`PFUMA_CN01_Wiring_Diagram.pdf`](../PFUMA_CN01_Wiring_Diagram.pdf) / [`PFUMA_BS01_Wiring_Diagram.pdf`](../PFUMA_BS01_Wiring_Diagram.pdf) — real, pin-level, colour-coded wiring diagrams (regenerate with `python make_wiring_diagrams.py && python render_wiring_diagrams.py` if the design changes). These are module-interconnection diagrams for perfboard/breadboard building, not the simplified Proteus simulation circuit in §2 below.
- [`hardware/actual_equipment/README.md`](hardware/actual_equipment/README.md) — reference photos and exact order/search terms for every real component in the BOM.
- [`hardware/HARDWARE_DESIGN.md`](hardware/HARDWARE_DESIGN.md) — the full pin-by-pin netlist and BOM these diagrams are generated from (source of truth if anything conflicts).

### What you need
Two board types, per the full design in [`hardware/HARDWARE_DESIGN.md`](hardware/HARDWARE_DESIGN.md):

| Board | Purpose | Core parts |
|---|---|---|
| **CN-01 Collar Node** (one per animal) | Worn on the animal — measures temperature, heart rate, movement, GPS location, and radios it to the base station | ESP32-WROOM-32, SX1278 LoRa module, NEO-6M GPS, MPU-6050 (motion), MAX30102 (heart rate), DS18B20 (temperature), solar panel + LiPo battery + TP4056 charger |
| **BS-01 Base Station** (one per farm) | Fixed near your house/router — receives LoRa data from collars in range and forwards it to the PFUMA backend over WiFi. At the firmware's current SF7 setting, that's typically **~1-2km on farm terrain** (traded down from a theoretical ~5km SF9 max range to comfortably support **30+ collars per base station** — see "Network Capacity" in `HARDWARE_DESIGN.md` for the real numbers behind that trade-off) | ESP32-WROOM-32, SX1278 LoRa module, SSD1306 OLED display |

You can order the components from the BOM tables in `HARDWARE_DESIGN.md` (or the shopping-list version in `hardware/actual_equipment/README.md`) and assemble/solder them yourself, or have a local electronics workshop build the boards from that design.

### Step 1 — Flash the firmware
1. Install the [Arduino IDE](https://www.arduino.cc/en/software) and add ESP32 board support (Boards Manager → search "esp32").
2. Install the required libraries via Library Manager: `LoRa` (Sandeep Mistry), `ArduinoJson`, `Adafruit SSD1306`, `Adafruit GFX` (base station only), `PubSubClient` if used, `DHT`/`OneWire`/`DallasTemperature` for the DS18B20 sensor (collar only).
3. Open [`hardware/base_station/firmware/base_station.ino`](hardware/base_station/firmware/base_station.ino) for the base station, or [`hardware/collar_node/firmware/collar_node.ino`](hardware/collar_node/firmware/collar_node.ino) for a collar.

### Step 2 — Edit the configuration block (do this before flashing)
Both files have a clearly marked `CONFIGURATION` section near the top with placeholder values you must replace:

**Base station (`base_station.ino`):**
- `WIFI_SSID` / `WIFI_PASS` — your farm's WiFi network name and password.
- `API_HOST` — the local IP address of the computer running `backend/app.py`, e.g. `http://192.168.1.50:5000`. Find your computer's local IP with `ipconfig` (Windows, look for "IPv4 Address") or `ifconfig`/`ip addr` (Mac/Linux) — **not** `127.0.0.1` or `localhost`, since the ESP32 is a separate device on your network.
- `STATION_ID` — a unique name for this base station, e.g. `BS-01-YOURFARM`. This is what you'll type into the app to claim it (Step 4).

**Collar (`collar_node.ino`):**
- `COLLAR_ID` — a unique name for this collar, **max 8 characters** (it travels over the airtime-constrained LoRa link in a fixed-size field — see the compact `CollarPacket` struct in the firmware). Suggested format `CNnnnFFF`, e.g. `CN014ZVI` for collar #14 on a Zvimba farm. The animal name/tag are *not* set on the collar — they live in the app, linked via pairing in Step 4.

### Step 3 — Power on
1. Power on the **base station** first, near your router. Its WiFi status LED (yellow, `PIN_LED_WIFI`) should light up once it connects — check the OLED screen for a "WiFi Connected" message.
2. Attach the **collar** securely to the animal (waterproof housing recommended) and power it on. It will start broadcasting over LoRa to any base station in range.

### Step 4 — Pair the device in the PFUMA app
1. Log in to the web app as a **Farmer** and open the **IoT Monitor** tab.
2. In the **Paired Devices** panel, enter the device serial exactly as you set `STATION_ID` or `COLLAR_ID` in the firmware.
3. Optionally select which animal the device is attached to (you can also do this later).
4. Click **Pair Device** — this claims the device under your account so only you can see and manage it. Pairing is enforced server-side (`POST /iot-devices/pair` in `backend/app.py`); a device serial can only ever belong to one account.

Once paired, the backend will accept telemetry sent from that device (`POST /api/iot/telemetry`, `POST /api/iot/alert` — both check the `X-Station-ID` header against your paired devices before accepting data).

---

## 2. Simulation / Development Setup (Proteus)

For development and demos without physical hardware, build a simplified "PFUMA Security Node" in Proteus:

### Components List
- **Microcontroller:** Arduino Uno (recommended for simulation stability).
- **Movement Sensor:** ADXL335 Accelerometer (or 3 potentiometers to simulate X, Y, Z axes).
- **Health Sensors:** DHT22 (temp), potentiometer (heart rate).
- **Security Output:** Piezo buzzer (Pin 8) — triggers during theft detection.
- **Communication:** COMPIM (serial bridge) and Virtual Terminal.

### Key Connections
1. **Accelerometer:** X-axis to **A1**, Y-axis to **A2**, Z-axis to **A3**.
2. **Buzzer:** Negative to GND, Positive to **Digital Pin 8**.
3. **GPS (NEO-6M):** TX to Pin 0, RX to Pin 1.

See [`hardware/PROTEUS_SIMULATION_GUIDE.md`](hardware/PROTEUS_SIMULATION_GUIDE.md) for the full simulation walkthrough and `.pdsprj` project files.

### Testing the full pipeline right now, with no hardware at all

Proteus proves the firmware logic works in isolation. If you want to prove the **entire chain** — pairing, real telemetry hitting the real backend, and the dashboard flipping to "Live · Physical Device" — before any physical board exists, there's a second, separate simulation rig built specifically for that: [`hardware/WOKWI_INTEGRATION_TEST.md`](hardware/WOKWI_INTEGRATION_TEST.md). It runs the collar and base station as free browser-based [Wokwi](https://wokwi.com) ESP32 simulations (`hardware/pfuma collar/` and `hardware/pfuma/`) that talk MQTT instead of LoRa, then forward real JSON into your local `backend/app.py` over ngrok — same endpoints, same pairing rules, same database as real hardware would use.

### Simplified sketch (Arduino Uno simulation only — not the real ESP32 firmware)

```cpp
#include <DHT.h>

// Pins
#define DHTPIN 2
#define DHTTYPE DHT22
#define BUZZER_PIN 8
#define ACCEL_X A1
#define ACCEL_Y A2
#define ACCEL_Z A3
#define PULSE_PIN A0

// Configuration
const float SAFE_LAT = -17.3601;
const float SAFE_LON = 30.1918;
const float SAFE_RADIUS = 0.005; // Approx 500m
const int MOVEMENT_THRESHOLD = 150; // Sensitivity for theft detection

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  // 1. READ SENSORS
  float temp = dht.readTemperature();
  int hr = map(analogRead(PULSE_PIN), 0, 1023, 60, 140);

  // Simulated GPS Drift
  float currentLat = SAFE_LAT + (random(-100, 100) / 5000.0);
  float currentLon = SAFE_LON + (random(-100, 100) / 5000.0);

  // Read Accelerometer (Movement)
  int x = analogRead(ACCEL_X);
  int y = analogRead(ACCEL_Y);
  int z = analogRead(ACCEL_Z);
  int totalMovement = abs(x-512) + abs(y-512); // Simple activity metric

  // 2. SECURITY LOGIC (Theft Detection)
  bool isOutside = sqrt(pow(currentLat - SAFE_LAT, 2) + pow(currentLon - SAFE_LON, 2)) > SAFE_RADIUS;
  bool isTheft = isOutside && (totalMovement > MOVEMENT_THRESHOLD);

  String securityStatus = "Secure";
  int interval = 10000; // Default 10s battery save mode

  if (isTheft) {
    securityStatus = "THEFT_ALERT";
    digitalWrite(BUZZER_PIN, HIGH); // Trigger physical alarm
    interval = 2000; // Switch to High-Frequency Emergency Tracking
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // 3. HEALTH LOGIC
  String healthStatus = (temp > 39.5) ? "FEVER_DETECTED" : "Healthy";

  // 4. OUTPUT JSON
  Serial.print("{");
  Serial.print("\"temp\":"); Serial.print(temp);
  Serial.print(", \"hr\":"); Serial.print(hr);
  Serial.print(", \"lat\":"); Serial.print(currentLat, 4);
  Serial.print(", \"lon\":"); Serial.print(currentLon, 4);
  Serial.print(", \"move\":"); Serial.print(totalMovement);
  Serial.print(", \"sec\": \""); Serial.print(securityStatus); Serial.print("\"");
  Serial.print(", \"health\": \""); Serial.print(healthStatus); Serial.print("\"");
  Serial.println("}");

  delay(interval);
}
```

---

## 3. What Makes The Detection "Smart"

The device doesn't just send raw data — it performs edge computing:
- **Theft Signature:** looks for rapid movement *combined with* an increasing distance from the farm center, rather than either signal alone.
- **Adaptive Sampling:** stays in "Quiet Mode" (10s interval, `REPORT_INTERVAL_MS`) when the animal is calm, and switches to high-frequency tracking (3s interval, `ALERT_INTERVAL_MS`) the moment fever or a theft signature is detected — this is what lets a real collar last months on a small battery instead of draining it with constant high-rate transmission. (The simplified Proteus sketch in §2 uses illustrative 10s/2s values for the same idea.)

## 4. Backend Endpoints Involved

| Endpoint | Used by | Purpose |
|---|---|---|
| `POST /iot-devices/pair` | PFUMA app (farmer, authenticated) | Claim a device serial under your account |
| `GET /iot-devices` | PFUMA app (farmer, authenticated) | List your paired devices |
| `PATCH /iot-devices/<id>` | PFUMA app (farmer, authenticated) | Attach/change which animal a device is linked to |
| `POST /api/iot/telemetry` | Base station firmware | Sensor readings — validated (both the base station's and the collar's serial must be paired) and **stored** in `iot_readings` |
| `POST /api/iot/alert` | Base station firmware | Theft/fever alerts — same handling and storage as telemetry |
| `GET /animals/<id>/iot-readings` | PFUMA app (farmer/vet/police, authenticated) | Recent real readings for one animal's paired collar — this is what the IoT Monitor tab polls to decide "live" vs "simulated" |

---
*PFUMA IoT — Zimbabwe Agricultural Show*
