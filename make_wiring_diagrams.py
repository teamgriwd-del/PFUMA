"""
Builds real, buildable wiring diagrams for CN-01 (collar) and BS-01 (base
station) — actual components (ESP32-WROOM-32 dev board, SX1278 Ra-02, NEO-6M,
MPU-6050, MAX30102, DS18B20, TP4056, AMS1117, LiPo + solar), wired exactly per
the netlist in hardware/HARDWARE_DESIGN.md. This is a module-interconnection
wiring diagram (breadboard/perfboard style — what you'd actually wire up with
dupont leads or solder to perfboard), not an abstract block diagram and not
the simplified Arduino-Uno-substitute simulation wiring.

Routing rules followed throughout (this is what makes it read like a clean
hand-drawn/Proteus schematic instead of a rat's nest):
  1. Every component is placed on the side of its neighbour that it actually
     wires to — a bus (SPI/I2C/UART) never has to loop around a box to reach
     its target.
  2. Parallel bus wires (e.g. the 4 SPI lines) each get their own fixed
     vertical "lane" a few pixels apart, so they run side by side instead of
     stacking on top of each other at a shared auto-computed midpoint.
  3. No wire's routed path is allowed to pass behind/through an unrelated
     component box — every jog is placed in open canvas space.

Regenerate: python make_wiring_diagrams.py && python render_wiring_diagrams.py
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent

# ── Palette (wire colors follow common electronics convention) ──────────────
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
SURFACE = "#fcfcfb"
BOX_FILL = "#eef1f5"
BOX_STROKE = "#1a1a1a"
COLOR_3V3 = "#c0392b"     # red — power
COLOR_GND = "#1a1a1a"     # black — ground
COLOR_I2C = "#2a78d6"     # blue
COLOR_SPI = "#7c3aed"     # purple
COLOR_UART = "#0f8a53"    # green
COLOR_1WIRE = "#ca8a04"   # amber
COLOR_MISC = "#c2185b"    # pink — LED/button/battery-monitor

# ══════════════════════════════════════════════════════════════════════════
#  Tiny schematic-canvas helper
# ══════════════════════════════════════════════════════════════════════════
class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.elements = []
        self.pins = {}  # "Component.pin" -> (x, y, side)

    def rect(self, x, y, w, h, fill=BOX_FILL, stroke=BOX_STROKE, sw=1.6, rx=6):
        self.elements.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def text(self, x, y, s, size=10, weight=400, color=INK, anchor="start", family="system-ui,-apple-system,Segoe UI,sans-serif", halo=False):
        halo_attr = ' stroke="#fcfcfb" stroke-width="3" paint-order="stroke"' if halo else ""
        self.elements.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}" font-family="{family}"{halo_attr}>{s}</text>')

    def line(self, x1, y1, x2, y2, color=INK, sw=1.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.elements.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{d}/>')

    def polyline(self, pts, color=INK, sw=1.8):
        p = " ".join(f"{x},{y}" for x, y in pts)
        self.elements.append(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round"/>')

    def dot(self, x, y, color=INK, r=2.6):
        self.elements.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')

    def component(self, name, x, y, w, h, title, pins_left=None, pins_right=None, pins_top=None, pins_bottom=None, fill=BOX_FILL, title_size=11.5):
        """Draws a labeled component box with pin stubs on any of its 4 sides.
        pins_* are lists of pin-name strings, evenly spaced along that side.
        Registers each pin's outer stub endpoint in self.pins. Pin label
        strings must be unique per component even if their displayed text is
        identical (e.g. two physical GND pins) — use "GND.1"/"GND.2"."""
        self.rect(x, y, w, h, fill=fill)
        self.text(x + w / 2, y + 16, title, size=title_size, weight=800, anchor="middle")

        def place(pins, side):
            if not pins:
                return
            n = len(pins)
            for i, pin in enumerate(pins):
                frac = (i + 1) / (n + 1)
                if side in ("left", "right"):
                    py = y + frac * h
                    px_in = x if side == "left" else x + w
                    px_out = px_in - 14 if side == "left" else px_in + 14
                    self.line(px_in, py, px_out, py, color=INK_SECONDARY, sw=1.2)
                    anchor = "end" if side == "left" else "start"
                    label_x = px_out - 3 if side == "left" else px_out + 3
                    # A pin like "GND.1" is disambiguated for the lookup dict
                    # (two physical GND pins on the same component) but should
                    # still display as plain "GND".
                    display = pin[:-2] if pin[-2:] in (".1", ".2") and pin.rsplit(".", 1)[0].replace("\n", "").isalpha() else pin
                    self.text(label_x, py + 3, display, size=8.5, color=INK_SECONDARY, anchor=anchor, halo=True)
                    self.pins[f"{name}.{pin}"] = (px_out, py, side)
                else:
                    px = x + frac * w
                    py_in = y if side == "top" else y + h
                    py_out = py_in - 14 if side == "top" else py_in + 14
                    self.line(px, py_in, px, py_out, color=INK_SECONDARY, sw=1.2)
                    self.text(px, py_out - 4 if side == "top" else py_out + 10, pin, size=8.5, color=INK_SECONDARY, anchor="middle", halo=True)
                    self.pins[f"{name}.{pin}"] = (px, py_out, side)

        place(pins_left, "left")
        place(pins_right, "right")
        place(pins_top, "top")
        place(pins_bottom, "bottom")

    def wire(self, a, b, color=INK, sw=1.8, via_y=None, via_x=None):
        """Orthogonal wire between two registered pins, e.g. 'ESP32.IO21' -> 'MPU.SDA'.
        Pass an explicit via_x/via_y to give a bus wire its own routing lane so
        it doesn't stack on top of its neighbours at a shared auto-midpoint."""
        (x1, y1, s1) = self.pins[a]
        (x2, y2, s2) = self.pins[b]
        if via_y is not None:
            pts = [(x1, y1), (x1, via_y), (x2, via_y), (x2, y2)]
        elif via_x is not None:
            pts = [(x1, y1), (via_x, y1), (via_x, y2), (x2, y2)]
        elif abs(y1 - y2) < 2:
            pts = [(x1, y1), (x2, y2)]
        else:
            midx = (x1 + x2) / 2
            pts = [(x1, y1), (midx, y1), (midx, y2), (x2, y2)]
        self.polyline(pts, color=color, sw=sw)
        self.dot(x1, y1, color=color, r=2.2)
        self.dot(x2, y2, color=color, r=2.2)

    def rail(self, y, x1, x2, color, label):
        self.line(x1, y, x2, y, color=color, sw=2.2)
        self.text(x1 + 6, y - 6, label, size=9, weight=700, color=color, anchor="start", halo=True)

    def tap(self, pin_name, rail_y, color, via_x=None):
        """Straight vertical drop onto a power rail. Pass via_x to jog
        sideways first when a straight drop would cross another component box."""
        (x, y, side) = self.pins[pin_name]
        if via_x is not None and via_x != x:
            pts = [(x, y), (via_x, y), (via_x, rail_y)]
            self.polyline(pts, color=color, sw=1.8)
            self.dot(x, y, color=color, r=2.2)
            self.dot(via_x, rail_y, color=color, r=2.6)
        else:
            self.line(x, y, x, rail_y, color=color, sw=1.8)
            self.dot(x, rail_y, color=color, r=2.6)

    def legend(self, x, y, items):
        for i, (color, label) in enumerate(items):
            ly = y + i * 16
            self.line(x, ly, x + 22, ly, color=color, sw=2.4)
            self.text(x + 28, ly + 3, label, size=9.5, color=INK_SECONDARY)

    def svg(self):
        body = "\n".join(self.elements)
        return (f'<svg viewBox="0 0 {self.w} {self.h}" width="100%" xmlns="http://www.w3.org/2000/svg" '
                f'font-family="system-ui,-apple-system,Segoe UI,sans-serif">{body}</svg>')


