# PFUMA — Proteus 8 Simulation Guide
# Step-by-step: build and run the collar node simulation

---

## WHAT YOU WILL BUILD IN PROTEUS

A working simulation of the CN-01 Collar Node that:
- Reads a simulated body temperature from DS18B20
- Reads simulated heart rate from a potentiometer
- Reads simulated accelerometer axes from 3 potentiometers
- Outputs JSON telemetry to a Virtual Terminal every 10 seconds
- Lights an LED on theft / fever detection
- Sounds a buzzer on theft alert

NOTE: LoRa (SX1278) and GPS (NEO-6M) are not in the Proteus standard
library. This guide simulates them using Virtual Terminal and COMPIM.
The firmware is adapted for Arduino Mega (easier Proteus simulation)
with equivalent logic to the ESP32 version.

---

## STEP 1: CREATE NEW PROJECT

1. Open Proteus 8  →  New Project
2. Name: PFUMA_Collar_CN01
3. Schematic: DEFAULT
4. PCB: None (simulation only)
5. Firmware: None (we load .hex separately)

---

## STEP 2: PLACE COMPONENTS

Open the component library (P button or Place → Component).
Search for and place each component:

Component             Search Term             Library
--------------------  ----------------------  ---------------------
Arduino Mega 2560     ARDUINO MEGA 2560        Arduino Shields
DS18B20               DS18B20                  Transducers
Potentiometer ×4      POT-HG                   Mechanics
Resistor 4.7kΩ        MINRES4K7                Resistors (DEVICE)
Resistor 330Ω         MINRES330R               Resistors (DEVICE)
LED (green)           LED-GREEN                Optoelectronics
LED (red)             LED-RED                  Optoelectronics
Buzzer                BUZZER                   Transducers
Virtual Terminal ×2   VIRTUAL TERMINAL         Virtual Instruments
Battery (5V)          BATTERY                  Sources
Ground (×many)        GROUND (GND)             Power
VCC rail              VCC                      Power


---

## STEP 3: SCHEMATIC WIRING

### Power
BATTERY(+) → Arduino Mega VIN
BATTERY(-) → GND
Place GND symbols on all component GND pins.

### DS18B20 Temperature Sensor
DS18B20 VDD  → VCC (5V)
DS18B20 GND  → GND
DS18B20 DQ   → Arduino D4
              → also → R1 (4.7kΩ) → VCC  [pull-up]

Note: In Proteus, the DS18B20 DQ line will show the one-wire
      timing pulses if you attach a digital oscilloscope.

### Potentiometer 1 — Heart Rate simulation
POT1 Left   → VCC
POT1 Right  → GND
POT1 Wiper  → Arduino A0
(Turn CW = higher HR reading, CCW = lower)

### Potentiometer 2 — Accelerometer X axis
POT2 Left   → VCC
POT2 Right  → GND
POT2 Wiper  → Arduino A1
(Centre = 512 = stationary, turn for movement)

### Potentiometer 3 — Accelerometer Y axis
POT3 Left   → VCC
POT3 Right  → GND
POT3 Wiper  → Arduino A2

### Potentiometer 4 — GPS latitude drift (optional)
POT4 Left   → VCC
POT4 Right  → GND
POT4 Wiper  → Arduino A3
(Used to simulate crossing zone boundary: full CW = outside zone)

### Status LED (Green)
Arduino D2 → R2 (330Ω) → LED1(+)
LED1(-)    → GND

### Alert LED (Red)
Arduino D3 → R3 (330Ω) → LED2(+)
LED2(-)    → GND

### Buzzer (Theft Alert)
Arduino D8 → BUZZER(+)
BUZZER(-)  → GND

### Virtual Terminal 1 — Serial Monitor (JSON output)
VT1 RXD → Arduino TX0 (Pin 1)
VT1 TXD → Arduino RX0 (Pin 0)
Set VT1: Baud=9600, 8N1

### Virtual Terminal 2 — GPS input simulation (optional)
VT2 TXD → Arduino RX1 (Pin 19)  [Serial1 on Mega]
Set VT2: Baud=9600, 8N1
(You can type/paste NMEA sentences here to feed the GPS parser)

---

## STEP 4: PROTEUS FIRMWARE (.hex)

The Proteus simulation runs a .hex file compiled from the Arduino IDE.
Use the SIMPLIFIED Proteus firmware below (not the ESP32 version).

### How to compile:
1. Open Arduino IDE
2. Board: Arduino Mega 2560
3. Paste the PROTEUS FIRMWARE code (see next section)
4. Sketch → Export Compiled Binary
5. Find the .hex file in the sketch folder
6. In Proteus: double-click Arduino Mega → Program File → browse to .hex
7. Clock Frequency: 16 MHz

