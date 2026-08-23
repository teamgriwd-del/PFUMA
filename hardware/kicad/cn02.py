"""CN-02 Collar Node - single-sided routed PCB, 150 x 140 mm."""
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
CAP = ("Capacitor_THT", "C_Disc_D5.0mm_W2.5mm_P5.00mm")

p = PCB("CN-02", 150.0, 140.0)
LX, RX, Y0 = 52.0, 77.4, 40.0
LORA = (108.0, 112.0)

# power chain, top-left
p.place("CN1", PH, "PinHeader_1x02_P2.54mm_Vertical", 8, 10, 0, "BATT")
p.place("CN2", PH, "PinHeader_1x02_P2.54mm_Vertical", 8, 20, 0, "SOLAR")
p.place("U7", PH, "PinHeader_1x06_P2.54mm_Vertical", 18, 8, 0, "TP4056")
p.place("U9", PH, "PinHeader_1x04_P2.54mm_Vertical", 28, 8, 0, "MT3608")
u8 = p.place("U8", "Package_TO_SOT_SMD", "SOT-223-3_TabPin2", 44, 16, 0, "LM1117-3.3")
u8.SetLayerAndFlip(pcbnew.B_Cu)   # bare SOT-223 solders to the copper side
p.place("C1", "Capacitor_THT", "CP_Radial_D5.0mm_P2.50mm", 8, 32, 0, "100u")
p.place("J3", PH, "PinHeader_1x03_P2.54mm_Vertical", 53, 13.7, 0, "REG")
p.place("C2", CAP[0], CAP[1], 58, 20, 0, "100n")
p.place("C3", CAP[0], CAP[1], 58, 27, 0, "100n")
p.place("R2", RES[0], RES[1], 30, 24, 270, "100k")
p.place("R3", RES[0], RES[1], 30, 34, 270, "100k")

# ESP32
p.place("U1A", PH, "PinHeader_1x19_P2.54mm_Vertical", LX, Y0, 0, "ESP32-L")
p.place("U1B", PH, "PinHeader_1x19_P2.54mm_Vertical", RX, Y0, 0, "ESP32-R")

# LoRa on the copper side, broken out to THT headers
u3 = p.place("U3", "RF_Module", "Ai-Thinker-Ra-01-LoRa", LORA[0], LORA[1], 0, "Ra-02")
u3.SetLayerAndFlip(pcbnew.B_Cu)
p.place("J1", PH, "PinHeader_1x08_P2.54mm_Vertical", 88, 103.11, 0, "LORA-SPI")
p.place("J2", PH, "PinHeader_1x03_P2.54mm_Vertical", 126, 106, 0, "LORA-CTL")

# right-hand peripherals
p.place("U2", PH, "PinHeader_1x04_P2.54mm_Vertical", 140, 30, 0, "NEO-6M")
p.place("U4", PH, "PinHeader_1x08_P2.54mm_Vertical", 140, 50, 0, "MPU-6050")
p.place("U5", PH, "PinHeader_1x05_P2.54mm_Vertical", 140, 76, 0, "MAX30102")
p.place("CN3", PH, "PinHeader_1x03_P2.54mm_Vertical", 140, 96, 0, "TEMP")
p.place("CN4", PH, "PinHeader_1x04_P2.54mm_Vertical", 140, 112, 0, "UART")
p.place("R1", RES[0], RES[1], 132, 88, 270, "4k7")
p.place("R5", RES[0], RES[1], 126, 50, 0, "4k7-DNF")
p.place("R6", RES[0], RES[1], 126, 56, 0, "4k7-DNF")
p.place("C4", CAP[0], CAP[1], 126, 66, 0, "100n")

# switches and indicators, bottom-left
for ref, x, _ in [("4", 36, "LED1")]:
    p.place("R" + ref, RES[0], RES[1], x, 112, 270, "330R")
p.place("LED1", "LED_THT", "LED_D3.0mm", 36, 128, 90, "LED")
for i, (mx, my) in enumerate([(5, 5), (145, 5), (5, 135), (145, 135)]):
    p.place("MH%d" % (i + 1), "MountingHole", "MountingHole_3.2mm_M3", mx, my, 0, "M3")

# ── nets ────────────────────────────────────────────────────────────────
L = {n: i + 1 for i, n in enumerate(DEV_L) if n != "GND"}
R = {}
for i, n in enumerate(DEV_R):
    if n != "GND":
        R[n] = i + 1
for i, n in enumerate(DEV_L):
    if n == "GND": p.assign("U1A", i + 1, "GND")
for i, n in enumerate(DEV_R):
    if n == "GND": p.assign("U1B", i + 1, "GND")

