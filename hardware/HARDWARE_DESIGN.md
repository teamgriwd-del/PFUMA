# PFUMA IoT Hardware Design v1.0
# PFUMA Livestock Monitoring System
# Designed for KiCad 7+ / Proteus 8+

---

## SYSTEM OVERVIEW

Two PCB designs:
- CN-01  PFUMA Collar Node    — worn on animal, battery + solar, all sensors
- BS-01  PFUMA Base Station   — fixed at farm, LoRa gateway → WiFi → Flask API

Communication chain:
  Animal Collar (CN-01)
      ↓ LoRa 433 MHz — ~1-2km typical farm terrain at the firmware's current
        SF7 setting (traded down from a ~5km SF9 link-budget max to support
        30+ collars per base station — see "Network Capacity" below)
  Farm Base Station (BS-01)
      ↓ WiFi / Ethernet
  Flask API (backend/app.py)
      ↓ HTTP / WebSocket
  PFUMA Mobile App + Web Dashboard

---

## BOARD 1: CN-01 — PFUMA COLLAR NODE

### 1.1  BLOCK DIAGRAM

    ┌─────────────────────────────────────────────────────────────┐
    │                     CN-01  COLLAR NODE                       │
    │                                                               │
    │  [SOLAR 5V]──[TP4056]──[LiPo 3.7V 2000mAh]                 │
    │                              │                                │
    │                         [AMS1117-3.3]                        │
    │                              │ 3.3V                          │
    │                              │                                │
    │         ┌────────────────────┼────────────────────┐          │
    │         │                    │                    │          │
    │   [DS18B20]          [ESP32-WROOM-32]      [SX1278 LoRa]    │
    │  Body Temp                   │               433 MHz         │
    │  1-Wire                      │               SPI             │
    │                    ┌─────────┼─────────┐                     │
    │                    │                   │                     │
    │             [MPU-6050]          [MAX30102]                   │
    │             Activity/IMU         Heart Rate                  │
    │             I2C 0x68             I2C 0x57                    │
    │                                                               │
    │             [NEO-6M GPS]                                     │
    │             UART2                                            │
    │                                                               │
    │             [Battery ADC]  GPIO34 — voltage divider          │
    │             [Status LED]   GPIO2  — green                    │
    └─────────────────────────────────────────────────────────────┘


### 1.2  COMPONENTS (BOM)

Ref     Component              Value / Part No.          Package        Qty
------  ---------------------  ------------------------  -------------  ---
U1      Microcontroller        ESP32-WROOM-32            SMD-38pad       1
U2      GPS Module             NEO-6M                    Through-hole    1
U3      LoRa Transceiver       SX1278 / Ra-02 Module     SMA ant.        1
U4      IMU                    MPU-6050                  QFN-24          1
U5      Heart Rate Sensor      MAX30102                  OLGA-14         1
U6      Temp Sensor            DS18B20 (waterproof)      TO-92 probe     1
U7      Charge Controller      TP4056 with protec. brd   Module          1
U8      LDO Regulator          AMS1117-3.3               SOT-223         1
U9      Boost (optional)       MT3608                    SOT-23-6        1

C1      Decoupling cap         100nF                     0402 MLCC       1
C2      Bulk cap (3.3V rail)   10uF / 10V                0805 MLCC       1
C3      Bulk cap (VIN)         100uF / 10V               Through-hole    1
C4      Cap (AMS1117 input)    10uF / 10V                0805            1
C5      Cap (AMS1117 output)   22uF / 10V                0805            1

R1      1-Wire pull-up         4.7kΩ                     0402            1
R2      Battery divider high   100kΩ                     0402            1
R3      Battery divider low    100kΩ                     0402            1
R4      LED current limit      330Ω                      0402            1
R5      I2C SDA pull-up        4.7kΩ                     0402            1
R6      I2C SCL pull-up        4.7kΩ                     0402            1

LED1    Status LED             Green 3mm                 Through-hole    1
BT1     LiPo battery           3.7V 2000mAh              JST-PH 2-pin   1
SW1     Reset / boot button    Tactile 6x6mm             Through-hole    1
ANT1    LoRa antenna           433MHz SMA whip           SMA female      1
CN1     Solar input            JST-XH 2-pin              Header          1
CN2     UART debug             4-pin female header        2.54mm          1


### 1.3  SCHEMATIC NETLIST — FULL PIN CONNECTIONS

Connect every net exactly as listed. Nets in CAPS are named power rails.