---

## STEP 5: VIRTUAL INSTRUMENTS TO ADD

Go to View → Virtual Instruments and add:

Instrument        Attach to                  Purpose
----------------  -------------------------  ---------------------------
Digital Osc       DS18B20 DQ line (D4)       See 1-wire timing pulses
Virtual Terminal  Arduino TX0/RX0            Read JSON telemetry output
DC Voltmeter      POT1 wiper (A0)            See simulated HR voltage
DC Voltmeter      Battery node               See 5V supply

---

## STEP 6: RUN THE SIMULATION

1. Press Play (green triangle) or F9
2. Open the Virtual Terminal window
3. Adjust POT1 (heart rate) — watch HR value change in JSON
4. Adjust POT2/POT3 (accelerometer) — watch activity change
5. Turn POT4 fully clockwise to simulate leaving safe zone
   → LED2 (red) lights up, buzzer sounds, "theft":true in JSON
6. Edit DS18B20 temperature in its Properties dialog
   → Set above 39.5°C → "fever":true in JSON, LED flashes

---

## EXPECTED JSON OUTPUT IN VIRTUAL TERMINAL

{"id":"COL-007","animal":"Bessie","tag":"ZIM-882",
 "temp":38.5,"hr":72,"lat":-17.3601,"lon":30.1918,
 "activity":"Grazing","move":234,"inZone":true,
 "batt":82,"fever":false,"theft":false,"time":"00:00:10","pkt":1}

{"id":"COL-007","animal":"Bessie","tag":"ZIM-882",
 "temp":39.8,"hr":95,"lat":-17.3750,"lon":30.2100,
 "activity":"Running","move":3200,"inZone":false,
 "batt":81,"fever":true,"theft":true,"time":"00:00:20","pkt":2}

---

## PROTEUS FIRMWARE (Mega 2560 version)

Paste this into Arduino IDE, compile, export .hex, load into Proteus.

