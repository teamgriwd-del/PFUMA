# Actual Equipment — What You're Ordering

Reference photos and exact search/order terms for the **real, physical components** used in CN-01 (collar) and BS-01 (base station) — matching [`hardware/HARDWARE_DESIGN.md`](../HARDWARE_DESIGN.md) and the wiring diagrams ([`PFUMA_CN01_Wiring_Diagram.pdf`](../../PFUMA_CN01_Wiring_Diagram.pdf), [`PFUMA_BS01_Wiring_Diagram.pdf`](../../PFUMA_BS01_Wiring_Diagram.pdf)) exactly. Full pricing and supplier comparison: [`BUDGET_PROPOSAL.md`](../../BUDGET_PROPOSAL.md).

**Honesty note:** only 3 of the components below have a verified, correctly-matched reference photo in this folder (sourced from Wikimedia Commons, properly licensed and attributed — see each entry). For the rest, a web search turned up no openly-licensed photo I could confirm actually matches the exact variant our BOM specifies (e.g. the DS18B20 search only surfaced the bare TO-92 chip, not the waterproof cable-probe version we actually use — using that photo would have been misleading, so it's skipped rather than guessed). Use the exact search term given for each to find and verify the part yourself before ordering.

## Photos included in this folder

| File | Component | Source | License |
|---|---|---|---|
| `01_ESP32-WROOM-32_devkit.jpg` | ESP32-WROOM-32 DevKit (U1 on both CN-01 and BS-01) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ESP32_Espressif_ESP-WROOM-32_Dev_Board.jpg), photo by Ubahnverleih | CC0 1.0 (public domain) |
| `04_MPU-6050_GY521.jpg` | MPU-6050 IMU, GY-521 breakout (U4 on CN-01) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:GY-521_MPU-6050_Module_3_Axis_Gyroscope_%2B_Accelerometer_0487.jpg), photo by Nevit Dilmen | CC BY-SA 3.0 — credit "© Nevit Dilmen" if reused elsewhere |
| `12_LM2596_buck_converter.jpg` | LM2596 buck converter module (U4 on BS-01) — shown alongside two other converter types in the same photo, LM2596 is the labelled one | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:LM2596_buck_converter_module,_MP1584_buck_converter_module,_and_SDB628_boost_converter_module.jpg), photo by Matthew Berardi (Metaquanta) | CC BY-SA 4.0 — credit "Matthew Berardi" if reused elsewhere |

## Full component list — CN-01 Collar Node

| Ref | Component | Photo? | Exact search term to order | Typical price (see BUDGET_PROPOSAL.md) |
|---|---|---|---|---|
| U1 | ESP32-WROOM-32 DevKit | ✅ | "ESP32-WROOM-32 development board 38 pin" | $4.00 online / $6.50 local |
| U2 | NEO-6M GPS module + ceramic antenna | — | "NEO-6M GPS module UART ublox" | $5.00 / $7.50 |
| U3 | SX1278 / Ra-02 LoRa module, 433MHz, SMA | — | "SX1278 Ra-02 LoRa module 433MHz SPI" | $4.00 / $6.00 |
| U4 | MPU-6050 IMU, GY-521 breakout | ✅ | "MPU-6050 GY-521 6-axis accelerometer gyroscope module" | $1.50 / $2.50 |
| U5 | MAX30102 heart-rate/SpO2 sensor breakout | — | "MAX30102 heart rate pulse oximeter sensor module" | $3.00 / $4.50 |
| U6 | DS18B20 **waterproof** temperature probe | — | "DS18B20 waterproof temperature sensor probe stainless steel" — make sure it's the cable+steel-tip version, not the bare TO-92 chip | $2.50 / $3.50 |
| U7 | TP4056 charge controller with protection | — | "TP4056 lithium battery charger module with protection" | $0.80 / $1.50 |
| U8 | AMS1117-3.3 LDO regulator breakout | — | "AMS1117-3.3 voltage regulator breakout board" | $0.20 / $0.50 |
| U9 | MT3608 boost converter (optional) | — | "MT3608 DC-DC boost converter module" | $0.40 / $0.80 |
| BT1 | LiPo battery 3.7V 2000mAh, JST-PH connector | — | "3.7V 2000mAh lipo battery JST connector" | $4.00 / $6.00 |
| SP1 | Solar panel, 40x70mm, 5V ~100mA | — | "5V solar panel small 40x70mm epoxy" | $2.00 / $3.50 |
| ANT1 | SMA antenna, 433MHz whip | — | "433MHz SMA antenna whip" | $1.50 / $2.50 |
| — | DS18B20 pull-up resistor, I2C pull-ups, LED resistor, capacitors, tactile button, JST/header connectors | — | generic passives — see full BOM table in [`HARDWARE_DESIGN.md`](../HARDWARE_DESIGN.md#12--components-bom) | ~$1.30 total |
| ENC | 3D-printed enclosure, 80x50x25mm, IP54 | — | print from your own design or commission locally | $6.00 / $12.00 |
| STR | Livestock collar strap, 25mm nylon | — | "25mm nylon livestock collar strap adjustable" | $1.50 / $2.50 |

## Full component list — BS-01 Base Station

| Ref | Component | Photo? | Exact search term to order | Typical price |
|---|---|---|---|---|
| U1 | ESP32-WROOM-32 DevKit | ✅ (same photo as CN-01) | "ESP32-WROOM-32 development board 38 pin" | $4.00 / $6.50 |
| U2 | SX1278 / Ra-02 LoRa module | — | same as CN-01 U3 above | $4.00 / $6.00 |
| U3 | SSD1306 OLED, 128x64, I2C, 0x3C | — | "SSD1306 0.96 inch OLED display I2C 128x64" | $3.00 / $4.50 |
| U4 | LM2596 buck converter module (12V→5V) | ✅ | "LM2596 DC-DC step down buck converter module" | $1.50 / $2.50 |
| U5 | AMS1117-3.3 LDO regulator | — | same as CN-01 U8 above | $0.20 / $0.50 |
| — | 4x indicator LEDs (green/blue/yellow/red), resistors, capacitors | — | generic passives — see full BOM table in `HARDWARE_DESIGN.md` | ~$1.20 total |
| CN1 | 12V DC barrel jack, 5.5/2.1mm | — | "12V DC barrel jack panel mount 5.5x2.1mm" | $0.30 / $0.60 |
| ANT1 | SMA antenna, 433MHz whip | — | same as CN-01 ANT1 above | $1.50 / $2.50 |
| PWR | 12V DC wall adapter, 1A | — | "12V 1A DC power adapter barrel jack" | $3.00 / $5.00 |
| ENC | Project box enclosure, 120x80x40mm | — | "ABS project box enclosure 120x80x40mm" | $4.00 / $7.00 |

## Before you order

1. Cross-check every part number against [`HARDWARE_DESIGN.md`](../HARDWARE_DESIGN.md) §1.2/§2.2 (full BOM with exact package/footprint) — this README is a shopping aid, that file is the source of truth.
2. Read [`../../IOT_HARDWARE_GUIDE.md`](../../IOT_HARDWARE_GUIDE.md) §1 for the full build/flash/pair walkthrough once parts arrive.
3. Note the firmware now ships at **SF7** (not SF9) — see the `LORA_SF` comment in both `.ino` files and the "Network Capacity" section of `HARDWARE_DESIGN.md` for why, and the range trade-off (~1-2km typical farm terrain instead of ~5km open-field) this implies. If your grazing area is unusually large or hilly, that's a deliberate trade-off you may want to revisit before ordering antennas/enclosures.