─────────────────────────────────────────────────────────
POWER TREE
─────────────────────────────────────────────────────────
CN1 Pin1 (+)  → TP4056 IN+
CN1 Pin2 (-)  → GND
TP4056 BAT+   → BT1 (+)   → C3 (+) → AMS1117 VIN
TP4056 BAT-   → GND
BT1 (-)       → GND
C3  (-)        → GND
AMS1117 VIN   → C4 (+)
AMS1117 GND   → GND
AMS1117 VOUT  → 3V3_RAIL
                3V3_RAIL → C2 (+) → GND
                3V3_RAIL → C5 (+) → GND

Battery monitor divider:
BT1 (+) → R2 → Node_VBAT → R3 → GND
Node_VBAT → U1 GPIO34   (ADC input, reads 0–2.1V, maps to 0–4.2V battery)

─────────────────────────────────────────────────────────
U1  ESP32-WROOM-32
─────────────────────────────────────────────────────────
Pin  Name        Net / Connection
---  ----------  -------------------------------------------
1    GND         GND
2    3V3         3V3_RAIL
3    EN          3V3_RAIL (via 10kΩ pull-up, SW1 pulls to GND for reset)
4    SENSOR_VP   NC
5    SENSOR_VN   NC
6    IO34        Node_VBAT  (battery ADC — input only)
7    IO35        U4_INT     (MPU-6050 interrupt — input only)
8    IO32        NC
9    IO33        NC
10   IO25        NC
11   IO26        U3_DIO0    (LoRa interrupt)
12   IO27        NC
13   IO14        U3_RST     (LoRa reset)
14   IO12        U3_DIO1
15   GND         GND
16   IO13        U3_DIO2
17   SD2         NC
18   SD3         NC
19   CMD         NC
20   CLK         NC
21   SD0         NC
22   SD1         NC
23   IO15        NC
24   IO2         LED1 anode (via R4 330Ω → LED1 → GND)
25   IO0         SW1 (Boot/Reset — other side to GND)
26   IO4         DS18B20_DATA  (1-Wire)
27   IO16        GPS_TX     (UART2 RX on ESP32, receives GPS data)
28   IO17        GPS_RX     (UART2 TX on ESP32, sends to GPS)
29   IO5         U3_NSS     (LoRa SPI chip select)
30   IO18        SPI_SCK    (LoRa)
31   IO19        SPI_MISO   (LoRa)
32   IO21        I2C_SDA    (MPU-6050 + MAX30102)
33   RXD0        CN2 Pin3   (debug UART)
34   TXD0        CN2 Pin4   (debug UART)
35   IO22        I2C_SCL    (MPU-6050 + MAX30102)
36   IO23        SPI_MOSI   (LoRa)
37   GND         GND
38   3V3         3V3_RAIL

─────────────────────────────────────────────────────────
U2  NEO-6M GPS MODULE
─────────────────────────────────────────────────────────
Pin  Name   Net
---  -----  -------------------
1    VCC    3V3_RAIL
2    GND    GND
3    TX     GPS_TX  → U1 IO16
4    RX     GPS_RX  ← U1 IO17
(PPS pin — leave NC for basic use)

─────────────────────────────────────────────────────────
U3  SX1278 / Ra-02 LoRa MODULE
─────────────────────────────────────────────────────────
Pin  Name   Net
---  -----  -------------------
1    GND    GND
2    3.3V   3V3_RAIL
3    MISO   SPI_MISO   → U1 IO19
4    MOSI   SPI_MOSI   ← U1 IO23
5    SCK    SPI_SCK    ← U1 IO18
6    NSS    U3_NSS     ← U1 IO5  (active LOW)
7    DIO0   U3_DIO0    → U1 IO26 (TxDone / RxDone IRQ)
8    DIO1   U3_DIO1    → U1 IO12
9    DIO2   U3_DIO2    → U1 IO13
10   RST    U3_RST     ← U1 IO14
ANT  ANT    ANT1 SMA connector

─────────────────────────────────────────────────────────
U4  MPU-6050 IMU
─────────────────────────────────────────────────────────
Pin  Name   Net
---  -----  ----------------------------
1    VCC    3V3_RAIL
2    GND    GND
3    SCL    I2C_SCL → U1 IO22 (via R6 4.7kΩ pull-up to 3V3)
4    SDA    I2C_SDA → U1 IO21 (via R5 4.7kΩ pull-up to 3V3)
5    XCL    NC
6    XDA    NC
7    AD0    GND   (sets I2C address to 0x68)
8    INT    U4_INT → U1 IO35