# ══════════════════════════════════════════════════════════════════════════
#  CN-01 COLLAR NODE — real wiring diagram
# ══════════════════════════════════════════════════════════════════════════
def build_cn01():
    c = Canvas(1500, 980)

    # ESP32-WROOM-32 dev board (38-pin devkit layout, only used pins shown).
    # Right-side pins are ordered SPI-then-misc, top to bottom, so each wire
    # to the LoRa module / LED / button runs in its own short lane instead of
    # crossing its neighbours.
    c.component("ESP32", 620, 260, 260, 460, "ESP32-WROOM-32\n(38-pin DevKit)",
        pins_left=["3V3", "GND.1", "IO34\n(VBAT ADC)", "IO35\n(MPU INT)", "IO4\n(1-Wire)", "IO16\n(GPS RX)", "IO17\n(GPS TX)", "IO21\n(SDA)", "IO22\n(SCL)"],
        pins_right=["GND.2", "IO19\n(MISO)", "IO23\n(MOSI)", "IO18\n(SCK)", "IO5\n(LoRa NSS)", "IO14\n(RST)", "IO26\n(DIO0)", "IO2\n(LED)", "IO0\n(BOOT)", "EN\n(RST)"],
    )

    # Power chain (left side, above the sensors)
    c.component("SOLAR", 40, 60, 130, 60, "Solar Panel\n5V 40x70mm", pins_right=["+", "-"])
    c.component("TP4056", 230, 40, 150, 100, "TP4056\n+Protection", pins_left=["IN+", "IN-"], pins_right=["BAT+", "BAT-"], pins_bottom=["OUT+", "OUT-"])
    c.component("BATT", 40, 180, 130, 60, "LiPo 3.7V\n2000mAh (JST)", pins_right=["+", "-"])
    c.component("AMS1117", 230, 200, 150, 80, "AMS1117-3.3\nLDO Regulator", pins_left=["VIN", "GND"], pins_right=["3.3V"])

    # Sensors (bottom-left area). MPU-6050's interrupt line exits the TOP of
    # the box (not the bottom) because its target, ESP32.IO35, sits above it —
    # that keeps the wire a clean two-bend path through open canvas space
    # instead of running the length of the ESP32's whole pin column.
    c.component("DS18B20", 40, 700, 150, 70, "DS18B20\nWaterproof Probe", pins_right=["VCC", "DATA", "GND"])
    c.component("MPU", 220, 700, 150, 90, "MPU-6050\nIMU (0x68)", pins_left=["VCC", "GND"], pins_right=["SCL", "SDA"], pins_top=["INT"], pins_bottom=["AD0->GND"])
    c.component("MAX30102", 420, 700, 150, 80, "MAX30102\nHeart Rate (0x57)", pins_left=["VIN", "GND"], pins_right=["SCL", "SDA"])
    c.component("NEO6M", 40, 840, 150, 80, "NEO-6M GPS\n+ Antenna", pins_right=["VCC", "GND", "TX", "RX"])

    # LoRa + antenna (right side)
    c.component("SX1278", 1020, 260, 170, 220, "SX1278 / Ra-02\nLoRa 433MHz",
                 pins_left=["3.3V", "GND", "MISO", "MOSI", "SCK", "NSS", "RST", "DIO0", "DIO1", "DIO2"],
                 pins_top=["ANT (onboard connector)"])
    c.component("ANT", 1280, 200, 90, 40, "SMA Antenna\n433MHz whip", pins_left=["ANT"])

    # Status LED + boot button (right side, below the LoRa module — clear of it)
    c.component("LED1", 1020, 540, 90, 50, "Status LED\n(Green)", pins_left=["A"], pins_bottom=["K"])
    c.component("SW1", 1020, 630, 90, 50, "Boot/Reset\nButton", pins_left=["1"], pins_right=["2"])

    # ── Power rails ──
    RAIL_3V3_Y = 130
    GND_Y = 940
    c.rail(RAIL_3V3_Y, 20, 1480, COLOR_3V3, "3V3_RAIL")
    c.rail(GND_Y, 20, 1480, COLOR_GND, "GND")

    c.wire("SOLAR.+", "TP4056.IN+", color=COLOR_3V3)
    c.wire("SOLAR.-", "TP4056.IN-", color=COLOR_GND)
    c.wire("TP4056.BAT+", "BATT.+", color=COLOR_3V3)
    c.wire("TP4056.BAT-", "BATT.-", color=COLOR_GND)
    # Note: AMS1117.VIN carries the raw ~3.7-4.2V battery rail (pre-regulation) —
    # it must NOT tap the regulated 3V3_RAIL below; it's wired directly from
    # TP4056.OUT+ only.
    c.wire("TP4056.OUT+", "AMS1117.VIN", color=COLOR_3V3, via_y=170)
    c.wire("TP4056.OUT-", "AMS1117.GND", color=COLOR_GND, via_y=176)
    c.tap("AMS1117.3.3V", RAIL_3V3_Y, COLOR_3V3)

    # ESP32 power (both physical GND pins tapped — left one for the power
    # section, right one local to the LoRa/LED section)
    c.tap("ESP32.3V3", RAIL_3V3_Y, COLOR_3V3)
    c.tap("ESP32.GND.1", GND_Y, COLOR_GND)
    c.tap("ESP32.GND.2", GND_Y, COLOR_GND, via_x=900)

    # Sensor power taps
    for pin in ["DS18B20.VCC", "MPU.VCC", "MAX30102.VIN", "NEO6M.VCC", "SX1278.3.3V"]:
        c.tap(pin, RAIL_3V3_Y, COLOR_3V3)
    for pin in ["DS18B20.GND", "MPU.GND", "MAX30102.GND", "NEO6M.GND", "SX1278.GND"]:
        c.tap(pin, GND_Y, COLOR_GND)

    # 1-Wire (DS18B20) — data + 4.7k pull-up to 3V3 (shown as a small resistor label on the wire)
    c.wire("DS18B20.DATA", "ESP32.IO4\n(1-Wire)", color=COLOR_1WIRE, via_y=760)
    c.text(380, 752, "R1 4.7kOhm pull-up to 3V3_RAIL", size=8.5, color=COLOR_1WIRE, halo=True)

    # I2C bus (MPU-6050 + MAX30102 share SDA/SCL, with 4.7k pull-ups to 3V3)
    c.wire("MPU.SDA", "ESP32.IO21\n(SDA)", color=COLOR_I2C, via_y=780)
    c.wire("MPU.SCL", "ESP32.IO22\n(SCL)", color=COLOR_I2C, via_y=792)
    c.wire("MAX30102.SDA", "MPU.SDA", color=COLOR_I2C, via_y=804)
    c.wire("MAX30102.SCL", "MPU.SCL", color=COLOR_I2C, via_y=816)
    c.text(420, 664, "R5/R6 4.7kOhm I2C pull-ups to 3V3_RAIL", size=8.5, color=COLOR_I2C, halo=True)
    # MPU interrupt: exits the TOP of the MPU box, straight up through open
    # space between the sensor row and the ESP32, then into IO35 — no shared
    # lanes, no crossing through other components.
    c.wire("MPU.INT", "ESP32.IO35\n(MPU INT)", color=COLOR_MISC)

    # UART (GPS) — cross TX/RX
    c.wire("NEO6M.TX", "ESP32.IO16\n(GPS RX)", color=COLOR_UART, via_y=880)
    c.wire("NEO6M.RX", "ESP32.IO17\n(GPS TX)", color=COLOR_UART, via_y=892)

    # SPI (LoRa) — 4 lines, each in its own vertical lane between the ESP32
    # and the LoRa module (all lanes sit left of SX1278's box edge at x=1020,
    # so none of them cross into it).
    c.wire("ESP32.IO19\n(MISO)", "SX1278.MISO", color=COLOR_SPI, via_x=906)
    c.wire("ESP32.IO23\n(MOSI)", "SX1278.MOSI", color=COLOR_SPI, via_x=918)
    c.wire("ESP32.IO18\n(SCK)", "SX1278.SCK", color=COLOR_SPI, via_x=930)
    c.wire("ESP32.IO5\n(LoRa NSS)", "SX1278.NSS", color=COLOR_SPI, via_x=942)
    c.wire("ESP32.IO14\n(RST)", "SX1278.RST", color=COLOR_MISC, via_x=954)
    c.wire("ESP32.IO26\n(DIO0)", "SX1278.DIO0", color=COLOR_MISC, via_x=966)
    c.wire("SX1278.ANT (onboard connector)", "ANT.ANT", color="#9aa0a6", sw=2.2)

    # Status LED + boot/reset button — each also in its own lane, all still
    # left of x=1020 so nothing crosses the SX1278 or button/LED boxes.
    c.wire("ESP32.IO2\n(LED)", "LED1.A", color=COLOR_MISC, via_x=978)
    c.text(982, 585, "R4 330 Ohm", size=8, color=COLOR_MISC, halo=True)
    c.tap("LED1.K", GND_Y, COLOR_GND, via_x=1140)
    c.wire("ESP32.IO0\n(BOOT)", "SW1.1", color=COLOR_MISC, via_x=990)
    c.tap("SW1.2", GND_Y, COLOR_GND)
    c.wire("ESP32.EN\n(RST)", "SW1.1", color=COLOR_MISC, via_x=1002)

    # Battery monitor divider — a short local stub next to the pin (not a
    # rail-spanning line) so it can't be mistaken for a bus.
    (bx, by, _) = c.pins["ESP32.IO34\n(VBAT ADC)"]
    c.line(bx, by, bx - 30, by, color=COLOR_MISC, sw=1.8)
    c.dot(bx - 30, by, color=COLOR_MISC, r=2.6)
    c.text(bx - 34, by - 10, "R2/R3 divider from BATT+ (Vbat/2 -> ADC)", size=8, color=COLOR_MISC, anchor="end", halo=True)

    c.legend(1180, 700, [
        (COLOR_3V3, "3.3V power"), (COLOR_GND, "Ground"), (COLOR_I2C, "I2C (shared bus)"),
        (COLOR_SPI, "SPI (LoRa)"), (COLOR_UART, "UART (GPS)"), (COLOR_1WIRE, "1-Wire (temp probe)"),
        (COLOR_MISC, "Misc / control"), ("#9aa0a6", "RF (antenna)"),
    ])
    c.text(1180, 690, "Wire colours", size=10, weight=800, color=INK)

    return c.svg()


