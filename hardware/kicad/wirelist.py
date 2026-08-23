"""Turn each board's DRC 'unconnected' list into a build sheet of wires to fit."""
import re, os, sys

def build(board):
    src = os.path.join(board, "drc.txt")
    txt = open(src, encoding="utf-8", errors="ignore").read()
    blocks = txt.split("[unconnected_items]")[1:]
    pat = re.compile(r"@\(([-\d.]+) mm, ([-\d.]+) mm\): \w+ pad (\S+) \[([^\]]*)\] of (\S+)")
    pairs, seen = [], set()
    for b in blocks:
        m = pat.findall(b)
        if len(m) < 2:
            continue
        (x1, y1, p1, net, r1), (x2, y2, p2, _, r2) = m[0], m[1]
        a, z = "%s.%s" % (r1, p1), "%s.%s" % (r2, p2)
        key = (net, frozenset((a, z)))
        if key in seen:
            continue
        seen.add(key)
        d = ((float(x1) - float(x2)) ** 2 + (float(y1) - float(y2)) ** 2) ** 0.5
        pairs.append((net, a, z, d))
    pairs.sort(key=lambda t: (t[0], t[3]))
    out = [board + " - WIRES TO FIT BY HAND",
           "=" * 46,
           "Solder insulated hookup wire on the COMPONENT side between each",
           "pair below. Everything else is etched copper on the bottom.",
           ""]
    for net, a, z, d in pairs:
        out.append("  [ ] %-12s %-10s -> %-10s  (%.0f mm)" % (net, a, z, d))
    out.append("")
    out.append("total: %d wires" % len(pairs))
    open(os.path.join(board, "WIRES_TO_FIT.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    return len(pairs)

for b in ("BS-02", "CN-02"):
    print(b, "->", build(b), "hand-fit wires")
