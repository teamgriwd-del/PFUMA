"""Render the veroboard designs as real KiCad boards.

Holes become pads, strips become B.Cu tracks broken at the cuts, wire links
become F.Cu tracks. Nets come from the solver, so KiCad's own connectivity
check confirms the strips really do join what the design says they join.
"""
import sys, collections
sys.path.insert(0, ".")
import pcbnew, vero
from vero_pins import DEVL, DEVR

PITCH = 2.54
OX, OY = 15.0, 30.0
STRIP_W = 1.8            # veroboard copper strip width
LINK_W  = 0.6
CUTGAP  = 1.5            # gap left where a strip is cut


def V(x, y):  return pcbnew.VECTOR2I(int(round(x * 1e6)), int(round(y * 1e6)))
def hx(c):    return OX + c * PITCH
def hy(r):    return OY + r * PITCH


class VeroPCB:
    def __init__(self, name, rows):
        self.b = pcbnew.CreateEmptyBoard()
        self.rows = rows
        self.name = name
        self.nets = {}
        ds = self.b.GetDesignSettings()
        ds.SetCopperLayerCount(2)

    def net(self, n):
        if n not in self.nets:
            ni = pcbnew.NETINFO_ITEM(self.b, n)
            self.b.Add(ni)
            self.nets[n] = ni
        return self.nets[n]

    def hole(self, ref, c, r, netname, label):
        fp = pcbnew.FOOTPRINT(self.b)
        fp.SetReference(ref)
        fp.SetValue(label or "")
        fp.Reference().SetVisible(False)
        fp.Value().SetVisible(False)
        pad = pcbnew.PAD(fp)
        pad.SetNumber("1")
        pad.SetAttribute(pcbnew.PAD_ATTRIB_PTH)
        pad.SetShape(pcbnew.PAD_SHAPE_CIRCLE)
        pad.SetSize(pcbnew.VECTOR2I(int(1.7e6), int(1.7e6)))
        pad.SetDrillSize(pcbnew.VECTOR2I(int(1.0e6), int(1.0e6)))
        pad.SetLayerSet(pad.PTHMask())
        pad.SetNet(self.net(netname if netname and not netname.startswith("NC_")
                            else "SPARE_" + ref))
        fp.SetPosition(V(hx(c), hy(r)))      # footprint first
        fp.Add(pad)
        pad.SetPosition(V(hx(c), hy(r)))     # then the pad, absolute
        self.b.Add(fp)
        return fp

    def track(self, x1, y1, x2, y2, layer, width, netname=None):
        t = pcbnew.PCB_TRACK(self.b)
        t.SetStart(V(x1, y1)); t.SetEnd(V(x2, y2))
        t.SetWidth(int(width * 1e6)); t.SetLayer(layer)
        if netname and not netname.startswith("NC_"):
            t.SetNet(self.net(netname))
        self.b.Add(t)

    def line(self, x1, y1, x2, y2, layer, w=0.15):
        s = pcbnew.PCB_SHAPE(self.b)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(V(x1, y1)); s.SetEnd(V(x2, y2))
        s.SetLayer(layer); s.SetWidth(int(w * 1e6))
        self.b.Add(s)

    def rect(self, x1, y1, x2, y2, layer, w=0.2):
        for a in ((x1, y1, x2, y1), (x2, y1, x2, y2),
                  (x2, y2, x1, y2), (x1, y2, x1, y1)):
            self.line(a[0], a[1], a[2], a[3], layer, w)

    def text(self, s, x, y, layer, size=1.2, bold=True, just=None):
        t = pcbnew.PCB_TEXT(self.b)
        t.SetText(s); t.SetLayer(layer); t.SetPosition(V(x, y))
        t.SetTextSize(pcbnew.VECTOR2I(int(size * 1e6), int(size * 1e6)))
        t.SetTextThickness(int((0.22 if bold else 0.15) * 1e6))
        t.SetBold(bold)
        t.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_LEFT if just is None else just)
        self.b.Add(t)

    def save(self, path):
        self.b.Save(path)