# ══════════════════════════════════════════════════════════════════════════
#  BS-01 BASE STATION — real wiring diagram
# ══════════════════════════════════════════════════════════════════════════
def build_bs01():
    c = Canvas(1300, 640)

    # Pin sides face their actual physical neighbour: I2C (OLED) and the LED
    # driver lines face LEFT (both the OLED and the 4-LED module sit to the
    # left); SPI faces RIGHT, toward the LoRa module. This is what the
    # original version got backwards — SPI was on the left and had to loop
    # up and over the whole ESP32 box to reach the LoRa module on the right.
    c.component("ESP32B", 480, 140, 260, 380, "ESP32-WROOM-32\n(38-pin DevKit)",
        pins_left=["3V3", "GND.1", "IO22\n(SCL)", "IO21\n(SDA)", "IO2\n(PWR LED)", "IO4\n(LoRa LED)", "IO15\n(WiFi LED)", "IO27\n(Alert LED)"],
        pins_right=["GND.2", "IO19\n(MISO)", "IO23\n(MOSI)", "IO18\n(SCK)", "IO5\n(NSS)", "IO14\n(RST)", "IO26\n(DIO0)"],
    )

    c.component("DCJACK", 40, 60, 140, 60, "12V DC Jack\n5.5/2.1mm", pins_right=["+", "-"])
    c.component("LM2596", 220, 40, 150, 90, "LM2596 Buck\n12V -> 5V", pins_left=["IN+", "IN-"], pins_right=["OUT+", "OUT-"])
    c.component("AMS1117B", 220, 160, 150, 80, "AMS1117-3.3\nLDO Regulator", pins_left=["VIN", "GND"], pins_right=["3.3V"])

    c.component("SX1278B", 860, 140, 170, 220, "SX1278 / Ra-02\nLoRa 433MHz",
                 pins_left=["3.3V", "GND", "MISO", "MOSI", "SCK", "NSS", "RST", "DIO0"],
                 pins_top=["ANT (onboard connector)"])
    c.component("ANTB", 1100, 100, 90, 40, "SMA Antenna\n433MHz whip", pins_left=["ANT"])

    c.component("OLED", 40, 240, 150, 90, "SSD1306 OLED\n128x64 (0x3C)", pins_right=["GND", "VCC", "SCL", "SDA"])

    c.component("LEDS", 40, 400, 220, 110, "4x Status LEDs\nPWR / LoRa / WiFi / Alert",
                 pins_top=["PWR", "LoRa", "WiFi", "Alert"], pins_bottom=["GND1", "GND2", "GND3", "GND4"])

    RAIL_3V3_Y = 100
    GND_Y = 600
    c.rail(RAIL_3V3_Y, 20, 1280, COLOR_3V3, "3V3_RAIL")
    c.rail(GND_Y, 20, 1280, COLOR_GND, "GND")

    c.wire("DCJACK.+", "LM2596.IN+", color=COLOR_3V3)
    c.wire("DCJACK.-", "LM2596.IN-", color=COLOR_GND)
    c.wire("LM2596.OUT+", "AMS1117B.VIN", color=COLOR_3V3, via_y=120)
    c.wire("LM2596.OUT-", "AMS1117B.GND", color=COLOR_GND, via_y=126)
    c.tap("AMS1117B.3.3V", RAIL_3V3_Y, COLOR_3V3)

    for pin in ["ESP32B.3V3", "SX1278B.3.3V", "OLED.VCC"]:
        c.tap(pin, RAIL_3V3_Y, COLOR_3V3)
    c.tap("ESP32B.GND.1", GND_Y, COLOR_GND)
    c.tap("ESP32B.GND.2", GND_Y, COLOR_GND, via_x=830)
    for pin in ["SX1278B.GND", "OLED.GND"]:
        c.tap(pin, GND_Y, COLOR_GND)

    # SPI (LoRa) — 6 lines, each its own lane between the ESP32 and the LoRa
    # module, all left of SX1278B's box edge (x=860).
    c.wire("ESP32B.IO19\n(MISO)", "SX1278B.MISO", color=COLOR_SPI, via_x=760)
    c.wire("ESP32B.IO23\n(MOSI)", "SX1278B.MOSI", color=COLOR_SPI, via_x=772)
    c.wire("ESP32B.IO18\n(SCK)", "SX1278B.SCK", color=COLOR_SPI, via_x=784)
    c.wire("ESP32B.IO5\n(NSS)", "SX1278B.NSS", color=COLOR_SPI, via_x=796)
    c.wire("ESP32B.IO14\n(RST)", "SX1278B.RST", color=COLOR_MISC, via_x=808)
    c.wire("ESP32B.IO26\n(DIO0)", "SX1278B.DIO0", color=COLOR_MISC, via_x=820)
    c.wire("SX1278B.ANT (onboard connector)", "ANTB.ANT", color="#9aa0a6", sw=2.2)

    # I2C (OLED) — own lanes so SDA/SCL don't share an auto-midpoint
    c.wire("OLED.SCL", "ESP32B.IO22\n(SCL)", color=COLOR_I2C, via_x=330)
    c.wire("OLED.SDA", "ESP32B.IO21\n(SDA)", color=COLOR_I2C, via_x=345)
    c.text(400, 355, "R5/R6 4.7kOhm I2C pull-ups to 3V3_RAIL", size=8.5, color=COLOR_I2C, halo=True)

    # Status LEDs — each signal wire's jog point differs naturally with the
    # source pin's x, so no explicit lane is needed to keep them separated.
    c.wire("ESP32B.IO2\n(PWR LED)", "LEDS.PWR", color=COLOR_MISC)
    c.wire("ESP32B.IO4\n(LoRa LED)", "LEDS.LoRa", color=COLOR_MISC)
    c.wire("ESP32B.IO15\n(WiFi LED)", "LEDS.WiFi", color=COLOR_MISC)
    c.wire("ESP32B.IO27\n(Alert LED)", "LEDS.Alert", color=COLOR_MISC)
    c.text(300, 570, "R1-R4 330 Ohm current-limit resistors (one per LED)", size=8.5, color=COLOR_MISC, halo=True)
    for pin in ["LEDS.GND1", "LEDS.GND2", "LEDS.GND3", "LEDS.GND4"]:
        c.tap(pin, GND_Y, COLOR_GND)

    c.legend(900, 420, [
        (COLOR_3V3, "3.3V power"), (COLOR_GND, "Ground"), (COLOR_I2C, "I2C (OLED)"),
        (COLOR_SPI, "SPI (LoRa)"), (COLOR_MISC, "Misc / control"), ("#9aa0a6", "RF (antenna)"),
    ])
    c.text(900, 410, "Wire colours", size=10, weight=800, color=INK)

    return c.svg()