```cpp
// PFUMA CN-01 — Proteus Simulation Firmware
// For: Arduino Mega 2560 (simulates ESP32 collar node)
// Board in Proteus: ARDUINO MEGA 2560

#include <OneWire.h>
#include <DallasTemperature.h>

// ── Pins (Mega 2560 mapping) ──────────────────────────────────────────
#define PIN_DS18B20     4     // One-wire (D4)
#define PIN_HR_POT      A0    // Heart rate pot
#define PIN_ACCEL_X     A1    // Accelerometer X pot
#define PIN_ACCEL_Y     A2    // Accelerometer Y pot
#define PIN_GPS_SIM     A3    // GPS zone drift pot
#define PIN_LED_STATUS  2     // Green LED
#define PIN_LED_ALERT   3     // Red LED
#define PIN_BUZZER      8     // Buzzer

// ── Config ────────────────────────────────────────────────────────────
const char* COLLAR_ID   = "COL-007";
const char* ANIMAL_NAME = "Bessie";
const char* ANIMAL_TAG  = "ZIM-882";

const float SAFE_LAT    = -17.3601f;
const float SAFE_LON    =  30.1918f;
const float SAFE_RADIUS =   0.0045f;

const float TEMP_FEVER  = 39.5f;
const int   MOVE_THEFT  = 2500;

int   REPORT_MS         = 10000;

OneWire           oneWire(PIN_DS18B20);
DallasTemperature ds(&oneWire);

int   packetCount = 0;
unsigned long lastReport = 0;

void setup() {
  Serial.begin(9600);
  ds.begin();
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_LED_ALERT,  OUTPUT);
  pinMode(PIN_BUZZER,     OUTPUT);

  // Startup blink
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_STATUS, HIGH); delay(200);
    digitalWrite(PIN_LED_STATUS, LOW);  delay(200);
  }
  Serial.println(F("PFUMA Collar Node — Proteus Simulation"));
}

void loop() {
  if (millis() - lastReport >= (unsigned long)REPORT_MS) {
    lastReport = millis();

    // ── Read temperature ─────────────────────────────────────────────
    ds.requestTemperatures();
    float temp = ds.getTempCByIndex(0);
    if (temp == DEVICE_DISCONNECTED_C) temp = 38.5f;

    // ── Simulate HR from pot (A0: 0-1023 → 50-180 bpm) ──────────────
    int hrRaw = analogRead(PIN_HR_POT);
    int hr    = map(hrRaw, 0, 1023, 50, 180);

    // ── Simulate accelerometer from pots ─────────────────────────────
    int ax = analogRead(PIN_ACCEL_X) - 512;  // centre = 0
    int ay = analogRead(PIN_ACCEL_Y) - 512;
    int moveMag = abs(ax) + abs(ay);

    String activity;
    if      (moveMag < 50)   activity = "Resting";
    else if (moveMag < 200)  activity = "Grazing";
    else if (moveMag < 500)  activity = "Walking";
    else                      activity = "Running";

    // ── Simulate GPS drift from pot (A3) ─────────────────────────────
    int gpsRaw  = analogRead(PIN_GPS_SIM);
    float latOff = (gpsRaw / 1023.0f) * 0.012f;  // 0 to ~1.3 km drift
    float curLat = SAFE_LAT - latOff;
    float curLon = SAFE_LON + latOff;

    float dLat = curLat - SAFE_LAT;
    float dLon = curLon - SAFE_LON;
    bool inZone = sqrt(dLat*dLat + dLon*dLon) <= SAFE_RADIUS;

    // ── Simulated battery (decreases slowly) ─────────────────────────
    int batt = max(0, 100 - (int)(millis() / 60000));

    // ── Alerts ───────────────────────────────────────────────────────
    bool fever  = (temp >= TEMP_FEVER);
    bool theft  = (!inZone && moveMag > MOVE_THEFT);
    bool alert  = fever || theft;

    // ── Drive outputs ─────────────────────────────────────────────────
    digitalWrite(PIN_LED_STATUS, HIGH);
    digitalWrite(PIN_LED_ALERT,  alert ? HIGH : LOW);
    digitalWrite(PIN_BUZZER,     theft ? HIGH : LOW);

    // ── Adaptive interval ─────────────────────────────────────────────
    REPORT_MS = alert ? 3000 : 10000;

    // ── Emit JSON to Virtual Terminal ─────────────────────────────────
    packetCount++;
    Serial.print(F("{"));
    Serial.print(F("\"id\":\"")); Serial.print(COLLAR_ID); Serial.print(F("\","));
    Serial.print(F("\"animal\":\"")); Serial.print(ANIMAL_NAME); Serial.print(F("\","));
    Serial.print(F("\"tag\":\"")); Serial.print(ANIMAL_TAG); Serial.print(F("\","));
    Serial.print(F("\"temp\":")); Serial.print(temp, 1); Serial.print(F(","));
    Serial.print(F("\"hr\":")); Serial.print(hr); Serial.print(F(","));
    Serial.print(F("\"lat\":")); Serial.print(curLat, 5); Serial.print(F(","));
    Serial.print(F("\"lon\":")); Serial.print(curLon, 5); Serial.print(F(","));
    Serial.print(F("\"activity\":\"")); Serial.print(activity); Serial.print(F("\","));
    Serial.print(F("\"move\":")); Serial.print(moveMag); Serial.print(F(","));
    Serial.print(F("\"inZone\":")); Serial.print(inZone ? "true" : "false"); Serial.print(F(","));
    Serial.print(F("\"batt\":")); Serial.print(batt); Serial.print(F(","));
    Serial.print(F("\"fever\":")); Serial.print(fever ? "true" : "false"); Serial.print(F(","));
    Serial.print(F("\"theft\":")); Serial.print(theft ? "true" : "false"); Serial.print(F(","));
    Serial.print(F("\"pkt\":")); Serial.print(packetCount);
    Serial.println(F("}"));

    delay(50);
    digitalWrite(PIN_LED_STATUS, LOW);
  }
}
```

---

## KICAD QUICK-START CHECKLIST

Once happy with Proteus simulation, move to KiCad for real PCB:

[ ] Create KiCad project in hardware/collar_node/
[ ] Add symbol libraries: MCU_Espressif, Sensor_Temperature, RF_Module
[ ] Place ESP32-WROOM-32 symbol, assign GPIO per PIN MAP table
[ ] Place and wire all sensor symbols per Section 1.3 netlist
[ ] Add power symbols: +3V3, +VBAT, GND
[ ] Run ERC (Electrical Rules Check) — fix all errors before PCB
[ ] Assign footprints to all components
[ ] Generate netlist → open PCB editor
[ ] Set board outline: 80 × 50mm
[ ] Route power traces first (1.0mm GND, 0.5mm 3V3)
[ ] Route SPI traces (matched length, <50mm)
[ ] Pour GND copper fill on both layers
[ ] Run DRC (Design Rules Check)
[ ] Export Gerbers for manufacturing (JLCPCB / PCBWay)