─────────────────────────────────────────────────────────
U5  MAX30102 Heart Rate Sensor
─────────────────────────────────────────────────────────
Pin  Name   Net
---  -----  ----------------------------
1    VIN    3V3_RAIL
2    GND    GND
3    SDA    I2C_SDA (same bus as MPU-6050, addr 0x57)
4    SCL    I2C_SCL
5    INT    NC  (optional: → U1 IO36)

─────────────────────────────────────────────────────────
U6  DS18B20 Temperature Sensor (Waterproof probe)
─────────────────────────────────────────────────────────
Wire  Color  Net
----  -----  ---------------------------
Red          3V3_RAIL
Black        GND
Yellow       DS18B20_DATA → U1 IO4
             (R1 4.7kΩ pull-up: DS18B20_DATA → 3V3_RAIL)

─────────────────────────────────────────────────────────
LED1  Status LED
─────────────────────────────────────────────────────────
U1 IO2 → R4 (330Ω) → LED1 Anode → LED1 Cathode → GND

─────────────────────────────────────────────────────────
SW1  Reset / Boot Button
─────────────────────────────────────────────────────────
One leg → U1 IO0 (boot) and U1 EN (reset)
Other leg → GND
(Add 100nF debounce cap across SW1)

─────────────────────────────────────────────────────────
CN2  UART Debug Header (4-pin 2.54mm)
─────────────────────────────────────────────────────────
Pin 1  5V (from TP4056 out, before LDO)
Pin 2  GND
Pin 3  U1 RXD0
Pin 4  U1 TXD0


### 1.4  PCB LAYOUT NOTES (KiCad)

1. Place AMS1117 and its caps (C4, C5) within 5mm of each other
2. Place decoupling caps (C1, C2) within 2mm of ESP32 power pins
3. I2C pull-up resistors R5 and R6 between ESP32 and sensors
4. DS18B20 pull-up R1 close to the IO4 pin
5. SPI traces (MOSI/MISO/SCK) should be <50mm and matched length
6. LoRa module: keep antenna SMA on board edge, no copper pour under antenna
7. GPS module: face antenna skyward (top of enclosure), keep 20mm away from LoRa
8. TP4056 on opposite side from MCU to manage heat
9. Battery JST connector near board edge for easy access
10. Min trace width: 0.2mm signal, 0.5mm power, 1.0mm GND


### 1.5  ENCLOSURE (3D PRINT)
- Size: 80 × 50 × 25mm
- IP54 rating (dust + splash proof)
- DS18B20 probe exits through grommet, touches animal skin under strap
- Solar panel (40 × 70mm) attached to top of enclosure
- Collar strap slots: 2× 30mm wide slots for 25mm livestock collar strap


---

## BOARD 2: BS-01 — PFUMA BASE STATION

### 2.1  BLOCK DIAGRAM

    ┌─────────────────────────────────────────────────────────┐
    │                  BS-01  BASE STATION                     │
    │                                                           │
    │  [12V DC IN]──[LM2596 Buck]──[5V]──[AMS1117]──[3.3V]   │
    │                                                           │
    │  [SX1278 LoRa] ──SPI── [ESP32-WROOM-32] ──WiFi── [AP]  │
    │    433 MHz                    │                  ↓       │
    │  Receives collar              │            Flask API     │
    │  telemetry                    │                          │
    │                        [SSD1306 OLED]                   │
    │                          I2C  128×64                    │
    │                          Local status                   │
    │                                                           │
    │                        [4× LED indicators]              │
    │                         PWR / LoRa / WiFi / Alert       │
    └─────────────────────────────────────────────────────────┘


### 2.2  BOM

Ref     Component             Value / Part         Package       Qty
------  --------------------  -------------------  ------------  ---
U1      MCU                   ESP32-WROOM-32        SMD           1
U2      LoRa Transceiver      SX1278 / Ra-02        SMA           1
U3      OLED Display          SSD1306 128×64        4-pin module  1
U4      Buck Converter        LM2596 (module)       Module        1
U5      LDO Regulator         AMS1117-3.3           SOT-223       1

C1-C4   Decoupling caps       100nF                 0402          4
C5      Bulk cap              100uF / 16V           Through-hole  1

R1-R4   LED resistors         330Ω                  0402          4
R5      I2C SDA pull-up       4.7kΩ                 0402          1
R6      I2C SCL pull-up       4.7kΩ                 0402          1

