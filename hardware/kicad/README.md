# PFUMA Rev B — KiCad single-sided PCBs

> **On hold.** The current build path is the hand-soldered stripboard version
> — see [`../VEROBOARD.md`](../VEROBOARD.md). These etched-PCB files stay valid
> and DRC-clean, but nothing here is being fabricated right now. Note the PCBs
> still carry the CN-02 solar header (CN2 / VSOL), which has been dropped from
> the veroboard build.

Real KiCad 10 boards for **BS-02** (base station) and **CN-02** (collar node),
generated from script so the layout is reproducible and reviewable.

```
kicad/
  pcbkit.py     board, footprints, nets, GND pour, save
  router.py     A* maze router (single layer, turn-penalised)
  linker.py     fits wire links on F.Cu where the bottom layer cannot resolve
  bs02.py       BS-02 board definition   (140 x 120 mm)
  cn02.py       CN-02 board definition   (150 x 140 mm)
  wirelist.py   turns the DRC report into a build sheet
  BS-02/  CN-02/    .kicad_pcb, drc.txt, WIRES_TO_FIT.txt, gerbers/
```

Regenerate (KiCad's bundled Python has `pcbnew`):

```
"%LOCALAPPDATA%\Programs\KiCad\10.0\bin\python.exe" bs02.py
```

## How to read these boards

**Single-sided.** All etched copper is on **B.Cu**. Drawn as seen from the
component side, so **mirror B.Cu horizontally** before toner transfer or
single-layer CNC. Get this wrong and every board is scrap.

**GND is the pour** plus an explicit bottom-copper tree. Pads tie in with
thermal reliefs.

**F.Cu is not etched.** It carries wire links only — insulated hookup wire
soldered on the component side. Use the F.Cu Gerber as the wiring guide, and
`WIRES_TO_FIT.txt` for the remaining connections the router could not place.

**U2 / U3 Ra-02 solders on the copper side.** It is a castellated SMD module,
so on a single-sided board it mounts on the bottom, facing the copper. All
other modules sit on the component side on 2.54 mm female headers. Each LoRa
signal is broken out to a through-hole header (J1 / J2) so it can also be
reached by a wire link.

## Design rules (chosen for DIY etching)

| | |
|---|---|
| Signal / 3V3 / power trace | 0.8 / 1.2 / 2.0 mm |
| Clearance | 0.5 mm |
| Wire links (F.Cu) | 0.4 mm |
| Drills | 1.0 mm headers, 3.2 mm mounting |
| Vias | none |

## Where the pin data came from

* GPIO assignments: `collar_node.ino` / `base_station.ino`, cross-checked
  against `HARDWARE_DESIGN.md` §1.3 / §2.3. Firmware wins where they disagree
  — the doc puts the yellow WiFi LED on GPIO5, which is already LoRa NSS.
* Ra-02 pin map: KiCad's own `Ai-Thinker-Ra-02` symbol (pin 1 GND, 15 NSS).
* ESP32 module: BOM specifies the **38-pin DevKit**, so U1 is two 1x19 headers
  on a 25.4 mm row pitch.

## Verify before you etch

1. **DevKit row pitch.** Set to 25.4 mm (`LX`, `RX` in the board script).
   DevKitC V4 boards are 22.86 mm. Measure yours; change one constant and
   re-run if it differs.
2. **Module pin order.** Every module pad row is silkscreened with its signal
   name. Check each against the printed labels on your actual breakout —
   vendors vary, especially the NEO-6M (assumed VCC, RX, TX, GND).
3. **R5 / R6 on CN-02 are DNF.** The GY-521 and MAX30102 breakouts already
   carry I2C pull-ups. Fit these only with bare sensor chips.
4. Fit the 433 MHz antenna before first power-up.

## Built to the parts actually purchased

Corrected against the Pichart invoices, not the original BOM:

| Part | Was assumed | Now |
|---|---|---|
| 3.3 V regulator | 3-pin module | bare **LM1117 SOT-223**, mounts on the copper side, broken out to J3 |
| Indicator LEDs | 5 mm | **3 mm** |
| BS-02 power inlet | PCB barrel jack | **2-pin header** — the 2.5 mm jack is panel mount, wire it in |
| Bulk capacitor | disc ceramic | **radial electrolytic** |

## Dead copper removed from CN-02

`collar_node.ino` calls `LoRa.setPins(NSS, RST, DIO0)` only, and defines no
switches and one LED. Eight nets in the Rev B card were driven by nothing:

* **LoRa DIO1 / DIO2** — defined but never read. DIO2 sat on **IO12**, a
  strapping pin: held high at reset the ESP32 selects 1.8 V flash and will not
  boot. Removed.
* **SW1-SW4** (IO33/32/25/27) — no switch code exists. Removed with CN5.
* **LED2** (IO15) — firmware defines only `PIN_LED 2`. Removed.

CN-02 is now 22 nets instead of 30, with no orphans.

## Status

Both boards pass DRC with **zero violations** — no shorts, clearance, hole or
courtyard errors. What remains is connectivity the single layer could not
close, listed per board in `WIRES_TO_FIT.txt`:

| | BS-02 | CN-02 |
|---|---|---|
| Wire links routed on F.Cu | 9 | 20 |
| Wires in `WIRES_TO_FIT.txt` | 4 | 10 |
| DRC violations | 0 | 0 |

Single-sided is the binding constraint. Two 19-pin header rows form solid
~46 mm walls that nothing can cross, so every net whose peripheral sits on the
far side must go around the ends or become a wire. A 2-layer board removes
nearly all of them at the same price from any fab — the same scripts generate it.

## Still to confirm

1. **Antenna frequency.** The invoice line reads 868 MHz; the SX1278 is a
   433 MHz part. An 868 MHz whip on 433 MHz means bad SWR, much less range and
   stress on the PA. Check the label before powering up.
2. **DevKit row pitch** — set to 25.4 mm (`LX`, `RX`). DevKitC V4 is 22.86 mm.
3. **NEO-6M pin order** — assumed VCC, RX, TX, GND. `HARDWARE_DESIGN.md` says
   VCC, GND, TX, RX. Read the silkscreen on the module you have.
4. **Battery divider** — R2/R3 are 100 k. Neither invoice shows 100 k; 10 k
   would draw about 210 uA continuously off the collar cell.
5. **ESP32 mounting** — the 4-pin right-angle sockets cannot take a devkit
   (contacts face sideways, devkit pins point down) and there are only one or
   two of them. Solder the devkit in, or buy two 1x19 straight female strips.
