# PFUMA — Hardware Budget Proposal
# Team GRIWD | Zimbabwe Agricultural Show 2026
# Prepared: 2026-06-23

---

## EXECUTIVE SUMMARY

PFUMA requires two custom IoT hardware units:

| Unit | Description | Role |
|------|-------------|------|
| **CN-01** | PFUMA Collar Node | Worn on animal — senses, transmits |
| **BS-01** | PFUMA Base Station | Fixed at farm — receives, relays to cloud |

All prices are in **USD**. Online sourcing (AliExpress / LCSC) is the baseline.
A **+40% local premium** is applied for the Zimbabwe local market estimate.

---

## SECTION 1 — CN-01 COLLAR NODE: BILL OF MATERIALS

Per single unit.

| Ref | Component | Specification | Online (USD) | Local Est. (USD) |
|-----|-----------|---------------|-------------|-----------------|
| U1 | ESP32-WROOM-32 | Dual-core MCU + WiFi/BT | $4.00 | $6.50 |
| U2 | NEO-6M GPS Module | UART, patch antenna | $5.00 | $7.50 |
| U3 | SX1278 Ra-02 LoRa | 433 MHz, SMA, SPI | $4.00 | $6.00 |
| U4 | MPU-6050 IMU | 6-axis, I2C 0x68 | $1.50 | $2.50 |
| U5 | MAX30102 Heart Rate | PPG sensor, I2C 0x57 | $3.00 | $4.50 |
| U6 | DS18B20 Waterproof probe | 1-Wire, body temp | $2.50 | $3.50 |
| U7 | TP4056 Module w/ protection | LiPo charge controller | $0.80 | $1.50 |
| U8 | AMS1117-3.3 LDO | 3.3V regulator, SOT-223 | $0.20 | $0.50 |
| U9 | MT3608 Boost (optional) | 3.7V → 5V if needed | $0.40 | $0.80 |
| BT1 | LiPo Battery | 3.7V 2000mAh, JST-PH | $4.00 | $6.00 |
| SP1 | Solar Panel | 40×70mm, 5V 100mA | $2.00 | $3.50 |
| ANT1 | LoRa Antenna | 433MHz SMA whip | $1.50 | $2.50 |
| C1–C5 | Capacitors (5 values) | 100nF, 10uF, 100uF, 22uF | $0.60 | $1.00 |
| R1–R6 | Resistors (6 values) | 4.7kΩ ×3, 100kΩ ×2, 330Ω | $0.30 | $0.60 |
| LED1 | Status LED | Green 3mm | $0.10 | $0.20 |
| SW1 | Tactile Button | 6×6mm | $0.10 | $0.20 |
| CN1 | JST-XH 2-pin | Solar input connector | $0.20 | $0.40 |
| CN2 | 4-pin Female Header | 2.54mm UART debug | $0.10 | $0.20 |
| PCB | Custom PCB (CN-01) | 80×50mm, 2-layer | $2.00 | $5.00 |
| ENC | 3D-printed Enclosure | IP54, 80×50×25mm | $6.00 | $12.00 |
| STR | Livestock Collar Strap | 25mm nylon, adjustable | $1.50 | $2.50 |
| **TOTAL (1 unit)** | | | **$39.80** | **$67.90** |

---

## SECTION 2 — BS-01 BASE STATION: BILL OF MATERIALS

Per single unit.

| Ref | Component | Specification | Online (USD) | Local Est. (USD) |
|-----|-----------|---------------|-------------|-----------------|
| U1 | ESP32-WROOM-32 | MCU + WiFi | $4.00 | $6.50 |
| U2 | SX1278 Ra-02 LoRa | 433 MHz, SMA, SPI | $4.00 | $6.00 |
| U3 | SSD1306 OLED | 128×64, I2C 0x3C | $3.00 | $4.50 |
| U4 | LM2596 Buck Module | 12V → 5V step-down | $1.50 | $2.50 |
| U5 | AMS1117-3.3 LDO | 3.3V regulator | $0.20 | $0.50 |
| ANT1 | LoRa Antenna | 433MHz SMA whip | $1.50 | $2.50 |
| C1–C5 | Capacitors | 100nF ×4, 100uF/16V | $0.50 | $0.90 |
| R1–R6 | Resistors | 330Ω ×4, 4.7kΩ ×2 | $0.30 | $0.60 |
| LED1–4 | Indicator LEDs | Green, Blue, Yellow, Red 3mm | $0.40 | $0.80 |
| CN1 | 12V DC Barrel Jack | 5.5/2.1mm, panel mount | $0.30 | $0.60 |
| CN2 | 4-pin Header | 2.54mm UART debug | $0.10 | $0.20 |
| PCB | Custom PCB (BS-01) | 2-layer | $2.00 | $5.00 |
| ENC | Project Box Enclosure | ABS, 120×80×40mm | $4.00 | $7.00 |
| PWR | 12V DC Adapter | 1A wall supply | $3.00 | $5.00 |
| **TOTAL (1 unit)** | | | **$24.80** | **$42.60** |

---

## SECTION 3 — DEVELOPMENT & PROTOTYPING TOOLS

One-time costs for the development team.

| Item | Purpose | Cost (USD) |
|------|---------|-----------|
| Proteus 8 Professional | Circuit simulation & PCB (existing or purchase) | $0 (existing) |
| KiCad 7 | PCB schematic/layout export for manufacture | Free |
| Arduino IDE / PlatformIO | Firmware compilation & upload | Free |
| USB-to-Serial adapter (CH340) | Firmware flashing + debug | $2.00 |
| Multimeter | Hardware testing | $8.00 |
| Soldering iron + solder | PCB assembly | $15.00 |
| Breadboard + jumper wires | Prototyping before PCB | $5.00 |
| Logic analyser (Saleae-compatible) | SPI/I2C debugging | $10.00 |
| **Tools Sub-total** | | **$40.00** |

