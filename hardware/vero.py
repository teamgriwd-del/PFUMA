"""Veroboard layout for PFUMA. Strips run HORIZONTALLY (one strip per row).

Placement is by hand; cuts and wire links are DERIVED from the verified
KiCad netlist, so the build sheet cannot drift from the electrical design.
"""
import json, collections

NETS = json.load(open("vero_nets.json"))
COL, ROW = 50, 34
CUTCOL = 19                      # strips are cut here, under the devkit body

class Vero:
    def __init__(self, board):
        self.pins = []           # (col, row, net, tag)
        self.blocks = []         # visual outlines
        self.bodies = []         # module bodies that straddle cut strips
        self.net = NETS[board]

    def pin(self, col, row, net, tag):
        self.pins.append((col, row, net, tag))

    def module(self, ref, col, row0, pinnets, label, dc=0):
        """Vertical module: consecutive pins on consecutive strips."""
        for i, n in enumerate(pinnets):
            if n:
                self.pin(col + dc * i, row0 + i, n, "%s.%d" % (ref, i + 1))
        self.blocks.append((ref, label, col, row0, row0 + len(pinnets) - 1))

    def devkit(self, cl, cr, row0):
        for i in range(1, 20):
            a, b = self.net["U1A"][str(i)], self.net["U1B"][str(i)]
            self.pin(cl, row0 + i - 1, a or "NC_L%d" % i, "U1A.%d" % i)
            self.pin(cr, row0 + i - 1, b or "NC_R%d" % i, "U1B.%d" % i)
        self.blocks.append(("U1A", "", cl, row0, row0 + 18))
        self.blocks.append(("U1B", "", cr, row0, row0 + 18))
        self.bodies.append((cl, cr, row0, row0 + 18, "ESP32 DEVKIT 38-PIN"))

    def solve(self):
        """Derive cuts, then the wires needed to reunite each net."""
        strips = collections.defaultdict(list)
        for c, r, n, t in self.pins:
            strips[r].append((c, n, t))
        cuts, segs = [], []
        for r in sorted(strips):
            items = sorted(strips[r])
            run = [items[0]]
            for prev, cur in zip(items, items[1:]):
                if prev[1] != cur[1]:
                    cuts.append((r, prev[0], cur[0]))
                    segs.append((r, run))
                    run = []
                run.append(cur)
            segs.append((r, run))
        bynet = collections.defaultdict(list)
        for r, run in segs:
            if run:
                bynet[run[0][1]].append((r, run))
        wires = []
        for n, sl in sorted(bynet.items()):
            if n.startswith("NC_"):
                continue
            sl.sort()
            for (r1, a), (r2, b) in zip(sl, sl[1:]):
                wires.append((n, a[0][0], r1, b[0][0], r2))
        return cuts, wires, bynet