# power: LiPo -> TP4056 -> MT3608 -> 5V -> AMS1117 -> 3V3
p.assign("CN1", 1, "VBAT");  p.assign("CN1", 2, "GND")
p.assign("CN2", 1, "VSOL");  p.assign("CN2", 2, "GND")
p.assign("U7", 1, "VSOL");   p.assign("U7", 2, "GND")
p.assign("U7", 3, "VBAT");   p.assign("U7", 4, "GND")
p.assign("U7", 5, "VBAT");   p.assign("U7", 6, "GND")
p.assign("U9", 1, "VBAT");   p.assign("U9", 2, "GND")
p.assign("U9", 3, "+5V");    p.assign("U9", 4, "GND")
p.assign("U8", 1, "GND");    p.assign("U8", 2, "+3V3"); p.assign("U8", 3, "+5V")
p.assign("J3", 1, "GND");    p.assign("J3", 2, "+3V3"); p.assign("J3", 3, "+5V")
p.assign("U1A", L["5V"], "+5V")
for c in ("C1", "C2", "C3", "C4"):
    p.assign(c, 1, "+3V3"); p.assign(c, 2, "GND")
# battery divider -> IO34
p.assign("R2", 1, "VBAT"); p.assign("R2", 2, "VBAT_SENSE")
p.assign("R3", 1, "VBAT_SENSE"); p.assign("R3", 2, "GND")
p.assign("U1A", L["IO34"], "VBAT_SENSE")

# left header signals
p.assign("U1A", L["IO35"], "MPU_INT")
for gp, nt in (("IO26", "LORA_DIO0"), ("IO14", "LORA_RST")):
    p.assign("U1A", L[gp], nt)
# right header signals
for gp, nt in (("IO23", "SPI_MOSI"), ("IO22", "I2C_SCL"), ("TX0", "TX0"),
               ("RX0", "RX0"), ("IO21", "I2C_SDA"), ("IO19", "SPI_MISO"),
               ("IO18", "SPI_SCK"), ("IO5", "LORA_NSS"), ("IO17", "GPS_RX"),
               ("IO16", "GPS_TX"), ("IO4", "DS18B20"), ("IO2", "LED1_A")):
    p.assign("U1B", R[gp], nt)

RA_NET = {"GND": "GND", "VDD": "+3V3", "RESET": "LORA_RST", "DIO0": "LORA_DIO0",
          "SCK": "SPI_SCK",
          "MISO": "SPI_MISO", "MOSI": "SPI_MOSI", "NSS": "LORA_NSS"}
for pin, nm in RA02.items():
    if nm in RA_NET:
        p.assign("U3", pin, RA_NET[nm])
# breakouts give every LoRa net a through-hole foothold
for pn, nt in ((1, "GND"), (2, "LORA_NSS"), (3, "SPI_MOSI"), (4, "SPI_MISO"),
               (5, "SPI_SCK"), (6, "GND"), (7, "GND"), (8, "GND")):
    p.assign("J1", pn, nt)
for pn, nt in ((1, "+3V3"), (2, "LORA_RST"), (3, "LORA_DIO0")):
    p.assign("J2", pn, nt)

# GPS: module TX -> ESP RX2 (IO16), module RX -> ESP TX2 (IO17)
p.assign("U2", 1, "+3V3"); p.assign("U2", 2, "GPS_RX")
p.assign("U2", 3, "GPS_TX"); p.assign("U2", 4, "GND")
# MPU-6050
p.assign("U4", 1, "+3V3"); p.assign("U4", 2, "GND")
p.assign("U4", 3, "I2C_SCL"); p.assign("U4", 4, "I2C_SDA")
p.assign("U4", 7, "GND"); p.assign("U4", 8, "MPU_INT")
# MAX30102
p.assign("U5", 1, "+3V3"); p.assign("U5", 2, "GND")
p.assign("U5", 3, "I2C_SCL"); p.assign("U5", 4, "I2C_SDA")
# DS18B20 + its pull-up
p.assign("CN3", 1, "+3V3"); p.assign("CN3", 2, "DS18B20"); p.assign("CN3", 3, "GND")
p.assign("R1", 1, "+3V3"); p.assign("R1", 2, "DS18B20")
# I2C pull-ups - fit only with bare sensor chips
p.assign("R5", 1, "+3V3"); p.assign("R5", 2, "I2C_SDA")
p.assign("R6", 1, "+3V3"); p.assign("R6", 2, "I2C_SCL")
# debug UART
p.assign("CN4", 1, "+5V"); p.assign("CN4", 2, "GND")
p.assign("CN4", 3, "RX0"); p.assign("CN4", 4, "TX0")
# switches
# indicators
p.assign("R4", 1, "LED1_A"); p.assign("R4", 2, "K1")
p.assign("LED1", 2, "K1"); p.assign("LED1", 1, "GND")

