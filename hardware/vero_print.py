"""Print-ready A4 build books for the veroboard builds."""
import sys, collections, html
sys.path.insert(0, ".")
import vero
from vero_pins import DEVL, DEVR, LABEL

CSS = """
@page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff;
       font-size: 9.6pt; margin: 0; }
h1 { font-size: 17pt; margin: 0 0 2px; }
h2 { font-size: 12pt; margin: 0 0 8px; padding-bottom: 4px;
     border-bottom: 2px solid #000; }
.sub { font-size: 9pt; color: #444; margin-bottom: 14px; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
table { border-collapse: collapse; width: 100%; font-family: Consolas, monospace;
        font-size: 8.4pt; }
th { background: #000; color: #fff; text-align: left; padding: 4px 6px; }
td { border-bottom: 1px solid #ccc; padding: 2.6px 6px; vertical-align: top;
     white-space: nowrap; }
td:last-child { white-space: normal; word-break: break-all; }
tr:nth-child(even) td { background: #f4f4f4; }
.box { font-family: Consolas, monospace; font-size: 11pt; }
.warn { border: 2px solid #000; padding: 9px 12px; margin-bottom: 14px;
        font-size: 9.2pt; background: #f0f0f0; }
.warn b { text-transform: uppercase; letter-spacing: .5px; }
.free { background: #ffe9e9 !important; }
.free td { font-weight: 600; }
svg { width: 100%; height: auto; }
.note { font-size: 8.4pt; color: #333; margin-top: 8px; }
"""

def printable_svg(path):
    s = open(path, encoding="utf-8").read()
    for a, b in (("#f5f0e4", "#ffffff"), ("#d8bc8a", "#ffffff"),
                 ("#c47f3a", "#c9c9c9"), ("#f7efdd", "#ffffff"),
                 ("#a9855a", "#888888"), ("#6b5636", "#333333")):
        s = s.replace(a, b)
    return s