cn01_svg = build_cn01()
bs01_svg = build_bs01()

html_template = """<!doctype html>
<html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font-family: system-ui,-apple-system,'Segoe UI',sans-serif; background: %s; color: %s; }}
  .sheet {{ width: 1600px; padding: 40px; }}
  .titleblock {{ background: linear-gradient(120deg, #14532d 0%%, #1b5e20 45%%, #2a78d6 100%%); color: white;
    padding: 24px 30px; border-radius: 10px; margin-bottom: 20px; }}
  .titleblock h1 {{ margin: 0; font-size: 30px; font-weight: 800; }}
  .titleblock p {{ margin: 4px 0 0 0; font-size: 14px; opacity: 0.92; }}
  .board {{ background: white; border: 1px solid #e1e0d9; border-radius: 10px; padding: 20px; }}
  .note {{ margin-top: 16px; font-size: 12px; color: #52514e; line-height: 1.6; }}
  .note b {{ color: #0b0b0b; }}
</style></head>
<body>
<div class="sheet">
  <div class="titleblock">
    <h1>%s</h1>
    <p>%s</p>
  </div>
  <div class="board">
    %s
  </div>
  <div class="note">%s</div>
</div>
</body></html>
""" % (SURFACE, INK, "{title}", "{sub}", "{svg}", "{note}")

