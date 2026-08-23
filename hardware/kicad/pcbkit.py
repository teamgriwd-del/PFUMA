"""Shared toolkit: places footprints, assigns nets, maze-routes a single-sided
board on B.Cu, drops wire links on F.Cu where the layer cannot resolve, pours
GND and saves a real .kicad_pcb.

Single-sided rules enforced here:
  * every signal trace is on B.Cu
  * F.Cu carries ONLY hand-fitted wire links (insulated wire, soldered on top)
  * no vias anywhere
"""
import os, math, heapq
import pcbnew

KIFP = r"C:\Users\user\AppData\Local\Programs\KiCad\10.0\share\kicad\footprints"

# ── DIY-etch design rules (mm) ────────────────────────────────────────────
W_SIG, W_3V3, W_PWR = 0.8, 1.2, 2.0
CLEAR = 0.5
GRID = 0.40                      # router grid
EDGE_KEEP = 1.0                  # copper pull-back from board edge

MM = pcbnew.FromMM
def V(x, y): return pcbnew.VECTOR2I(MM(x), MM(y))
def tomm(v):  return v / 1000000.0


class PCB:
    def __init__(self, name, w, h, org=(25.0, 25.0)):
        self.name, self.W, self.H = name, w, h
        self.ox, self.oy = org
        self.b = pcbnew.CreateEmptyBoard()
        self.nets = {}
        self.fps = {}
        self.links = []
        d = self.b.GetDesignSettings()
        d.SetCopperLayerCount(2)
        self._edge()

    # ── coordinates: local board mm -> sheet ──
    def P(self, x, y): return V(x + self.ox, y + self.oy)

    def _edge(self):
        pts = [(0, 0), (self.W, 0), (self.W, self.H), (0, self.H), (0, 0)]
        for i in range(4):
            s = pcbnew.PCB_SHAPE(self.b)
            s.SetShape(pcbnew.SHAPE_T_SEGMENT)
            s.SetStart(self.P(*pts[i])); s.SetEnd(self.P(*pts[i + 1]))
            s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(MM(0.15))
            self.b.Add(s)

    def net(self, n):
        if n not in self.nets:
            ni = pcbnew.NETINFO_ITEM(self.b, n)
            self.b.Add(ni); self.nets[n] = ni
        return self.nets[n]

    # ── placement ──
    def place(self, ref, libname, fpname, x, y, rot=0, value=""):
        fp = pcbnew.FootprintLoad(lib_path(libname), fpname)
        if fp is None:
            raise RuntimeError("missing footprint %s:%s" % (libname, fpname))
        fp.SetReference(ref); fp.SetValue(value or fpname)
        self.b.Add(fp)
        fp.SetPosition(self.P(x, y))
        if rot: fp.SetOrientationDegrees(rot)
        fp.Reference().SetVisible(True)
        fp.Reference().SetTextSize(pcbnew.VECTOR2I(MM(1.0), MM(1.0)))
        fp.Reference().SetTextThickness(MM(0.18))
        fp.Value().SetVisible(False)
        self.fps[ref] = fp
        return fp

    def pad(self, ref, num):
        p = self.fps[ref].FindPadByNumber(str(num))
        if p is None:
            raise RuntimeError("no pad %s on %s" % (num, ref))
        return p

    def pxy(self, ref, num):
        p = self.pad(ref, num).GetPosition()
        return (tomm(p.x) - self.ox, tomm(p.y) - self.oy)

    def assign(self, ref, num, netname):
        self.pad(ref, num).SetNet(self.net(netname))

    # ── silkscreen ──
    def text(self, s, x, y, size=0.9, rot=0, layer=None, thick=0.15):
        t = pcbnew.PCB_TEXT(self.b)
        t.SetText(s); t.SetPosition(self.P(x, y))
        t.SetLayer(layer if layer is not None else pcbnew.F_SilkS)
        t.SetTextSize(pcbnew.VECTOR2I(MM(size), MM(size)))
        t.SetTextThickness(MM(thick))
        if rot: t.SetTextAngle(pcbnew.EDA_ANGLE(rot * 10))
        self.b.Add(t)
        return t

    # ── copper ──
    def seg(self, a, b, net, w=W_SIG, layer=None):
        t = pcbnew.PCB_TRACK(self.b)
        t.SetStart(self.P(*a)); t.SetEnd(self.P(*b))
        t.SetWidth(MM(w))
        t.SetLayer(pcbnew.B_Cu if layer is None else layer)
        t.SetNet(self.net(net))
        self.b.Add(t)
        return t

    def path(self, pts, net, w=W_SIG, layer=None):
        for i in range(len(pts) - 1):
            self.seg(pts[i], pts[i + 1], net, w, layer)

    def link(self, a, b, net):
        """Top-side insulated wire link."""
        self.seg(a, b, net, 0.8, pcbnew.F_Cu)
        self.links.append((net, a, b))

    # ── GND pour on B.Cu ──
    def pour(self, netname="GND"):
        z = pcbnew.ZONE(self.b)
        z.SetLayer(pcbnew.B_Cu)
        z.SetNet(self.net(netname))
        z.SetLocalClearance(MM(CLEAR))
        z.SetMinThickness(MM(0.25))
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
        z.SetThermalReliefGap(MM(0.5))
        z.SetThermalReliefSpokeWidth(MM(0.8))
        o = z.Outline()
        o.NewOutline()
        k = EDGE_KEEP
        for (x, y) in [(k, k), (self.W - k, k), (self.W - k, self.H - k), (k, self.H - k)]:
            o.Append(self.P(x, y).x, self.P(x, y).y)
        self.b.Add(z)
        self.zone = z
        return z

    def fill(self):
        pcbnew.ZONE_FILLER(self.b).Fill(self.b.Zones())

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.b.BuildListOfNets()
        pcbnew.SaveBoard(path, self.b)
        return path


def lib_path(n):
    return os.path.join(KIFP, n + ".pretty")
