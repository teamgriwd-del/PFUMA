"""Maze router (A*, turn-penalised). Defaults to B.Cu; F.Cu used for wire links."""
import math, heapq, pcbnew
from pcbkit import CLEAR, GRID, EDGE_KEEP, W_SIG, tomm

FREE, HARD = 0, -1
INF = 10 ** 15


class Router:
    def __init__(self, pcb, grid=GRID, margin=EDGE_KEEP, layer=None):
        self.p = pcb
        self.layer = pcbnew.B_Cu if layer is None else layer
        self.g = grid
        self.nx = int(pcb.W / grid) + 1
        self.ny = int(pcb.H / grid) + 1
        self.cell = [FREE] * (self.nx * self.ny)
        self.netid = {}
        self.corecells = {}      # pad cores: never overwritten, always reachable
        self._border(margin)

    def idx(self, i, j): return j * self.nx + i
    def to_c(self, x, y): return (int(round(x / self.g)), int(round(y / self.g)))
    def to_mm(self, i, j): return (i * self.g, j * self.g)

    def nid(self, net):
        if net not in self.netid:
            self.netid[net] = len(self.netid) + 1
        return self.netid[net]

    def _border(self, m):
        for j in range(self.ny):
            for i in range(self.nx):
                x, y = self.to_mm(i, j)
                if x < m or y < m or x > self.p.W - m or y > self.p.H - m:
                    self.cell[self.idx(i, j)] = HARD

    def stamp(self, x, y, r, val):
        ci, cj = self.to_c(x, y)
        rr = int(math.ceil(r / self.g))
        for j in range(max(0, cj - rr), min(self.ny, cj + rr + 1)):
            dj2 = (j - cj) ** 2
            for i in range(max(0, ci - rr), min(self.nx, ci + rr + 1)):
                if (i - ci) ** 2 + dj2 > rr * rr:
                    continue
                k = self.idx(i, j)
                if k in self.corecells:
                    continue
                c = self.cell[k]
                if val == HARD or c == HARD:
                    self.cell[k] = HARD
                elif c == FREE:
                    self.cell[k] = val
                elif c != val:
                    self.cell[k] = HARD

    def stamp_rect(self, x0, y0, x1, y1, val=HARD):
        i0, j0 = self.to_c(x0, y0)
        i1, j1 = self.to_c(x1, y1)
        for j in range(max(0, j0), min(self.ny, j1 + 1)):
            for i in range(max(0, i0), min(self.nx, i1 + 1)):
                k = self.idx(i, j)
                if k in self.corecells:
                    continue
                if val == HARD or self.cell[k] == HARD:
                    self.cell[k] = HARD
                elif self.cell[k] == FREE:
                    self.cell[k] = val
                elif self.cell[k] != val:
                    self.cell[k] = HARD

    def stamp_seg(self, a, b, r, val):
        n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / (self.g * 0.7)) + 1)
        for t in range(n + 1):
            f = float(t) / n
            self.stamp(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, r, val)

    def load_pads(self, w_other=W_SIG):
        cores = []
        for fp in self.p.b.GetFootprints():
            for pad in fp.Pads():
                pos = pad.GetPosition()
                x = tomm(pos.x) - self.p.ox
                y = tomm(pos.y) - self.p.oy
                sz = pad.GetSize()
                ph = max(tomm(sz.x), tomm(sz.y)) / 2.0
                if not pad.IsOnLayer(self.layer):
                    continue
                nn = pad.GetNetname()
                val = self.nid(nn) if nn else HARD
                self.stamp(x, y, ph + CLEAR + w_other / 2.0, val)
                cores.append((x, y, ph, val))
        for (x, y, ph, val) in cores:
            ci, cj = self.to_c(x, y)
            rr = max(1, int(round(ph / self.g)))
            for j in range(max(0, cj - rr), min(self.ny, cj + rr + 1)):
                for i in range(max(0, ci - rr), min(self.nx, ci + rr + 1)):
                    if (i - ci) ** 2 + (j - cj) ** 2 <= rr * rr:
                        k = self.idx(i, j)
                        self.cell[k] = val
                        self.corecells[k] = val
        self.cores = cores

    def _passable(self, netv, extra):
        n = self.nx * self.ny
        cell = self.cell
        pa = bytearray(n)
        for k in range(n):
            c = cell[k]
            if c == FREE or c == netv:
                pa[k] = 1
        if not extra:
            return pa
        nx, ny, w = self.nx, self.ny, 2 * extra + 1
        tmp = bytearray(n)
        for j in range(ny):
            base = j * nx
            run = 0
            for i in range(nx):
                run = run + 1 if pa[base + i] else 0
                if i >= extra and run > extra:
                    pass
            for i in range(nx):
                lo, hi = i - extra, i + extra
                if lo < 0 or hi >= nx:
                    continue
                ok = 1
                for t in range(lo, hi + 1):
                    if not pa[base + t]:
                        ok = 0
                        break
                tmp[base + i] = ok
        out = bytearray(n)
        for i in range(nx):
            for j in range(ny):
                lo, hi = j - extra, j + extra
                if lo < 0 or hi >= ny:
                    continue
                ok = 1
                for t in range(lo, hi + 1):
                    if not tmp[t * nx + i]:
                        ok = 0
                        break
                out[j * nx + i] = ok
        return out

    def _astar(self, starts, goals, netv, pa):
        nx, ny = self.nx, self.ny
        goalset = set(goals)
        gi = sum(g % nx for g in goals) / float(len(goals))
        gj = sum(g // nx for g in goals) / float(len(goals))
        STEP, TURN = 10, 12


        DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
        best = {}
        pq = []
        for s in starts:
            if not pa[s]:
                continue
            h = (abs(s % nx - gi) + abs(s // nx - gj)) * STEP
            for d in range(4):
                best[(s, d)] = 0
                heapq.heappush(pq, (h, 0, s, d, None))
        seen = {}
        while pq:
            f, g, k, d, par = heapq.heappop(pq)
            if (k, d) in seen:
                continue
            seen[(k, d)] = par
            if k in goalset:
                path = []
                cur = (k, d)
                while cur is not None:
                    path.append(cur[0])
                    cur = seen.get(cur)
                return path[::-1]
            i, j = k % nx, k // nx
            for nd in range(4):
                dx, dy = DIRS[nd]
                ii, jj = i + dx, j + dy
                if ii < 0 or jj < 0 or ii >= nx or jj >= ny:
                    continue
                k2 = jj * nx + ii
                if not pa[k2]:
                    continue
                ng = g + STEP + (TURN if nd != d else 0)
                if best.get((k2, nd), INF) <= ng:
                    continue
                best[(k2, nd)] = ng
                h = (abs(ii - gi) + abs(jj - gj)) * STEP
                heapq.heappush(pq, (ng + h, ng, k2, nd, (k, d)))
        return None

    def _cells_of(self, x, y, ph):
        ci, cj = self.to_c(x, y)
        rr = max(0, int(ph / self.g) - 1)
        out = []
        for j in range(max(0, cj - rr), min(self.ny, cj + rr + 1)):
            for i in range(max(0, ci - rr), min(self.nx, ci + rr + 1)):
                out.append(self.idx(i, j))
        return out or [self.idx(ci, cj)]

    def route_net(self, netname, pads, width=W_SIG, verbose=True):
        netv = self.nid(netname)
        extra = int(math.ceil((width - W_SIG) / 2.0 / self.g))
        if extra < 0:
            extra = 0
        pts = []
        for (r, n) in pads:
            x, y = self.p.pxy(r, n)
            sz = self.p.pad(r, n).GetSize()
            ph = min(tomm(sz.x), tomm(sz.y)) / 2.0
            pts.append((x, y, ph, r, n))
        order = [pts[0]]
        rest = pts[1:]
        while rest:
            last = order[-1]
            rest.sort(key=lambda q: (q[0] - last[0]) ** 2 + (q[1] - last[1]) ** 2)
            order.append(rest.pop(0))
        pa = self._passable(netv, extra)
        src = self._cells_of(order[0][0], order[0][1], order[0][2])
        fails = []
        for tgt in order[1:]:
            goals = self._cells_of(tgt[0], tgt[1], tgt[2])
            path = self._astar(src, goals, netv, pa)
            if path is None:
                fails.append((netname, tgt[3], tgt[4]))
                if verbose:
                    ps = sum(1 for c in src if pa[c])
                    pg = sum(1 for c in goals if pa[c])
                    print("   ! unrouted %-14s -> %s.%s  [src %d/%d ok, goal %d/%d ok]"
                          % (netname, tgt[3], tgt[4], ps, len(src), pg, len(goals)))
                src = src + goals
                continue
            self._emit(path, netname, width, netv)
            src = src + path + goals
        return fails

    def _emit(self, path, netname, width, netv):
        pts = [self.to_mm(k % self.nx, k // self.nx) for k in path]
        simp = [pts[0]]
        for i in range(1, len(pts) - 1):
            ax, ay = simp[-1]
            bx, by = pts[i]
            cx, cy = pts[i + 1]
            if (bx - ax) * (cy - by) != (by - ay) * (cx - bx):
                simp.append(pts[i])
        simp.append(pts[-1])
        for i in range(len(simp) - 1):
            self.p.seg(simp[i], simp[i + 1], netname, width, self.layer)
            self.stamp_seg(simp[i], simp[i + 1],
                           width / 2.0 + CLEAR + min(width, W_SIG) / 2.0, netv)

    def stub_pads(self, pads, netname, width=W_SIG):
        for (r, n) in pads:
            x, y = self.p.pxy(r, n)
            i, j = self.to_c(x, y)
            gx, gy = self.to_mm(i, j)
            if abs(gx - x) > 1e-9 or abs(gy - y) > 1e-9:
                self.p.seg((x, y), (gx, gy), netname, width)