def build(fn, title, out):
    v, rows = fn()
    cuts, wires, _ = v.solve()
    p = VeroPCB(title, rows)
    B, F = pcbnew.B_Cu, pcbnew.F_Cu
    SILK, CMT, DWG = pcbnew.F_SilkS, pcbnew.B_SilkS, pcbnew.Dwgs_User

    L = hx(0) - PITCH * 2.4; R = hx(vero.COL - 1) + PITCH * 2.4
    T = hy(0) - 17.0; Bo = hy(rows - 1) + PITCH * 3.2
    p.rect(L, T, R, Bo, pcbnew.Edge_Cuts, 0.3)

    used = {(c, r): (n, t) for c, r, n, t in v.pins}
    cutrow = collections.defaultdict(list)
    for r, c1, c2 in cuts:
        cutrow[r].append((hx(c1) + hx(c2)) / 2.0)

    # ---- copper strips, broken at each cut
    for r in range(rows):
        xs = sorted(cutrow[r])
        bounds = [L + 2.0] + [x for x in xs] + [R - 2.0]
        for i in range(len(bounds) - 1):
            x1 = bounds[i] + (CUTGAP / 2 if i else 0)
            x2 = bounds[i + 1] - (CUTGAP / 2 if i + 1 < len(bounds) - 1 else 0)
            seg = [(c, n) for (c, rr), (n, t) in used.items() if rr == r
                   and x1 - 1 <= hx(c) <= x2 + 1]
            net = None
            for c, n in seg:
                if not n.startswith("NC_"):
                    net = n; break
            if net is None:
                nc = [t for (cc, rr), (n2, t) in used.items()
                      if rr == r and x1 - 1 <= hx(cc) <= x2 + 1 and n2.startswith("NC_")]
                net = "SPARE_" + nc[0] if nc else "SPARE_r%d_%d" % (r, i)
            p.track(x1, hy(r), x2, hy(r), B, STRIP_W, net)
        # cut markers
        for x in xs:
            for dx, dy in ((-1, -1), (1, -1)):
                p.line(x + dx * 1.25, hy(r) + dy * 1.25, x - dx * 1.25, hy(r) - dy * 1.25, CMT, 0.55)

    # ---- holes
    for r in range(rows):
        for c in range(vero.COL):
            if (c, r) in used:
                n, t = used[(c, r)]
                p.hole(t, c, r, n, t)
            else:
                s = pcbnew.PCB_SHAPE(p.b)
                s.SetShape(pcbnew.SHAPE_T_CIRCLE)
                s.SetCenter(V(hx(c), hy(r))); s.SetEnd(V(hx(c) + 0.5, hy(r)))
                s.SetLayer(DWG); s.SetWidth(int(0.12 * 1e6))
                p.b.Add(s)

    # ---- wire links on the component side.
    # Routed through the gutters between holes so a link never lies on top of
    # a pad it does not belong to. Physically it is insulated wire, so links
    # crossing each other is fine; links touching foreign pads is not.
    H = PITCH / 2.0
    for n, c1, r1, c2, r2 in wires:
        xa, ya = hx(c1), hy(r1)
        xb, yb = hx(c2), hy(r2)
        ax, bx = xa + H, xb + H
        ymid = hy(min(r1, r2)) + H
        pts = [(xa, ya), (ax, ya), (ax, ymid), (bx, ymid), (bx, yb), (xb, yb)]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if abs(x1 - x2) < 1e-6 and abs(y1 - y2) < 1e-6:
                continue
            p.track(x1, y1, x2, y2, F, LINK_W, n)

    # ---- component outlines with non-overlapping labels
    taken = []
    # reserve the title band and every module caption before placing part labels
    taken.append((L, T - 2.0, R - L, 14.0))
    for c0, c1, r0, r1, lab in v.bodies:
        taken.append(((hx(c0) + hx(c1)) / 2 - len(lab) * 0.72, hy(r0) - 5.6,
                      len(lab) * 1.5, 3.2))
        taken.append(((hx(c0) + hx(c1)) / 2 - 17.0, hy(r1) + 3.2, 34.0, 3.0))
    def free(x, y, w, h):
        return not any(not (x + w < bx or bx + bw < x or y + h < by or by + bh < y)
                       for bx, by, bw, bh in taken)
    def place(x, y, w, h):
        x = min(x, R - w - 2.0)                      # never overrun the right edge
        for step in range(10):
            yy = y - step * 2.1
            for dx in (0, w * 0.5, -w * 0.5, -w, -w * 1.5):
                if x + dx >= L + 1 and free(x + dx, yy, w, h):
                    taken.append((x + dx, yy, w, h)); return x + dx, yy
        taken.append((x, y, w, h)); return x, y
    for ref, lab, c0, r0, r1 in v.blocks:
        x1, y1 = hx(c0) - 1.5, hy(r0) - 1.5
        x2, y2 = hx(c0) + 1.5, hy(r1) + 1.5
        p.rect(x1, y1, x2, y2, SILK, 0.18)
        if ref in ("U1A", "U1B"):
            continue
        txt = ref + ((" " + lab) if lab else "")
        w = len(txt) * 1.42
        lx, ly = place(x1, y1 - 3.0, w, 2.8)
        p.text(txt, lx, ly, SILK, 1.55)
    for c0, c1, r0, r1, lab in v.bodies:
        p.rect(hx(c0) - 2.2, hy(r0) - 2.2, hx(c1) + 2.2, hy(r1) + 2.2, SILK, 0.25)
        bx = (hx(c0) + hx(c1)) / 2 - len(lab) * 0.72
        p.text(lab, bx, hy(r0) - 3.8, SILK, 1.8)
        p.text("CUT ALL STRIPS UNDER THIS MODULE", (hx(c0) + hx(c1)) / 2 - 12,
               hy(r1) + 4.6, SILK, 1.35, bold=False)

    # ---- grid numbering
    for c in range(0, vero.COL, 5):
        p.text(str(c), hx(c) - 1.1, T + 1.6, SILK, 1.35, bold=False)
    for r in range(rows):
        p.text(str(r), L + 0.8, hy(r), SILK, 1.35, bold=False)
        p.text(str(r), R - 3.4, hy(r), SILK, 1.35, bold=False)
    p.text("%s  VEROBOARD  -  %d cuts, %d wire links" % (title, len(cuts), len(wires)),
           L + 3, T + 4.6, SILK, 2.8)
    p.text("GOLD = copper strip.  RED X = CUT THE STRIP HERE.  BLUE = insulated wire on top.",
           L + 3, T + 9.5, SILK, 1.8, bold=False)
    p.save(out)
    return len(cuts), len(wires), rows


if __name__ == "__main__":
    import os
    for fn, title, d in ((vero.bs02, "BS-02", "vero_kicad/BS-02-VERO"),
                         (vero.cn02, "CN-02", "vero_kicad/CN-02-VERO")):
        os.makedirs(os.path.dirname(d), exist_ok=True)
        c, w, r = build(fn, title, d + ".kicad_pcb")
        print("%-6s %2d cuts %2d wires %2d rows -> %s.kicad_pcb" % (title, c, w, r, d))
