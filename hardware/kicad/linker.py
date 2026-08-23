"""Wire-link fitting for single-sided boards.

A link is an insulated wire soldered on the component side, modelled as an
F.Cu track so KiCad sees the net as connected and DRC stays meaningful.
A link can only land on a THT pad (copper on both sides). The LoRa module is
SMD on the copper side, so any of its nets that the bottom layer cannot
resolve is first brought out to a spare THT anchor pad.
"""
import pcbnew
from router import Router
from pcbkit import W_SIG


def on_fcu(p, ref, num):
    return p.pad(ref, num).IsOnLayer(pcbnew.F_Cu)


def _near(p, a, cands):
    ax, ay = p.pxy(*a)
    return min(cands, key=lambda q: (p.pxy(*q)[0] - ax) ** 2 + (p.pxy(*q)[1] - ay) ** 2)


def fit_links(p, fails, pads_of, anchors, bcu):
    """Returns (links, unresolved). Mutates anchor pads' nets as needed."""
    pool = list(anchors)
    jobs, unresolved = [], []

    # phase 1 - bring bottom-only pads out to a THT anchor on B.Cu
    for (net, ref, num) in fails:
        src = (ref, num)
        if not on_fcu(p, ref, num):
            if not pool:
                unresolved.append((net, ref, num, "no anchor left"))
                continue
            anc = pool.pop(0)
            p.assign(anc[0], anc[1], net)
            if bcu.route_net(net, [src, anc], W_SIG, verbose=False):
                unresolved.append((net, ref, num, "anchor unreachable on B.Cu"))
                continue
            src = anc
        jobs.append((net, src, (ref, num)))

    if not jobs:
        return [], unresolved

    # short links first - a long one laid early walls off the short ones
    def _len(j):
        ax, ay = p.pxy(*j[1])
        cs = [q for q in pads_of(j[0]) if q != j[1]]
        if not cs:
            return 1e9
        bx, by = p.pxy(*min(cs, key=lambda q: (p.pxy(*q)[0] - ax) ** 2 + (p.pxy(*q)[1] - ay) ** 2))
        return (bx - ax) ** 2 + (by - ay) ** 2
    jobs.sort(key=_len, reverse=True)

    # phase 2 - one F.Cu pass now that anchors carry their nets
    fl = Router(p, layer=pcbnew.F_Cu)
    fl.load_pads(w_other=0.4)
    links = []
    done = set()
    for (net, src, orig) in jobs:
        key = (net, frozenset([src]))
        if key in done:
            continue
        cands = [q for q in pads_of(net)
                 if q != src and q != orig and on_fcu(p, q[0], q[1])]
        if not cands:
            unresolved.append((net, orig[0], orig[1], "no F.Cu partner"))
            continue
        tgt = _near(p, src, cands)
        if fl.route_net(net, [src, tgt], 0.4, verbose=False):
            unresolved.append((net, orig[0], orig[1], "F.Cu blocked"))
        else:
            links.append((net, "%s.%s" % src, "%s.%s" % tgt))
            done.add(key)
            done.add((net, frozenset([tgt])))
    return links, unresolved