cn01_html = html_template.format(
    title="PFUMA CN-01 — Collar Node Wiring Diagram",
    sub="Real components, real pin-level wiring — matches hardware/HARDWARE_DESIGN.md &sect;1.3 exactly. Build on perfboard or dupont-wire breadboard before committing to a PCB order.",
    svg=cn01_svg,
    note=("<b>Build notes:</b> Power rails (red 3V3 / black GND) are drawn as horizontal buses — every component's power pin taps into "
          "the nearest point on the rail, exactly as you'd wire a breadboard's rail strips. I2C (blue) is a shared bus: MPU-6050 and "
          "MAX30102 both tap the same SDA/SCL lines feeding the ESP32, with 4.7k&Omega; pull-ups to 3V3. SPI (purple) is dedicated "
          "point-to-point wiring to the LoRa module only, one signal per lane. Full BOM with part numbers and supplier links: "
          "BUDGET_PROPOSAL.md and hardware/actual_equipment/README.md."),
)
bs01_html = html_template.format(
    title="PFUMA BS-01 — Base Station Wiring Diagram",
    sub="Real components, real pin-level wiring — matches hardware/HARDWARE_DESIGN.md &sect;2.3 exactly.",
    svg=bs01_svg,
    note=("<b>Build notes:</b> Same wiring conventions as CN-01. The base station has no battery/solar/sensor chain — it runs off a "
          "12V DC adapter through a buck converter, and drives an OLED status display plus 4 indicator LEDs instead of body sensors."),
)

(HERE / "wiring_cn01.html").write_text(cn01_html, encoding="utf-8")
(HERE / "wiring_bs01.html").write_text(bs01_html, encoding="utf-8")
print("Wrote wiring_cn01.html and wiring_bs01.html")
