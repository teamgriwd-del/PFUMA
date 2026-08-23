"""Per-pin soldering schedule + strip map, derived from the vero placement."""
import sys, collections
sys.path.insert(0, ".")
import vero

DEVL = ["3V3","EN","VP/IO36","VN/IO39","IO34","IO35","IO32","IO33","IO25","IO26",
        "IO27","IO14","IO12","GND","IO13","SD2","SD3","CMD","5V"]
DEVR = ["GND","IO23","IO22","TX0","RX0","IO21","GND","IO19","IO18","IO5","IO17",
        "IO16","IO4","IO0","IO2","IO15","SD1","SD0","CLK"]
RA02 = {1:"ANT",2:"GND",3:"VDD 3.3V",4:"RESET",5:"DIO0",6:"DIO1",7:"DIO2",8:"DIO3",
        9:"GND",10:"DIO4",11:"DIO5",12:"SCK",13:"MISO",14:"MOSI",15:"NSS",16:"GND"}
LABEL = {
 "U2_GPS":["VCC","RX","TX","GND"],
 "U4":["VCC","GND","SCL","SDA","XDA","XCL","AD0","INT"],
 "U5":["VIN","GND","SCL","SDA","INT"],
 "U3_OLED":["GND","VCC","SCL","SDA"],
 "U8":["1 GND/ADJ","2 VOUT (+tab)","3 VIN"],
 "U5R":["1 GND/ADJ","2 VOUT (+tab)","3 VIN"],
 "CN4":["1 5V","2 GND","3 RX0","4 TX0"],
 "CN2U":["1 5V","2 GND","3 RX0","4 TX0"],
 "CN3":["1 3V3","2 DATA (yellow)","3 GND (black)"],
}

def report(v, rows, cuts, wires, title, path, devcolL, devcolR, devrow0):
    L = ["%s - SOLDERING SCHEDULE" % title, "=" * 72, "",
         "Hole address is (col,row). Strips run LEFT-RIGHT: every hole in a row is",
         "joined unless a cut separates it. CHECK THE STRIP MAP before soldering",
         "anything into a hole you have not used yet.", ""]

    # ---------- strip map ----------
    cutrow = collections.defaultdict(list)
    for r, c1, c2 in cuts:
        cutrow[r].append((c1 + c2) // 2)
    occ = collections.defaultdict(list)
    for c, r, n, t in v.pins:
        occ[r].append((c, n, t))
    def devlab(tag):
        ref, i = tag.split("."); i = int(i)
        return (DEVL if ref == "U1A" else DEVR)[i - 1]
    L += ["SECTION 1 - STRIP MAP (what every piece of copper carries)", "-" * 72,
          "%-5s %-9s %-26s %s" % ("ROW", "COLS", "NET", "PINS IN THIS SEGMENT")]
    for r in range(rows):
        bounds = [0] + sorted(cutrow[r]) + [vero.COL - 1]
        for i in range(len(bounds) - 1):
            lo = bounds[i] if i == 0 else bounds[i] + 1
            hi = bounds[i + 1]
            inseg = [(c, n, t) for c, n, t in sorted(occ[r]) if lo <= c <= hi]
            if not inseg:
                continue
            net = inseg[0][1]
            if net.startswith("NC_"):
                show = "FREE - devkit %s, LEAVE EMPTY" % devlab(inseg[0][2])
            else:
                show = net
            L.append("%-5d %-9s %-26s %s" % (r, "%d-%d" % (lo, hi), show,
                     " ".join("%s@c%d" % (t, c) for c, n, t in inseg)))
    # ---------- per-pin ----------
    L += ["", "SECTION 2 - EVERY PIN, WHERE IT GOES", "-" * 72]
    L.append("%-12s %-16s %-13s %s" % ("PART.PIN", "LABEL ON PART", "NET", "HOLE"))
    byref = collections.defaultdict(list)
    for c, r, n, t in v.pins:
        byref[t.split(".")[0]].append((t, n, c, r))
    for ref in sorted(byref):
        for t, n, c, r in sorted(byref[ref], key=lambda q: (q[3], q[2])):
            idx = t.split(".")[-1]
            lab = ""
            if ref == "U1A" and idx.isdigit(): lab = DEVL[int(idx) - 1]
            elif ref == "U1B" and idx.isdigit(): lab = DEVR[int(idx) - 1]
            elif ref in ("U3", "U2") and not idx.isdigit(): lab = idx
            elif ref in LABEL and idx.isdigit() and int(idx) <= len(LABEL[ref]):
                lab = LABEL[ref][int(idx) - 1]
            else: lab = idx
            net = "LEAVE FREE" if n.startswith("NC_") else n
            L.append("%-12s %-16s %-13s (col %2d, row %2d)" % (t, lab, net, c, r))
    # ---------- wires ----------
    L += ["", "SECTION 3 - WIRE LINKS, HOLE TO HOLE", "-" * 72]
    for n, c1, r1, c2, r2 in sorted(wires):
        L.append("  [ ] %-11s  from (col %2d, row %2d)  to (col %2d, row %2d)"
                 % (n, c1, r1, c2, r2))
    L += ["", "SECTION 4 - PINS THAT MUST STAY UNCONNECTED", "-" * 72,
          "Solder nothing into these holes. Let no wire or lead touch them.", ""]
    for c, r, n, t in sorted(v.pins, key=lambda q: (q[1], q[0])):
        if not n.startswith("NC_"):
            continue
        lab = devlab(t)
        if lab.startswith(("SD", "CMD", "CLK")):
            why = "FLASH PIN - devkit will not boot if loaded"
        elif lab == "3V3":
            why = "devkit 3V3 OUTPUT - shorting this kills the regulator"
        elif lab == "EN":
            why = "reset pin - pulling it low holds the chip in reset"
        else:
            why = "unused GPIO - spare"
        L.append("  (col %2d, row %2d)  %-8s %-9s %s" % (c, r, t, lab, why))
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")
    return len(L)

for fn, title, out in ((vero.bs02, "BS-02 BASE STATION", "VERO_BS02_PINS.txt"),
                       (vero.cn02, "CN-02 COLLAR NODE", "VERO_CN02_PINS.txt")):
    v, rows = fn()
    cuts, wires, _ = v.solve()
    n = report(v, rows, cuts, wires, title, out, 14, 24, 4)
    print("%-22s -> %s (%d lines)" % (title, out, n))