LED1    Power LED             Green                 3mm           1
LED2    LoRa RX LED           Blue                  3mm           1
LED3    WiFi LED              Yellow                3mm           1
LED4    Alert LED             Red                   3mm           1

CN1     DC Power jack         12V barrel 5.5/2.1mm Through-hole  1
CN2     UART debug            4-pin header          2.54mm        1
ANT1    LoRa antenna          433MHz SMA whip       SMA female    1


### 2.3  SCHEMATIC NETLIST

─────────────────────────────────────────────────────────
POWER TREE
─────────────────────────────────────────────────────────
CN1(+) → LM2596 IN+ → LM2596 OUT (5V) → AMS1117 VIN
CN1(-) → GND
AMS1117 VOUT → 3V3_RAIL
AMS1117 GND  → GND
C5 across LM2596 output (100uF)

─────────────────────────────────────────────────────────
U1  ESP32-WROOM-32  (same pin-out as CN-01)
─────────────────────────────────────────────────────────
IO2  → LED1 (PWR, green)  via R1 330Ω → GND
IO4  → LED2 (LoRa, blue)  via R2 330Ω → GND
IO5  → LED3 (WiFi, yellow) via R3 330Ω → GND  [note: reassign from SPI]
IO15 → LED4 (Alert, red)  via R4 330Ω → GND

SPI (LoRa):
IO18 → SPI_SCK
IO19 → SPI_MISO
IO23 → SPI_MOSI
IO5  → U2_NSS
IO14 → U2_RST
IO26 → U2_DIO0

I2C (OLED):
IO21 → I2C_SDA (R5 4.7kΩ to 3V3)
IO22 → I2C_SCL (R6 4.7kΩ to 3V3)

─────────────────────────────────────────────────────────
U2  SX1278 LoRa (same wiring as CN-01 U3)
─────────────────────────────────────────────────────────
(identical to CN-01 U3 connections above)

─────────────────────────────────────────────────────────
U3  SSD1306 OLED (I2C address 0x3C)
─────────────────────────────────────────────────────────
Pin  Name   Net
---  -----  ----------------
1    GND    GND
2    VCC    3V3_RAIL
3    SCL    I2C_SCL → U1 IO22
4    SDA    I2C_SDA → U1 IO21


---

## NETWORK CAPACITY — HOW MANY COLLARS PER BASE STATION

This is a real, computed answer, not a marketing figure. LoRa airtime was calculated with the standard Semtech formula (AN1200.13) from the *actual* firmware settings in `collar_node.ino` / `base_station.ino`.

### The problem with the original design

The first firmware revision used **SF9 + a verbose JSON payload** (~230 bytes with realistic field values) at a 10s report interval. That works out to **~1.15 seconds of LoRa airtime per packet** — so:

| Collars reporting | Channel utilization | Outcome |
|---|---|---|
| 1 | 11.5% | fine |
| 4 | 45.9% | workable, some collisions |
| 8 (the old hard-coded limit) | **91.8%** | severe collisions — most packets lost |

The `collars[8]` array size in the old firmware implied a capacity the radio link could not actually deliver.

### The fix: SF7 + a compact binary packet

Both `.ino` files now use **SF7** and a **28-byte binary `CollarPacket` struct** (see the struct definition in either firmware file) instead of JSON-over-LoRa — JSON is only built once the base station forwards a reading to the Flask API over WiFi, where airtime is not a constraint. This gets per-packet airtime down to **~72ms**:

| Collars reporting | Channel utilization | Outcome |
|---|---|---|
| 8 | 5.8% | very comfortable |
| 15 | 10.8% | comfortable |
| 20 | 14.4% | comfortable |
| 30 | 21.6% | workable, some collisions but self-healing (next report 10s later) |

`base_station.ino` now tracks up to **`MAX_COLLARS = 40`** locally, matching this real capacity rather than an arbitrary number.

### The trade-off: range

SF7 trades maximum range for airtime. The SF9 "~5km open field" figure quoted elsewhere in this doc was a link-budget maximum, not a typical farm-deployment distance. SF7 on the same SX1278 hardware (17dBm) typically covers **~1-2km on farm terrain** — plenty for a single farm's paddocks in most cases. If your grazing area is unusually large or hilly:

- Raise `LORA_SF` back toward 9 in both firmware files (re-run this same airtime math for your target collar count first — see the formula below), or
- Deploy a second base station rather than pushing more range out of one, or
- Keep SF7 but reduce the report interval's collision risk further by adding a small random jitter to `REPORT_INTERVAL_MS` per collar (recommended regardless — see "Further improvements" below).

