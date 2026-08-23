"""BS-02 Base Station - single-sided routed PCB, 120 x 100 mm."""
import os, pcbnew
from pcbkit import PCB, W_SIG, W_3V3, W_PWR
from router import Router
from linker import fit_links

HERE = os.path.dirname(os.path.abspath(__file__))

DEV_L = ["3V3", "EN", "VP", "VN", "IO34", "IO35", "IO32", "IO33", "IO25",
         "IO26", "IO27", "IO14", "IO12", "GND", "IO13", "SD2", "SD3", "CMD", "5V"]
DEV_R = ["GND", "IO23", "IO22", "TX0", "RX0", "IO21", "GND", "IO19", "IO18",
         "IO5", "IO17", "IO16", "IO4", "IO0", "IO2", "IO15", "SD1", "SD0", "CLK"]
RA02 = {1: "GND", 2: "GND", 3: "VDD", 4: "RESET", 5: "DIO0", 6: "DIO1",
        7: "DIO2", 8: "DIO3", 9: "GND", 10: "DIO4", 11: "DIO5", 12: "SCK",
        13: "MISO", 14: "MOSI", 15: "NSS", 16: "GND"}
PH = "Connector_PinHeader_2.54mm"
RES = ("Resistor_THT", "R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal")

p = PCB("BS-02", 140.0, 120.0)
LX, RX, Y0 = 48.0, 73.4, 34.0          # ESP32 header rows, 25.4mm apart
LORA = (105.0, 88.0)

p.place("CN1", PH, "PinHeader_1x02_P2.54mm_Vertical", 14, 16, 0, "12V-IN")
p.place("U4", PH, "PinHeader_1x04_P2.54mm_Vertical", 30, 6, 0, "LM2596")
u5 = p.place("U5", "Package_TO_SOT_SMD", "SOT-223-3_TabPin2", 40, 12, 0, "LM1117-3.3")
u5.SetLayerAndFlip(pcbnew.B_Cu)
p.place("J3", PH, "PinHeader_1x03_P2.54mm_Vertical", 48, 9.7, 0, "REG")
p.place("C5", "Capacitor_THT", "CP_Radial_D5.0mm_P2.50mm", 8, 34, 0, "100u")
p.place("C1", "Capacitor_THT", "C_Disc_D5.0mm_W2.5mm_P5.00mm", 8, 44, 0, "100n")
p.place("C2", "Capacitor_THT", "C_Disc_D5.0mm_W2.5mm_P5.00mm", 8, 54, 0, "100n")
p.place("U1A", PH, "PinHeader_1x19_P2.54mm_Vertical", LX, Y0, 0, "ESP32-L")
p.place("U1B", PH, "PinHeader_1x19_P2.54mm_Vertical", RX, Y0, 0, "ESP32-R")

u2 = p.place("U2", "RF_Module", "Ai-Thinker-Ra-01-LoRa", LORA[0], LORA[1], 0, "Ra-02")
u2.SetLayerAndFlip(pcbnew.B_Cu)        # castellated module solders to the copper side

p.place("J1", PH, "PinHeader_1x08_P2.54mm_Vertical", 82, 79.11, 0, "LORA-SPI")
p.place("J2", PH, "PinHeader_1x03_P2.54mm_Vertical", 126, 82, 0, "LORA-CTL")
p.place("U3", PH, "PinHeader_1x04_P2.54mm_Vertical", 122, 26, 0, "SSD1306")
p.place("CN2", PH, "PinHeader_1x04_P2.54mm_Vertical", 122, 62, 0, "UART")
p.place("R5", RES[0], RES[1], 98, 20, 0, "4k7")
p.place("R6", RES[0], RES[1], 98, 26, 0, "4k7")

LEDPOS = [("1", 46, "LED_G"), ("2", 56, "LED_B"), ("3", 66, "LED_Y"), ("4", 30, "LED_R")]
for ref, x, _ in LEDPOS:
    p.place("R" + ref, RES[0], RES[1], x, 94, 270, "330R")
    p.place("LED" + ref, "LED_THT", "LED_D3.0mm", x, 110, 90, "LED")
for i, (mx, my) in enumerate([(5, 5), (135, 5), (5, 115), (135, 115)]):
    p.place("MH%d" % (i + 1), "MountingHole", "MountingHole_3.2mm_M3", mx, my, 0, "M3")

# ── nets ────────────────────────────────────────────────────────────────
L = {n: i + 1 for i, n in enumerate(DEV_L) if n != "GND"}
R = {}
for i, n in enumerate(DEV_R):
    if n != "GND":
        R[n] = i + 1

