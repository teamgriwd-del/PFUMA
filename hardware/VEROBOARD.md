# PFUMA — Veroboard build (current build path)

Hand-soldered stripboard versions of **BS-02** (base station) and **CN-02**
(collar node). This is what is actually being built. The etched PCBs in
[`kicad/`](kicad/README.md) are on hold.

Placement is by hand; **cuts and wire links are derived by script** from the
same netlist the PCBs passed DRC against, so the build sheets cannot drift out
of step with the electrical design.

---

## The red X — read this first

**A red X means: cut the copper strip at that point.**

Veroboard strips join *every hole in a row*. Two different nets sharing one
row are shorted together. A cut breaks the strip so one row can serve two
different nets — copper to the left of the cut, copper to the right, no
connection between them.

Cut with a 3 mm drill bit twisted by hand, or a spot-cutter. Cut on the
**copper side**, and check each one with a meter: probe either side of the X,
it must read **open circuit**.

### Why all 19 strips under the devkit must be cut

The ESP32 devkit straddles 19 strips. Every one carries a different pin on
each side, so every one has to be cut. The trap is that "unused" pins are not
no-connects — they are live pins:

| Row | Left pin | Right pin | If you skip the cut |
|---|---|---|---|
| first | **3V3** (devkit output) | **GND** | regulator output shorted to ground |
| — | EN | IO23 | chip held in reset |
| — | SD2 / SD3 / CMD | SD1 / SD0 / CLK | flash pins loaded, will not boot |

**Cut them before the devkit goes in.** Once it is fitted you cannot reach them.

---

## Colour key on the layout PDFs

| Colour | Meaning |
|---|---|
| **Gold bars** | copper strip (runs left–right) |
| **Red X** | cut the strip here |
| **Blue** | insulated wire link, soldered on the component side |
| **Black** | part outlines and labels |
| Grey rings | unused holes |

Hole addresses are `(col, row)`; numbers run along the top and both sides.

---

## Print these four

| File | What it is |
|---|---|
| `vero_kicad/BS-02-VERO-print.pdf` | BS-02 board layout |
| `vero_kicad/CN-02-VERO-print.pdf` | CN-02 board layout |
| `VERO_BS02_BOOK.pdf` | BS-02 build book, 8 pages |
| `VERO_CN02_BOOK.pdf` | CN-02 build book, 8 pages |

Print at **100%**, not fit-to-page. Each book has: cut list with tick boxes and
what each cut separates, the strip map, every pin and its hole, the wire-link
checklist, and the pre-power meter checks.

| | BS-02 | CN-02 |
|---|---|---|
| Strip cuts | 19 | 30 |
| Wire links | 15 | 27 |
| Nets | 21 | 23 |
| Board | 136 x 119 mm | 136 x 122 mm |

Both fit a standard 100 x 160 mm stripboard. **Build BS-02 first** — fewer
cuts, no battery, and it proves the method before CN-02 spends parts.

---

## Build order

1. **Cut every strip** on the cut list. Meter each one: must read open.
2. **Fit the power section only.** No devkit, no battery.
3. **Power up and measure** against the GND rail:
   * BS-02 — feed 5 V into the terminal block, confirm the 3.3 V rail
   * CN-02 — feed 5 V into CN4 first, confirm 3.3 V, *then* connect the LiPo
4. Fit the devkit, then the wire links, then the peripherals.
5. **Fit the antenna before the Ra-02 ever transmits.**

Before power, meter GND against +3V3, +5V and VBAT/+12V. All must read open.

---

## Power input

**BS-02 runs from a 5 V supply on a 2-pin screw terminal (CN1).** No 12 V, and
**no LM2596** — the buck module is not used on this board. 5 V goes straight to
the 5 V rail; the LM1117 drops it to 3.3 V.

CN1's two pins sit on rows 1 and 3, which is 5.08 mm apart — the usual screw
terminal pitch. If your block is 3.5 mm pitch it will not straddle two holes;
use flying leads instead.

**CN-02 runs from the LiPo**: battery -> TP4056 -> MT3608 -> 5 V -> LM1117 ->
3.3 V. Charge by plugging USB into the TP4056 module itself.

---

## Parts that do not fit the 2.54 mm grid

| Part | Problem | Handling |
|---|---|---|
| **Ra-02 LoRa** | 2.0 mm pitch | short flying leads to the landing holes; each landing hole already sits on the right strip |
| **LM1117** | SOT-223, surface mount | legs bend onto three adjacent strips — the bus order is GND, 3V3, 5V so it drops straight on. Tab is the 3V3 output |
| **MT3608 / TP4056** | pads at both ends | flying leads |

Resistors stand **vertically** — body up, one lead bent over — so they span one
hole. R5/R6 are not fitted at all: the sensor breakouts carry their own I2C
pull-ups.

**No solar on CN-02.** The TP4056 charges through its own micro-USB; charging
is a manual step with no charge path through the board.

---

## Two I2C buses on CN-02

The MAX30102 is **not** on the same bus as the MPU-6050. It runs on the ESP32's
second I2C controller:

| Bus | SDA | SCL | Devices |
|---|---|---|---|
| Wire  | GPIO21 | GPIO22 | MPU-6050 (0x68) |
| Wire1 | **GPIO25** | **GPIO27** | MAX30102 (0x57) |

**The firmware must be changed to match** or the MAX30102 will not be found:

```cpp
Wire1.begin(25, 27);                          // SDA 25, SCL 27
particleSensor.begin(Wire1, I2C_SPEED_FAST);  // MAX30102 on the second bus
```

The MPU-6050 code is unchanged. Neither GPIO25 nor GPIO27 is a strapping pin,
and both breakouts carry their own pull-ups, so no resistors are needed.

---

## Verification

Both veroboards are also real KiCad files (`vero_kicad/*.kicad_pcb`), with
holes as pads, strips as bottom-layer tracks broken at the cuts, and links as
top-layer tracks. KiCad reports **0 unconnected items on both boards** — it
traced every net through the strips, cuts and links and found all of them
joined.

DRC still reports crossings and shorts. Those are an artifact: the links are
modelled as copper on one layer, so two insulated wires crossing look like a
short to KiCad. **The strip side is clean** — no cut is missing and no two nets
share a segment.

Open in KiCad with the **Veroboard** colour theme
(Preferences → PCB Editor → Colors) or the default dark theme makes it
unreadable. These files are a drawing of a stripboard, **not a manufacturable
PCB** — do not send them to a fab.

---

## Still open

1. **Antenna frequency.** The invoice line reads 868 MHz; the SX1278 is a
   433 MHz part. Check the label before transmitting.
2. **100 k resistors** for the CN-02 battery divider (R2/R3) are not on either
   invoice. 10 k would draw about 210 uA continuously off the cell.
3. **DevKit row pitch** is assumed 25.4 mm. Measure centre-to-centre between
   the two pin rows.
4. **Module pin order** — check the silkscreen on your actual SSD1306 (GND/VCC
   order varies) and NEO-6M before soldering.

---

## Regenerating

```
python vero.py          # layout, cuts, wire links
python vero_pins.py     # strip map + per-pin schedule (txt)
python vero_print.py    # A4 build books (html -> pdf via Chrome)
<kicad-python> vero_kicad.py   # the .kicad_pcb versions
```

Placement lives in `vero.py`; cuts and links are always re-derived, never
hand-edited.