---

## SECTION 4 — BACKEND INFRASTRUCTURE

| Item | Description | Cost (USD/mo) | Annual (USD) |
|------|-------------|--------------|-------------|
| VPS / Cloud Server | Flask API + MySQL hosting | $5.00 | $60.00 |
| Domain name | pfumalivestockafrica.com or similar | — | $12.00 |
| SSL Certificate | HTTPS for API | Free (Let's Encrypt) | $0 |
| **Infrastructure Sub-total** | | | **$72.00** |

---

## SECTION 5 — DEPLOYMENT SCENARIOS & TOTAL BUDGET

### Scenario A — Demo / Zimbabwe Agricultural Show Prototype
Minimum viable demo: **2 collar nodes + 1 base station**

| Item | Qty | Unit Cost | Total (Online) | Total (Local) |
|------|-----|-----------|---------------|--------------|
| CN-01 Collar Node | 2 | $39.80 | $79.60 | $135.80 |
| BS-01 Base Station | 1 | $24.80 | $24.80 | $42.60 |
| Dev Tools (one-off) | — | — | $40.00 | $40.00 |
| Infrastructure (yr 1) | — | — | $72.00 | $72.00 |
| **SCENARIO A TOTAL** | | | **$216.40** | **$290.40** |

---

### Scenario B — Pilot Farm (10 Animals, 1 Farm)
**10 collar nodes + 2 base stations** (dual coverage, redundancy)

| Item | Qty | Unit Cost | Total (Online) | Total (Local) |
|------|-----|-----------|---------------|--------------|
| CN-01 Collar Node | 10 | $39.80 | $398.00 | $679.00 |
| BS-01 Base Station | 2 | $24.80 | $49.60 | $85.20 |
| Dev Tools (one-off) | — | — | $40.00 | $40.00 |
| Infrastructure (yr 1) | — | — | $72.00 | $72.00 |
| Contingency (10%) | — | — | $55.96 | $87.62 |
| **SCENARIO B TOTAL** | | | **$615.56** | **$963.82** |

---

### Scenario C — Commercial Rollout (50 Animals, 3 Farms)
**50 collar nodes + 6 base stations**

| Item | Qty | Unit Cost | Total (Online) | Total (Local) |
|------|-----|-----------|---------------|--------------|
| CN-01 Collar Node | 50 | $35.00* | $1,750.00 | $2,975.00 |
| BS-01 Base Station | 6 | $22.00* | $132.00 | $224.40 |
| Dev Tools (one-off) | — | — | $40.00 | $40.00 |
| Infrastructure (yr 1) | — | — | $180.00 | $180.00 |
| Contingency (10%) | — | — | $210.20 | $341.94 |
| **SCENARIO C TOTAL** | | | **$2,312.20** | **$3,761.34** |

*Bulk order discount ~12% applied at 50 units.

---

## SECTION 6 — PER-UNIT COST SUMMARY

| Board | Online Sourcing | Local (ZW) | Notes |
|-------|----------------|-----------|-------|
| CN-01 Collar Node | **$39.80** | **$67.90** | Includes enclosure, strap, battery, solar |
| BS-01 Base Station | **$24.80** | **$42.60** | Includes enclosure, 12V adapter |
| **System set (1+1)** | **$64.60** | **$110.50** | One collar + one gateway station |

---

## SECTION 7 — SOURCING NOTES

| Supplier | Components | Delivery to ZW | Notes |
|----------|-----------|---------------|-------|
| AliExpress | All modules (ESP32, GPS, LoRa, sensors) | 3–6 weeks | Cheapest unit price |
| LCSC Electronics | Passive components, ICs | 2–4 weeks | Better for SMD passives |
| PCBWay / JLCPCB | Custom PCBs (CN-01, BS-01) | 2–3 weeks | Min 5 boards/order |
| Local (Harare, Joburg) | Wires, connectors, enclosures | Same day | Higher unit price |
| Takealot (SA) | Arduino-compatible modules | 1 week | ~20% premium, reliable |

**Recommended approach for the Zimbabwe Agricultural Show:**
Order online for prototype build, allow 4–6 weeks lead time. Source connectors, solder, and consumables locally for immediate availability.

---

## SECTION 8 — RISK & CONTINGENCY

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Shipping delays | Medium | High | Order 6 weeks early |
| Component out of stock | Low | Medium | Identify substitutes (e.g., RA-01 for Ra-02) |
| PCB manufacturing defect | Low | Medium | Order 5-pack minimum, test before assembly |
| Customs duty (ZW) | High | Medium | Budget +15% for import duty |
| Component damage during assembly | Low | Low | Order 10% extra passives |

**Recommended contingency: 10–15% on top of hardware totals.**

---

## APPENDIX — QUICK REFERENCE: COMPONENT SUBSTITUTES

| Primary | Substitute | Notes |
|---------|-----------|-------|
| ESP32-WROOM-32 | ESP32-DevKitC (dev board) | Easier for prototyping, larger form factor |
| SX1278 Ra-02 | EBYTE E32-433T20D | More range, same LoRa protocol |
| MAX30102 breakout | AD8232 ECG module | Heart rate only (no SpO2), cheaper |
| NEO-6M | NEO-M8N | Better accuracy, slightly more expensive |
| AMS1117-3.3 | MCP1700-3302E | Lower quiescent current (better battery life) |
| LiPo 2000mAh | 18650 Li-Ion cell | Widely available in ZW, needs holder |

---

*PFUMA — Team GRIWD | teamgriwd@gmail.com*
*Zimbabwe Agricultural Show 2026*