p.assign("CN1", 1, "+12V"); p.assign("CN1", 2, "GND")
p.assign("U4", 1, "+12V"); p.assign("U4", 2, "GND")
p.assign("U4", 3, "+5V");  p.assign("U4", 4, "GND")
p.assign("U5", 1, "GND");  p.assign("U5", 2, "+3V3"); p.assign("U5", 3, "+5V")
p.assign("J3", 1, "GND");  p.assign("J3", 2, "+3V3"); p.assign("J3", 3, "+5V")
p.assign("C5", 1, "+5V");  p.assign("C5", 2, "GND")
p.assign("C1", 1, "+3V3"); p.assign("C1", 2, "GND")
p.assign("C2", 1, "+3V3"); p.assign("C2", 2, "GND")
p.assign("U1A", L["5V"], "+5V")
for i, n in enumerate(DEV_L):
    if n == "GND": p.assign("U1A", i + 1, "GND")
for i, n in enumerate(DEV_R):
    if n == "GND": p.assign("U1B", i + 1, "GND")
p.assign("U1A", L["IO14"], "LORA_RST")
p.assign("U1A", L["IO26"], "LORA_DIO0")
p.assign("U1A", L["IO13"], "LED_R")
for gp, nt in (("IO23", "SPI_MOSI"), ("IO22", "I2C_SCL"), ("TX0", "TX0"),
               ("RX0", "RX0"), ("IO21", "I2C_SDA"), ("IO19", "SPI_MISO"),
               ("IO18", "SPI_SCK"), ("IO5", "LORA_NSS"), ("IO4", "LED_B"),
               ("IO2", "LED_G"), ("IO15", "LED_Y")):
    p.assign("U1B", R[gp], nt)

RA_NET = {"GND": "GND", "VDD": "+3V3", "RESET": "LORA_RST", "DIO0": "LORA_DIO0",
          "SCK": "SPI_SCK", "MISO": "SPI_MISO", "MOSI": "SPI_MOSI", "NSS": "LORA_NSS"}
for pin, nm in RA02.items():
    if nm in RA_NET:
        p.assign("U2", pin, RA_NET[nm])

for pn, nt in ((1, "GND"), (2, "LORA_NSS"), (3, "SPI_MOSI"), (4, "SPI_MISO"),
               (5, "SPI_SCK"), (6, "GND"), (7, "GND"), (8, "GND")):
    p.assign("J1", pn, nt)
for pn, nt in ((1, "+3V3"), (2, "LORA_RST"), (3, "LORA_DIO0")):
    p.assign("J2", pn, nt)

p.assign("U3", 1, "GND"); p.assign("U3", 2, "+3V3")
p.assign("U3", 3, "I2C_SCL"); p.assign("U3", 4, "I2C_SDA")
p.assign("CN2", 1, "+5V"); p.assign("CN2", 2, "GND")
p.assign("CN2", 3, "RX0"); p.assign("CN2", 4, "TX0")
p.assign("R5", 1, "+3V3"); p.assign("R5", 2, "I2C_SDA")
p.assign("R6", 1, "+3V3"); p.assign("R6", 2, "I2C_SCL")
for ref, _, net in LEDPOS:
    p.assign("R" + ref, 1, net)
    p.assign("R" + ref, 2, "K" + ref)
    p.assign("LED" + ref, 2, "K" + ref)
    p.assign("LED" + ref, 1, "GND")

# ── silkscreen ──────────────────────────────────────────────────────────
p.text("PFUMA  BS-02  BASE STATION", 40, 4.5, 2.0)
p.text("Rev B / single sided / GND = bottom pour", 40, 8.5, 1.1)
p.text("U2 Ra-02 solders on the COPPER side.  Mirror B.Cu before etching.", 50, 116.0, 1.1)
for i, n in enumerate(DEV_L):
    p.text(n, LX - 6.0, Y0 + i * 2.54 + 0.4, 0.8)
for i, n in enumerate(DEV_R):
    p.text(n, RX + 6.0, Y0 + i * 2.54 + 0.4, 0.8)
p.text("U1  ESP32-WROOM-32 DEVKIT 38-PIN", 46.5, 23.0, 1.1)
p.text("U2 Ra-02 (copper side)", 97, 77, 1.0)
p.text("ANT KEEP-OUT", 97, 107, 1.2)
p.text("J1", 80, 77.5, 1.0)
p.text("J2", 124.5, 80, 1.0)
for n, lb in ((1, "GND"), (2, "VCC"), (3, "SCL"), (4, "SDA")):
    p.text(lb, 124.5, 26 + (n - 1) * 2.54 + 0.4, 0.85)