### The airtime formula, if you change any of this

```
Ts_ms          = 2^SF / BW * 1000
T_preamble_ms  = (preamble_symbols + 4.25) * Ts_ms      // preamble_symbols = 8 (library default)
n_payload_syms = 8 + max(ceil((8*PL - 4*SF + 28 + 16*CRC - 20*IH) / (4*(SF - 2*DE))) * (CR + 4), 0)
T_payload_ms   = n_payload_syms * Ts_ms
airtime_ms     = T_preamble_ms + T_payload_ms

channel_utilization(N collars) = N * (airtime_ms / 1000) / report_interval_s
```
Where `PL` = payload bytes, `CRC=1`, `IH=0` (explicit header), `DE=0` (low data rate optimization off, not needed below SF11 at 125kHz), `CR=1` (for the firmware's 4/5 coding rate). Keep `channel_utilization` under ~20-25% for reliable delivery with occasional retries; under ~10% for near-zero collision loss.

### Further improvements (not yet implemented)

- **Per-collar TX jitter**: add `+random(0, 1500)` ms to each collar's report interval so collars don't clock-drift into transmitting simultaneously — cheap insurance against the "worst case all N collars fire at once" scenario the utilization math assumes.
- **Multiple base stations**: for herds beyond ~30 head or farms with dead zones, add a second BS-01 rather than over-loading one channel — each is inexpensive (~$25-43, see `BUDGET_PROPOSAL.md`).
- **Frequency/channel planning**: if you deploy multiple base stations covering overlapping areas, give them different sync words or frequencies within the 433MHz ISM band to avoid one base station hearing another's collars as noise. Confirm your local ISM-band duty-cycle/channel rules with POTRAZ before a multi-station commercial deployment.

---

## PROTEUS SIMULATION GUIDE

### Which Proteus library components to use:

Real Component        Proteus Library Name              Category
--------------------  --------------------------------  ------------------
ESP32-WROOM-32        Search "ESP32" in Proteus 8.13+   Microcontrollers
  (if not found)      Use: Arduino Mega 2560             (remap pins in FW)

DS18B20               DS18B20                           Transducers
  pull-up R           MINRES4K7                         Resistors

MPU-6050              Not in std library — simulate with:
  Accel X/Y/Z         POT-HG (3× potentiometers)        Mechanics
  I2C data to MCU     COMPIM → Virtual Terminal

MAX30102              Not in std library — simulate with:
  Heart Rate          POT-HG (1× potentiometer)

NEO-6M GPS            Not in std library — simulate with:
                      COMPIM (serial port bridge)
                      Feed NMEA sentences from PC port

SX1278 LoRa           Not in std library — simulate with:
                      RF coupling between two COMPIM     —
                      Or: Virtual Wire between 2 nodes

AMS1117-3.3           VREG (voltage regulator)          Power ICs
TP4056                Not in library — use DC power src  Power
Battery               BATTERY                           Sources
Solar panel           DC voltage source (5V, 0.2A)      Sources

SSD1306 OLED          OLED-128X64 (if available)        Optoelectronics
                      Or: LCD-016N002B (text mode alt)

LED indicators        LED-GREEN / LED-BLUE / LED-RED    Optoelectronics
Resistors             MINRES330R / MINRES4K7            Resistors
Capacitors            CAP-NP (non-polar)                Capacitors


### Proteus Simulation Setup — Collar Node (Simplified)

Components to place:
1. Arduino Mega 2560 (as ESP32 proxy)
2. DS18B20 — connect DATA to D4, VCC to 5V, GND to GND, 4.7kΩ pull-up to 5V
3. POT-HG × 3 — connect wipers to A0(HR), A1(accel-X), A2(accel-Y)
4. BATTERY (3.7V) → VREG → 5V rail
5. Virtual Terminal — connect to TX0/RX0 for JSON debug output
6. COMPIM — bridge to real serial for GPS NMEA injection (optional)
7. LED-GREEN on D2 via 330Ω → GND
8. BUZZER on D3 → GND (theft alert)
9. POT-HG wiper on A3 → represents GPS latitude drift (0-5V = -18 to -17 lat)

### Virtual instruments to add:
- Oscilloscope on DS18B20 DATA line (view one-wire pulses)
- Logic Analyser on SPI lines (view LoRa packet bytes)
- Virtual Terminal on UART0 (view JSON telemetry)
- DC Voltmeter on battery node (watch voltage drop simulation)


---

## KICAD SCHEMATIC GUIDE

### Recommended symbol libraries to enable:
- Device (resistors, caps, connectors)
- MCU_Espressif (ESP32-WROOM-32)
- Sensor_Temperature (DS18B20)
- RF_Module (SX1278 — or use Generic Module)
- Regulator_Linear (AMS1117-3.3)
- Regulator_Switching (LM2596)
- LED (LED_Small)

### Symbol search terms for each component:
Component         KiCad Symbol Search
--------------    ----------------------------
ESP32-WROOM-32    MCU_Espressif:ESP32-WROOM-32
DS18B20           Sensor_Temperature:DS18B20
SX1278 LoRa       RF_Module:RFM95W  (pin-compatible, relabel)
MPU-6050          Sensor_Motion:MPU-6050
MAX30102          (add from community lib or use Sensor_Optical:Generic)
NEO-6M GPS        RF_GPS:NEO-6M
AMS1117-3.3       Regulator_Linear:AMS1117-3.3
TP4056            Battery_Management:TP4056
SSD1306           Display:SSD1306  (from community lib)
LM2596            Regulator_Switching:LM2596

### Recommended footprints:
Component         Footprint
--------------    ----------------------------------------------
ESP32-WROOM-32    RF_Module:ESP32-WROOM-32
DS18B20           Package_TO_SOT_THT:TO-92_Inline
SX1278 Ra-02      RF_Module:AI-Thinker_Ra-02  (or custom)
MPU-6050          Package_QFN:QFN-24_4x4mm_P0.5mm
AMS1117           Package_TO_SOT_SMD:SOT-223-3_TabPin2
0402 passives     Resistor_SMD:R_0402_1005Metric
0805 caps         Capacitor_SMD:C_0805_2012Metric
SSD1306 module    Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm

### KiCad project folder structure (recommended):
  hardware/
  ├── collar_node/
  │   ├── collar_node.kicad_pro
  │   ├── collar_node.kicad_sch
  │   ├── collar_node.kicad_pcb
  │   └── firmware/
  │       └── collar_node.ino
  └── base_station/
      ├── base_station.kicad_pro
      ├── base_station.kicad_sch
      ├── base_station.kicad_pcb
      └── firmware/
          └── base_station.ino


---

## PIN DEFINITIONS SUMMARY (copy into firmware)

// CN-01 Collar Node — ESP32 GPIO map
#define PIN_ONE_WIRE     4    // DS18B20 data
#define PIN_LORA_NSS     5    // LoRa chip select
#define PIN_LORA_DIO1   12    // LoRa DIO1
#define PIN_LORA_DIO2   13    // LoRa DIO2
#define PIN_LORA_RST    14    // LoRa reset
#define PIN_LED          2    // Status LED
#define PIN_GPS_RX      16    // UART2 RX (GPS TX feeds here)
#define PIN_GPS_TX      17    // UART2 TX (to GPS RX)
#define PIN_LORA_SCK    18    // SPI clock
#define PIN_LORA_MISO   19    // SPI MISO
#define PIN_I2C_SDA     21    // MPU-6050 + MAX30102
#define PIN_I2C_SCL     22    // MPU-6050 + MAX30102
#define PIN_LORA_MOSI   23    // SPI MOSI
#define PIN_LORA_DIO0   26    // LoRa interrupt
#define PIN_VBAT_ADC    34    // Battery voltage (input only)
#define PIN_MPU_INT     35    // MPU-6050 interrupt (input only)
#define I2C_ADDR_MPU  0x68   // MPU-6050 (AD0=GND)
#define I2C_ADDR_MAX  0x57   // MAX30102
#define LORA_FREQ   433E6    // 433 MHz


---

## FIRMWARE DEPENDENCIES (Arduino IDE / PlatformIO)

Library                     Install via
--------------------------  -------------------------------------------
OneWire                     Arduino Library Manager
DallasTemperature           Arduino Library Manager
MPU6050 (ElectronicCats)    Arduino Library Manager
SparkFun MAX3010x           Arduino Library Manager
TinyGPSPlus                 Arduino Library Manager
LoRa (Sandeep Mistry)       Arduino Library Manager
ArduinoJson                 Arduino Library Manager
WiFi                        Built-in (ESP32 board package)
HTTPClient                  Built-in (ESP32 board package)

ESP32 board package URL:
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