# ── silkscreen ──────────────────────────────────────────────────────────
p.text("PFUMA  CN-02  COLLAR NODE", 46, 5.0, 2.0)
p.text("Rev B / single sided / GND = bottom pour", 46, 9.0, 1.1)
p.text("U3 Ra-02 solders on the COPPER side.  Mirror B.Cu before etching.", 55, 136.0, 1.1)
p.text("R5/R6 = DNF (breakouts have pull-ups) . U8 SOT-223 on copper side", 55, 132.5, 1.1)
for i, n in enumerate(DEV_L):
    p.text(n, LX - 6.0, Y0 + i * 2.54 + 0.4, 0.8)
for i, n in enumerate(DEV_R):
    p.text(n, RX + 6.0, Y0 + i * 2.54 + 0.4, 0.8)
p.text("U1  ESP32-WROOM-32 DEVKIT 38-PIN", 64.7, 36.0, 1.1)
p.text("U3 Ra-02 (copper side)", 100, 100, 1.0)
p.text("ANT KEEP-OUT", 108, 131, 1.2)
p.text("J1", 86, 101, 1.0); p.text("J2", 124, 104, 1.0)
p.text("J3 REG", 51, 11, 1.0)
for ref, lbls, x, y in (
        ("U2", ("VCC", "RX", "TX", "GND"), 142.5, 30),
        ("U4", ("VCC", "GND", "SCL", "SDA", "XDA", "XCL", "AD0", "INT"), 142.5, 50),
        ("U5", ("VIN", "GND", "SCL", "SDA", "INT"), 142.5, 76),
        ("CN3", ("3V3", "DQ", "GND"), 142.5, 96),
        ("CN4", ("5V", "GND", "RX", "TX"), 142.5, 112),
        ("U7", ("IN+", "IN-", "B+", "B-", "O+", "O-"), 20.5, 8),
        ("U9", ("IN+", "IN-", "O+", "O-"), 30.5, 8),
        ("CN1", ("BAT+", "BAT-"), 10.5, 10),
        ("CN2", ("SOL+", "SOL-"), 10.5, 20)):
    for k, lb in enumerate(lbls):
        p.text(lb, x, y + k * 2.54 + 0.4, 0.8)
    p.text(ref, x - 2.0, y - 3.5, 1.0)

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
rt.stamp_rect(98, 126, 122, 138)                    # antenna keep-out

FANOUT = [("SPI_SCK", "U3", "12", "J1", "5"), ("SPI_MISO", "U3", "13", "J1", "4"),
          ("SPI_MOSI", "U3", "14", "J1", "3"), ("LORA_NSS", "U3", "15", "J1", "2"),
          ("+3V3", "U3", "3", "J2", "1"), ("LORA_RST", "U3", "4", "J2", "2"),
          ("LORA_DIO0", "U3", "5", "J2", "3"),
          ("+3V3", "U8", "2", "J3", "2"), ("+5V", "U8", "3", "J3", "3")]
fails = []
for net, sref, spad, jref, jpad in FANOUT:
    fails += rt.route_net(net, [(sref, spad), (jref, jpad)], W_SIG)

PLAN = [("GND", W_SIG),
        ("TX0", W_SIG), ("RX0", W_SIG),
        ("I2C_SCL", W_SIG), ("I2C_SDA", W_SIG), ("MPU_INT", W_SIG),
        ("GPS_TX", W_SIG), ("GPS_RX", W_SIG), ("DS18B20", W_SIG),
        ("LED1_A", W_SIG), ("K1", W_SIG),
        ("VBAT_SENSE", W_SIG),
        ("SPI_SCK", W_SIG), ("SPI_MISO", W_SIG), ("SPI_MOSI", W_SIG),
        ("LORA_NSS", W_SIG), ("LORA_DIO0", W_SIG), ("LORA_RST", W_SIG),
        ("+3V3", W_3V3), ("+5V", W_PWR), ("VBAT", W_PWR), ("VSOL", W_PWR),
        ("GND", W_3V3), ("GND", W_SIG)]
fanned = set((sref, spad) for _, sref, spad, _, _ in FANOUT)
for net, w in PLAN:
    pl = [q for q in pads_of(net) if q not in fanned]
    if len(pl) > 1:
        fails += rt.route_net(net, pl, w)

links, unresolved = fit_links(p, fails, pads_of, [], rt)
print("\nB.Cu hops unrouted: %d   links fitted: %d   unresolved: %d"
      % (len(fails), len(links), len(unresolved)))
for u in unresolved:
    print("   XX %-12s %s.%s  (%s)" % u)
p.text("WIRE LINKS: %d + %d hand-fit" % (len(links), len(unresolved)), 55, 129, 1.1)
p.pour("GND")
p.fill()
print("saved", p.save(os.path.join(HERE, "CN-02", "CN-02.kicad_pcb")))