p.text("U3 SSD1306", 118, 23, 1.0)
for n, lb in ((1, "5V"), (2, "GND"), (3, "RX"), (4, "TX")):
    p.text(lb, 124.5, 62 + (n - 1) * 2.54 + 0.4, 0.85)
p.text("CN2 UART", 118, 59, 1.0)
for n, lb in ((1, "IN+"), (2, "IN-"), (3, "OUT+"), (4, "OUT-")):
    p.text(lb, 32, 6 + (n - 1) * 2.54 + 0.4, 0.85)
p.text("U4 LM2596", 27, 3.5, 1.0)
for n, lb in ((1, "GND"), (2, "3V3"), (3, "5V")):
    p.text(lb, 50.5, 9.7 + (n - 1) * 2.54 + 0.4, 0.85)
p.text("U5 LM1117 + J3", 44, 6.5, 1.0)
p.text("CN1 12V IN (panel jack)", 16, 25, 1.0)
for lb, x in (("GRN", 46), ("BLU", 56), ("YEL", 66), ("RED", 30)):
    p.text(lb, x + 2.5, 110, 0.9)

# ── routing ─────────────────────────────────────────────────────────────
def pads_of(net):
    out = []
    for fp in p.b.GetFootprints():
        ref = fp.GetReference()
        for pad in fp.Pads():
            if pad.GetNetname() == net:
                out.append((ref, pad.GetNumber()))
    return out

rt = Router(p)
rt.load_pads()
rt.stamp_rect(LORA[0] - 6.0, LORA[1] - 8.6, LORA[0] + 6.0, LORA[1] + 8.6)
rt.stamp_rect(94, 100, 117, 118)                   # antenna keep-out

PLAN = [("TX0", W_SIG), ("RX0", W_SIG),
        ("I2C_SCL", W_SIG), ("I2C_SDA", W_SIG),
        ("LED_G", W_SIG), ("LED_B", W_SIG), ("LED_Y", W_SIG), ("LED_R", W_SIG),
        ("K1", W_SIG), ("K2", W_SIG), ("K3", W_SIG), ("K4", W_SIG),
        ("SPI_SCK", W_SIG), ("SPI_MISO", W_SIG), ("SPI_MOSI", W_SIG),
        ("LORA_NSS", W_SIG), ("LORA_DIO0", W_SIG), ("LORA_RST", W_SIG),
        ("+3V3", W_3V3), ("+5V", W_PWR), ("+12V", W_PWR), ("GND", W_3V3)]

# stage 1 - short fan-out from the copper-side module to its THT breakouts.
# These must succeed: an SMD pad on B.Cu has no other way off the layer.
FANOUT = [("SPI_SCK", "U2", "12", "J1", "5"), ("SPI_MISO", "U2", "13", "J1", "4"),
          ("SPI_MOSI", "U2", "14", "J1", "3"), ("LORA_NSS", "U2", "15", "J1", "2"),
          ("+3V3", "U2", "3", "J2", "1"), ("LORA_RST", "U2", "4", "J2", "2"),
          ("LORA_DIO0", "U2", "5", "J2", "3"),
          ("+3V3", "U5", "2", "J3", "2"), ("+5V", "U5", "3", "J3", "3")]
fails = []
for net, sref, spad, jref, jpad in FANOUT:
    fails += rt.route_net(net, [(sref, spad), (jref, jpad)], W_SIG)

# stage 2 - the rest of the board; LoRa pads are now represented by J1/J2
fanned = set((sref, spad) for _, sref, spad, _, _ in FANOUT)
for net, w in PLAN:
    pl = [q for q in pads_of(net) if q not in fanned]
    if len(pl) > 1:
        fails += rt.route_net(net, pl, w)

anchors = []
links, unresolved = fit_links(p, fails, pads_of, anchors, rt)

print("\nB.Cu hops unrouted: %d   links fitted: %d   unresolved: %d"
      % (len(fails), len(links), len(unresolved)))
for l in links:
    print("   LK %-10s %-9s <-> %s" % l)
for u in unresolved:
    print("   XX %-10s %s.%s  (%s)" % u)

p.text("WIRE LINKS: %d + %d hand-fit" % (len(links), len(unresolved)), 50, 112.5, 1.1)
import os as _os
if not _os.environ.get('NOFILL'):
    p.pour("GND")
    p.fill()
print("saved", p.save(os.path.join(HERE, "BS-02", "BS-02.kicad_pcb")))