# ── BS-02 placement ────────────────────────────────────────────────────────
# row 0 +12V | 1 GND | 2 +3V3 | 3 +5V | 4-22 devkit | 23-36 free | 37 GND
def bs02():
    v = Vero("BS-02")
    v.devkit(14, 24, 4)
    # 5V comes straight in on a 2-pin screw terminal. Pins land on rows 3 and 1,
    # which is 5.08mm apart - the usual terminal-block pitch. No buck needed.
    v.pin(2, 3, "+5V", "CN1.1");     v.pin(2, 1, "GND", "CN1.2")
    v.blocks.append(("CN1", "5V IN (screw terminal)", 2, 1, 3))
    v.module("U5", 11, 1, ["GND", "+3V3", "+5V"], "LM1117 SOT-223")
    v.pin(12, 1, "GND", "C5.1");     v.pin(12, 3, "+5V", "C5.2")
    v.pin(13, 1, "GND", "C1.1");     v.pin(13, 2, "+3V3", "C1.2")
    v.pin(20, 1, "GND", "C2.1");     v.pin(20, 2, "+3V3", "C2.2")
    # LoRa: 2mm pitch module, short flying leads down to these landing holes
    for r, n, t in ((2, "+3V3", "VDD"), (37, "GND", "GND"), (5, "SPI_MOSI", "MOSI"),
                    (11, "SPI_MISO", "MISO"), (12, "SPI_SCK", "SCK"),
                    (13, "LORA_NSS", "NSS"), (23, "LORA_RST", "RST"),
                    (24, "LORA_DIO0", "DIO0")):
        v.pin(44, r, n, "U2." + t)
    v.blocks.append(("U2", "Ra-02 LANDING HOLES", 44, 2, 24))
    v.module("U3", 6, 25, ["GND", "+3V3", "I2C_SCL", "I2C_SDA"], "SSD1306 OLED")
    for rr, rled, cr, cl, src, k in ((30, 32, 18, 29, "LED_G", "K1"),
                                     (34, 36, 16, 30, "LED_B", "K2"),
                                     (38, 40, 19, 31, "LED_Y", "K3"),
                                     (8,  10, 18, 32, "LED_R", "K4")):
        v.pin(rr, cr, src, "R.%s" % k);  v.pin(rr, cl, k, "R.%s" % k)
        v.pin(rled, cl, k, "LED.%s" % k); v.pin(rled, 37, "GND", "LED.%s" % k)
    v.blocks.append(("LED1-4", "330R + LED", 8, 29, 32))
    v.module("CN2", 46, 33, ["+5V", "GND", "RX0", "TX0"], "UART DEBUG")
    return v, 38


# ── rendering ──────────────────────────────────────────────────────────────
P, M = 22, 60
WCOL = {"GND": "#374151", "+3V3": "#ef4444", "+5V": "#f97316", "+12V": "#b91c1c"}
def wcol(n):
    for k, c in WCOL.items():
        if n == k: return c
    if n.startswith("LORA") or n.startswith("SPI"): return "#a855f7"
    if n.startswith("I2C"): return "#3b82f6"
    if n.startswith("LED") or n.startswith("K"): return "#f59e0b"
    return "#16a34a"