def book(fn, title, svgpath, out):
    v, rows = fn()
    cuts, wires, _ = v.solve()
    def devlab(tag):
        ref, i = tag.split("."); return (DEVL if ref == "U1A" else DEVR)[int(i) - 1]
    P = ['<meta charset="utf-8"><title>%s build book</title><style>%s</style>' % (title, CSS)]

    # 1 - diagram
    P.append('<div class="page"><h1>%s</h1><div class="sub">Veroboard build book &mdash; '
             '%d strip cuts, %d wire links. Strips run left-right.</div>%s'
             '<div class="note">Hole addresses are (col,row); the numbers run along the '
             'top and left edge of the diagram.</div></div>' % (title, len(cuts), len(wires), printable_svg(svgpath)))

    # 2 - cuts
    P.append('<div class="page"><h2>Step 1 &mdash; cut %d strips</h2>'
             '<div class="warn"><b>Do this before any part goes in.</b> Once the devkit is '
             'fitted you cannot reach the cuts underneath it. Meter every cut: probe either '
             'side, it must read open circuit.</div><table>'
             '<tr><th>&#9744;</th><th>Row</th><th>Cut between</th><th>Separates</th></tr>' % len(cuts))
    occ = collections.defaultdict(list)
    for c, r, n, t in v.pins:
        occ[r].append((c, n, t))
    for r, c1, c2 in sorted(cuts):
        left = [n for c, n, t in sorted(occ[r]) if c <= c1]
        right = [n for c, n, t in sorted(occ[r]) if c >= c2]
        sep = "%s | %s" % (left[-1] if left else "?", right[0] if right else "?")
        sep = sep.replace("NC_L", "spare U1A.").replace("NC_R", "spare U1B.")
        P.append('<tr><td class="box">&#9744;</td><td>%d</td><td>col %d and col %d</td>'
                 '<td>%s</td></tr>' % (r, c1, c2, html.escape(sep)))
    P.append('</table></div>')

    # 3 - strip map
    cutrow = collections.defaultdict(list)
    for r, c1, c2 in cuts:
        cutrow[r].append((c1 + c2) // 2)
    P.append('<div class="page"><h2>Step 2 &mdash; strip map</h2>'
             '<div class="warn"><b>Check this before soldering into any new hole.</b> '
             'Find the row, find the column range: that is what the hole is already '
             'joined to. Rows shaded pink must stay empty.</div><table>'
             '<tr><th>Row</th><th>Cols</th><th>Net</th><th>Pins in this segment</th></tr>')
    for r in range(rows):
        b = [0] + sorted(cutrow[r]) + [vero.COL - 1]
        for i in range(len(b) - 1):
            lo, hi = (b[i] if i == 0 else b[i] + 1), b[i + 1]
            seg = [(c, n, t) for c, n, t in sorted(occ[r]) if lo <= c <= hi]
            if not seg: continue
            net, cls = seg[0][1], ""
            if net.startswith("NC_"):
                net, cls = "LEAVE EMPTY &mdash; devkit %s" % devlab(seg[0][2]), ' class="free"'
            P.append('<tr%s><td>%d</td><td>%d-%d</td><td>%s</td><td>%s</td></tr>'
                     % (cls, r, lo, hi, net,
                        " ".join("%s@c%d" % (t, c) for c, n, t in seg)))
    P.append('</table></div>')

    # 4 - pins
    P.append('<div class="page"><h2>Step 3 &mdash; every pin, where it goes</h2><table>'
             '<tr><th>&#9744;</th><th>Part.pin</th><th>Label on part</th><th>Net</th><th>Hole</th></tr>')
    byref = collections.defaultdict(list)
    for c, r, n, t in v.pins:
        byref[t.split(".")[0]].append((t, n, c, r))
    for ref in sorted(byref):
        for t, n, c, r in sorted(byref[ref], key=lambda q: (q[3], q[2])):
            idx = t.split(".")[-1]
            if ref == "U1A" and idx.isdigit(): lab = DEVL[int(idx) - 1]
            elif ref == "U1B" and idx.isdigit(): lab = DEVR[int(idx) - 1]
            elif ref in LABEL and idx.isdigit() and int(idx) <= len(LABEL[ref]):
                lab = LABEL[ref][int(idx) - 1]
            else: lab = idx
            free = n.startswith("NC_")
            P.append('<tr%s><td class="box">%s</td><td>%s</td><td>%s</td><td>%s</td>'
                     '<td>col %d, row %d</td></tr>'
                     % (' class="free"' if free else "", "&mdash;" if free else "&#9744;",
                        t, lab, "LEAVE FREE" if free else n, c, r))
    P.append('</table></div>')

    # 5 - wires
    P.append('<div class="page"><h2>Step 4 &mdash; solder %d wire links</h2>'
             '<div class="warn">Insulated wire on the component side. Tick as you go, and '
             'buzz each one out after fitting.</div><table>'
             '<tr><th>&#9744;</th><th>Net</th><th>From</th><th>To</th></tr>' % len(wires))
    for n, c1, r1, c2, r2 in sorted(wires):
        P.append('<tr><td class="box">&#9744;</td><td>%s</td><td>col %d, row %d</td>'
                 '<td>col %d, row %d</td></tr>' % (n, c1, r1, c2, r2))
    P.append('</table>')
    P.append('<h2 style="margin-top:18px">Before power</h2><table>'
             '<tr><th>&#9744;</th><th>Meter check</th><th>Expect</th></tr>')
    for a, b2 in (("GND to +3V3", "open"), ("GND to +5V", "open"),
                  ("GND to VBAT / +12V", "open"), ("every cut, across it", "open")):
        P.append('<tr><td class="box">&#9744;</td><td>%s</td><td>%s</td></tr>' % (a, b2))
    P.append('</table></div>')
    open(out, "w", encoding="utf-8").write("".join(P))
    return len(cuts), len(wires)

for fn, title, svgp, out in ((vero.bs02, "BS-02 Base Station", "VERO_BS02.svg", "VERO_BS02_BOOK.html"),
                             (vero.cn02, "CN-02 Collar Node", "VERO_CN02.svg", "VERO_CN02_BOOK.html")):
    c, w = book(fn, title, svgp, out)
    print("%-22s %2d cuts %2d wires -> %s" % (title, c, w, out))