def render(v, rows, title, cuts, wires, path):
    W, H = M * 2 + COL * P, M * 2 + rows * P + 40
    x = lambda c: M + c * P
    y = lambda r: M + r * P
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="100%%" '
         'font-family="Segoe UI,Arial,sans-serif">' % (W, H)]
    s.append('<rect width="%d" height="%d" fill="#f5f0e4"/>' % (W, H))
    s.append('<rect x="%d" y="%d" width="%d" height="%d" rx="6" fill="#d8bc8a" '
             'stroke="#a9855a" stroke-width="2"/>'
             % (M - 14, M - 14, COL * P, rows * P))
    for r in range(rows):                                   # copper strips
        s.append('<rect x="%d" y="%d" width="%d" height="9" rx="4" fill="#c47f3a" '
                 'opacity=".62"/>' % (x(0) - 9, y(r) - 4.5, (COL - 1) * P + 18))
        s.append('<text x="%d" y="%d" font-size="10" fill="#6b5636" text-anchor="end">%d</text>'
                 % (M - 22, y(r) + 4, r))
    for c in range(0, COL, 5):
        s.append('<text x="%d" y="%d" font-size="10" fill="#6b5636" text-anchor="middle">%d</text>'
                 % (x(c), M - 24, c))
    for r in range(rows):
        for c in range(COL):
            s.append('<circle cx="%d" cy="%d" r="2.6" fill="#f7efdd" stroke="#a9855a" '
                     'stroke-width=".7"/>' % (x(c), y(r)))
    for c0, c1, r0, r1, lab in v.bodies:                    # straddling module body
        s.append('<rect x="%d" y="%d" width="%d" height="%d" rx="5" fill="#1f2937" '
                 'opacity=".12" stroke="#1f2937" stroke-width="1.4"/>'
                 % (x(c0) - 14, y(r0) - 14, (c1 - c0) * P + 28, (r1 - r0) * P + 28))
        s.append('<text x="%d" y="%d" font-size="12" font-weight="800" fill="#1f2937" '
                 'text-anchor="middle">%s</text>' % ((x(c0) + x(c1)) / 2, y(r0) - 20, lab))
        s.append('<text x="%d" y="%d" font-size="9.5" fill="#b91c1c" text-anchor="middle">'
                 'body sits OVER the cut line</text>' % ((x(c0) + x(c1)) / 2, y(r1) + 26))
    for ref, lab, c0, r0, r1 in v.blocks:                   # component outlines
        s.append('<rect x="%d" y="%d" width="%d" height="%d" rx="4" fill="none" '
                 'stroke="#1f2937" stroke-width="1.6" stroke-dasharray="5 3"/>'
                 % (x(c0) - 11, y(r0) - 11, 22, (r1 - r0) * P + 22))
        s.append('<text x="%d" y="%d" font-size="10.5" font-weight="700" fill="#1f2937">%s</text>'
                 % (x(c0) + 15, y(r0) - 2, ref))
        s.append('<text x="%d" y="%d" font-size="9" fill="#6b7280">%s</text>'
                 % (x(c0) + 15, y(r0) + 10, lab))
    for r, c1, c2 in cuts:                                  # strip cuts
        cx = (x(c1) + x(c2)) / 2.0
        s.append('<rect x="%d" y="%d" width="13" height="13" fill="#f5f0e4"/>'
                 % (cx - 6.5, y(r) - 6.5))
        s.append('<path d="M%d,%d l9,9 M%d,%d l-9,9" stroke="#dc2626" stroke-width="2.6" '
                 'stroke-linecap="round"/>' % (cx - 4.5, y(r) - 4.5, cx + 4.5, y(r) - 4.5))
    for n, c1, r1, c2, r2 in wires:                         # wire links
        col = wcol(n)
        mx = (x(c1) + x(c2)) / 2.0
        my = min(y(r1), y(r2)) - abs(r2 - r1) * 2.2 - 10
        s.append('<path d="M%d,%d Q%d,%d %d,%d" fill="none" stroke="%s" stroke-width="2.4" '
                 'opacity=".9"/>' % (x(c1), y(r1), mx, my, x(c2), y(r2), col))
        for cc, rr in ((c1, r1), (c2, r2)):
            s.append('<circle cx="%d" cy="%d" r="3.4" fill="%s"/>' % (x(cc), y(rr), col))
    s.append('<text x="%d" y="%d" font-size="15" font-weight="800" fill="#1f2937">%s</text>'
             % (M - 14, H - 26, title))
    s.append('<text x="%d" y="%d" font-size="11" fill="#6b7280">%d strip cuts (red X) . '
             '%d wire links . strips run left-right</text>'
             % (M - 14, H - 10, len(cuts), len(wires)))
    s.append('</svg>')
    open(path, "w", encoding="utf-8").write("".join(s))

def sheet(v, cuts, wires, title, path):
    L = ["%s - VEROBOARD BUILD SHEET" % title, "=" * 58, "",
         "Strips run LEFT-RIGHT. One strip per row. Row/col numbers are on the diagram.", "",
         "STEP 1 - CUT %d STRIPS (do this first, on the copper side)" % len(cuts), "-" * 58]
    for r, c1, c2 in sorted(cuts):
        L.append("  [ ] row %-3d  cut between col %d and col %d" % (r, c1, c2))
    L += ["", "STEP 2 - FIT COMPONENTS", "-" * 58]
    for ref, lab, c0, r0, r1 in v.blocks:
        L.append("  [ ] %-8s %-24s col %-3d rows %d-%d" % (ref, lab, c0, r0, r1))
    L += ["", "STEP 3 - SOLDER %d WIRE LINKS (component side)" % len(wires), "-" * 58]
    for n, c1, r1, c2, r2 in sorted(wires):
        L.append("  [ ] %-11s (col %2d,row %2d) -> (col %2d,row %2d)" % (n, c1, r1, c2, r2))
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


# ── CN-02 placement ────────────────────────────────────────────────────────
# 0 VSOL | 1 VBAT | 2 GND | 3 +3V3 | 4 +5V | 5-23 devkit | 24-37 free | 38 GND
def cn02():
    v = Vero("CN-02")
    # MAX30102 moved off the shared bus onto the ESP32's second I2C controller.
    # U1A pin 9 = IO25, pin 11 = IO27 (both free, neither is a strapping pin).
    v.net["U1A"]["9"] = "I2C2_SDA"
    v.net["U1A"]["11"] = "I2C2_SCL"
    v.devkit(14, 24, 5)
    # ---- power chain, top-left
    v.pin(4, 1, "VBAT", "CN1.1");  v.pin(4, 2, "GND", "CN1.2")
    v.blocks.append(("CN1", "BATT JST", 4, 1, 2))
    # no solar: TP4056 charges through its own micro-USB, IN+/IN- unused
    for c, r, n, t in ((7, 1, "VBAT", "B+"), (7, 2, "GND", "B-"),
                       (8, 1, "VBAT", "OUT+"), (8, 2, "GND", "OUT-")):
        v.pin(c, r, n, "U7." + t)
    v.blocks.append(("U7", "TP4056 (charge via its USB)", 7, 1, 2))
    for c, r, n, t in ((10, 1, "VBAT", "IN+"), (10, 2, "GND", "IN-"),
                       (11, 4, "+5V", "OUT+"), (11, 2, "GND", "OUT-")):
        v.pin(c, r, n, "U9." + t)
    v.blocks.append(("U9", "MT3608 (flying leads)", 10, 1, 4))
    v.module("U8", 13, 2, ["GND", "+3V3", "+5V"], "LM1117 SOT-223")
    for i, c in enumerate((16, 17, 18, 19)):
        v.pin(c, 2, "GND", "C%d.1" % (i + 1)); v.pin(c, 3, "+3V3", "C%d.2" % (i + 1))
    v.blocks.append(("C1-C4", "DECOUPLING", 16, 2, 3))
    # ---- battery divider (resistors stand vertically, one hole apart)
    v.pin(30, 24, "VBAT", "R2.1");  v.pin(30, 25, "VBAT_SENSE", "R2.2")
    v.pin(31, 25, "VBAT_SENSE", "R3.1"); v.pin(31, 26, "GND", "R3.2")
    v.blocks.append(("R2/R3", "100k DIVIDER", 30, 24, 26))
    # ---- LoRa: 2mm module, flying leads to these landing holes
    for r, n, t in ((3, "+3V3", "VDD"), (38, "GND", "GND"), (6, "SPI_MOSI", "MOSI"),
                    (12, "SPI_MISO", "MISO"), (13, "SPI_SCK", "SCK"),
                    (14, "LORA_NSS", "NSS"), (27, "LORA_RST", "RST"),
                    (28, "LORA_DIO0", "DIO0")):
        v.pin(34, r, n, "U3." + t)
    v.blocks.append(("U3", "Ra-02 LANDING HOLES", 34, 3, 28))
    v.module("U2", 40, 14, ["+3V3", "GPS_RX", "GPS_TX", "GND"], "NEO-6M GPS")
    # ---- I2C chain: MPU and MAX share the same four strips
    v.module("U4", 44, 24, ["+3V3", "GND", "I2C_SCL", "I2C_SDA", "", "",
                            "GND", "MPU_INT"], "MPU-6050")
    v.module("U5", 47, 24, ["+3V3", "GND", "I2C2_SCL", "I2C2_SDA"], "MAX30102")
    # ---- DS18B20 probe + its pull-up
    v.module("CN3", 20, 32, ["+3V3", "DS18B20", "GND"], "TEMP PROBE")
    v.pin(22, 32, "+3V3", "R1.1"); v.pin(22, 33, "DS18B20", "R1.2")
    v.blocks.append(("R1", "4k7 PULL-UP", 22, 32, 33))
    # ---- status LED
    v.pin(26, 35, "LED1_A", "R4.1"); v.pin(26, 36, "K1", "R4.2")
    v.pin(28, 36, "K1", "LED1.A");   v.pin(28, 38, "GND", "LED1.K")
    v.blocks.append(("R4/LED1", "330R + LED", 26, 35, 38))
    v.module("CN4", 46, 33, ["+5V", "GND", "RX0", "TX0"], "UART DEBUG")
    return v, 39
