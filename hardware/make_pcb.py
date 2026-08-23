"""Builds routed single-sided PCB layout cards for CN-02 and BS-02.

Placement follows the Rev B placement cards; nets follow collar_node.ino /
base_station.ino (same source as make_breadboard.py). All signal copper is on
the bottom layer, drawn as seen from the component side (NOT mirrored).
GND is the remaining bottom-copper pour. Outputs HTML, then PNG via headless Edge.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
S = 7  # px per mm

C = {  # routing-group colours (match breadboard legend where possible)
    'pwr': '#ef5350', 'spi': '#b388f5', 'i2c': '#64a5f5', 'uart': '#66d08a',
    'sig': '#f5d05e', 'led': '#f59a5e', 'sw':  '#ef7fb8', 'lnk': '#ef5350',
}
SILK = '#d7ece2'; PADR = '#e8c06a'; HOLE = '#0d211a'


def P(mm): return round(mm * S, 1)


def trace(pts, k, w=2.6, dash=False, lab=None, lx=None, ly=None):
    d = 'M' + ' L'.join(f'{P(x)},{P(y)}' for x, y in pts)
    s = (f'<path d="{d}" fill="none" stroke="{C[k]}" stroke-width="{w}" '
         f'stroke-linejoin="round" stroke-linecap="round" opacity=".95"'
         + (' stroke-dasharray="7 5"' if dash else '') + '/>')
    if lab:
        s += (f'<text x="{P(lx)}" y="{P(ly)}" font-size="11" font-weight="700" '
              f'fill="{C[k]}" text-anchor="middle">{lab}</text>')
    return s


def pad(x, y, lab=None, side='l', gnd=False, r=4.6):
    s = (f'<circle cx="{P(x)}" cy="{P(y)}" r="{r}" fill="{PADR}"/>'
         f'<circle cx="{P(x)}" cy="{P(y)}" r="{r*0.42}" fill="{HOLE}"/>')
    if gnd:  # thermal-relief spokes into the pour
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            s += (f'<line x1="{P(x)+dx*r*0.75}" y1="{P(y)+dy*r*0.75}" '
                  f'x2="{P(x)+dx*r*1.7}" y2="{P(y)+dy*r*1.7}" '
                  f'stroke="#9fb8ae" stroke-width="2.2"/>')
    if lab:
        a = {'l': ('end', -8, -4.5), 'r': ('start', 8, -4.5),
             't': ('middle', 0, -8), 'b': ('middle', 0, 13)}[side]
        s += (f'<text x="{P(x)+a[1]}" y="{P(y)+a[2]}" font-size="9.5" '
              f'fill="{SILK}" text-anchor="{a[0]}" font-weight="600">{lab}</text>')
    return s


def mod(x, y, w, h, name, sub=None, dashed=False):
    s = (f'<rect x="{P(x)}" y="{P(y)}" width="{P(w)}" height="{P(h)}" rx="5" '
         f'fill="none" stroke="{SILK}" stroke-width="1.8"'
         + (' stroke-dasharray="6 4"' if dashed else '') + '/>')
    cy = P(y + h / 2)
    s += (f'<text x="{P(x + w/2)}" y="{cy - (5 if sub else -4)}" font-size="14" '
          f'font-weight="800" fill="{SILK}" text-anchor="middle" '
          f'font-family="Consolas,monospace">{name}</text>')
    if sub:
        s += (f'<text x="{P(x + w/2)}" y="{cy + 11}" font-size="10" fill="#9fc4b5" '
              f'text-anchor="middle" font-family="Consolas,monospace">{sub}</text>')
    return s


def board_svg(W, H, body):
    w, h = P(W), P(H)
    s = [f'<svg viewBox="-46 -46 {w+92} {h+76}" width="100%" '
         f'xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI,Arial,sans-serif">']
    # dimensions
    s.append(f'<line x1="0" y1="-16" x2="{w}" y2="-16" stroke="#57c69a" stroke-width="1.5"/>'
             f'<text x="{w/2}" y="-24" font-size="15" fill="#57c69a" text-anchor="middle" '
             f'font-family="Consolas,monospace" letter-spacing="3">{W}mm</text>')
    s.append(f'<line x1="-30" y1="0" x2="-30" y2="{h}" stroke="#57c69a" stroke-width="1.5"/>'
             f'<text x="-36" y="{h/2}" font-size="15" fill="#57c69a" text-anchor="middle" '
             f'font-family="Consolas,monospace" letter-spacing="3" '
             f'transform="rotate(-90 -36 {h/2})">{H}mm</text>')
    # board = GND pour (single-sided flood)
    s.append(f'<rect x="0" y="0" width="{w}" height="{h}" rx="10" fill="#123528" '
             f'stroke="#57c69a" stroke-width="2.5"/>')
    s.append(f'<rect x="{P(2.5)}" y="{P(2.5)}" width="{w-P(5)}" height="{h-P(5)}" rx="7" '
             f'fill="none" stroke="#2e5a48" stroke-width="1" stroke-dasharray="3 4"/>')
    # mounting holes
    for mx, my in ((5, 5), (W - 5, 5), (5, H - 5), (W - 5, H - 5)):
        s.append(f'<circle cx="{P(mx)}" cy="{P(my)}" r="7" fill="none" '
                 f'stroke="{SILK}" stroke-width="1.6"/>'
                 f'<circle cx="{P(mx)}" cy="{P(my)}" r="3.4" fill="{HOLE}"/>')
    s += body
    s.append('</svg>')
    return ''.join(s)


def keepout(x, y, w, h, label='ANT KEEP-OUT'):
    return (f'<rect x="{P(x)}" y="{P(y)}" width="{P(w)}" height="{P(h)}" rx="4" '
            f'fill="rgba(240,170,60,.07)" stroke="#e0a840" stroke-width="1.6" '
            f'stroke-dasharray="7 5"/>'
            f'<text x="{P(x + w/2)}" y="{P(y + h/2)}" font-size="10.5" fill="#e0a840" '
            f'font-weight="700" text-anchor="middle" font-family="Consolas,monospace" '
            f'letter-spacing="2" transform="rotate(-90 {P(x + w/2)} {P(y + h/2)})"'
            f'>{label}</text>')


# ═══════════════════ CN-02 — COLLAR NODE · 120 x 130 mm ═══════════════════
CN_L = ['3V3', 'GND', 'IO16', 'IO17', 'IO34', 'IO4', 'IO2', 'IO33', 'IO32',
        'IO25', 'IO27', 'IO15']          # U1 left row, x=38, y=40+4i
CN_R = ['IO5', 'IO14', 'IO26', 'IO12', 'IO13', 'IO18', 'IO19', 'IO23',
        'IO21', 'IO22', 'IO35', 'GND']   # U1 right row, x=62
CN_U3 = ['NSS', 'RST', 'DIO0', 'DIO1', 'DIO2', 'SCK', 'MISO', 'MOSI']  # x=88, y=44+3i

cn = []
# ── copper first (under silkscreen) ──
# power chain: LiPo -> TP4056 -> MT3608 -> 5V -> LM1117 -> 3V3
cn.append(trace([(8, 40), (8, 22)], 'pwr', 5, lab='BATT+', lx=13, ly=33.5))
cn.append(trace([(16, 40), (16, 28), (8.5, 28)], 'pwr', 5))
cn.append(trace([(24, 22), (42, 22)], 'pwr', 5, lab='VBAT', lx=33, ly=19.5))
cn.append(trace([(60, 22), (72, 22)], 'pwr', 5, lab='5V', lx=66, ly=19.5))
cn.append(trace([(88, 22), (94, 22), (94, 35)], 'pwr', 5, lab='3V3', lx=99, ly=28))
# 3V3 rail + drops
cn.append(trace([(33, 35), (94, 35)], 'pwr', 3.6, lab='3V3 RAIL', lx=70, ly=32.5))
cn.append(trace([(38, 35), (38, 40)], 'pwr', 3.6))                     # U1 3V3
cn.append(trace([(33, 35), (33, 53), (30, 56)], 'pwr', 3.6))           # GPS VCC
cn.append(trace([(94, 35), (94, 42)], 'pwr', 3.6))                     # LoRa 3V3
cn.append(trace([(58.5, 35), (58.5, 98), (86, 98), (86, 94)], 'pwr', 3.6))  # U4 VCC
cn.append(trace([(78, 98), (78, 122), (96, 122), (96, 118)], 'pwr', 3.6))   # U5 VIN
# battery divider tap (R2/R3 by U7) -> sense with one wire link over the rail drops
cn.append(trace([(27, 22), (27, 25)], 'pwr', 3.6))
cn.append(trace([(27, 31.5), (29.5, 31.5), (29.5, 37.5), (30.5, 37.5)], 'sig', 2.6))
cn.append(trace([(30.5, 37.5), (40, 37.5)], 'lnk', 2.6, dash=True,
                lab='LK1', lx=44, ly=41.5))
cn.append(trace([(40, 37.5), (48, 37.5), (48, 52.5), (44.5, 56), (38, 56)],
                'sig', 2.6, lab='VBAT SENSE', lx=53, ly=50.8))
# LoRa bundle — right row pads 1-8 straight across to U3
for pts in ([(62, 40), (70, 40), (74, 44), (88, 44)],
            [(62, 44), (69, 44), (72, 47), (88, 47)],
            [(62, 48), (68, 48), (70, 50), (88, 50)],
            [(62, 52), (67, 52), (68, 53), (88, 53)],
            [(62, 56), (88, 56)],
            [(62, 60), (67, 60), (68, 59), (88, 59)],
            [(62, 64), (68, 64), (70, 62), (88, 62)],
            [(62, 68), (69, 68), (72, 65), (88, 65)]):
    cn.append(trace(pts, 'spi'))
# I2C daisy-chain: IO21/IO22 -> U4, then U4 -> U5 down the right edge; IO35 = INT
cn.append(trace([(62, 72), (70, 72), (78, 80), (82, 80)], 'i2c', lab='SDA', lx=75, ly=74.8))
cn.append(trace([(62, 76), (68, 76), (76, 84), (82, 84)], 'i2c', lab='SCL', lx=74, ly=79.6))
cn.append(trace([(62, 80), (66, 80), (74, 88), (82, 88)], 'sig', lab='INT', lx=70.5, ly=87))
cn.append(trace([(104, 80), (108, 80), (108, 98), (96, 98), (96, 100)], 'i2c'))
cn.append(trace([(104, 84), (106, 84), (106, 96), (92, 96), (92, 100)], 'i2c'))
# GPS UART pair — left row across to U2
cn.append(trace([(38, 48), (35, 48), (35, 56.5), (31.5, 60), (30, 60)], 'uart',
                lab='RX2', lx=43.5, ly=49))
cn.append(trace([(38, 52), (36.5, 52), (36.5, 60.5), (33, 64), (30, 64)], 'uart',
                lab='TX2', lx=43.5, ly=53))
# DS18B20: IO4 left and down to CN3; R1 pull-up joins at the data pad
cn.append(trace([(38, 60), (35, 60), (35, 82.5), (7, 82.5), (7, 97), (12, 100)],
                'sig', lab='1-WIRE', lx=30, ly=86))
cn.append(trace([(12, 93), (12, 100)], 'sig'))
# pull-up bank 3V3 mini-rail, fed by wire link LK2
cn.append(trace([(36, 35), (24, 58), (18, 84.5)], 'lnk', 2.6, dash=True,
                lab='LK2', lx=13, ly=57))
cn.append(trace([(12, 84.5), (24, 84.5)], 'pwr', 3.6))
for rx in (12, 18, 24):
    cn.append(trace([(rx, 84.5), (rx, 86)], 'pwr', 2.6))
# LEDs: IO15 -> LED1, IO2 -> LED2 (330R on top of each LED column)
cn.append(trace([(38, 84), (43.5, 84), (43.5, 91), (42, 94)], 'led'))
cn.append(trace([(38, 64), (56, 64), (56, 91), (55, 94)], 'led'))
cn.append(trace([(42, 99), (42, 101)], 'led'))
cn.append(trace([(55, 99), (55, 101)], 'led'))
# switch group: nested lanes down the channel, fan into CN5
cn.append(trace([(38, 68), (53.5, 68), (53.5, 107), (52, 112)], 'sw'))
cn.append(trace([(38, 72), (51, 72), (51, 106), (46, 112)], 'sw'))
cn.append(trace([(38, 76), (48.5, 76), (48.5, 105), (40, 112)], 'sw'))
cn.append(trace([(38, 80), (46, 80), (46, 104), (34, 112)], 'sw'))
# flash UART: top-side wires from CN4 to the module's TX0/RX0 castellations
cn.append(trace([(10, 111), (23, 100), (35, 88)], 'lnk', 2.2, dash=True))
cn.append(trace([(14, 111), (27, 103), (39, 88)], 'lnk', 2.2, dash=True,
                lab='LK3/4', lx=24, ly=106.5))

# ── modules / silkscreen ──
cn.append(mod(5, 5, 22, 17, 'U7', 'TP4056'))
cn.append(mod(40, 5, 22, 17, 'U9', 'MT3608'))
cn.append(mod(72, 7, 18, 15, 'U8', 'LM1117'))
cn.append(mod(5, 52, 25, 28, 'U2', 'GPS NEO-6M'))
cn.append(mod(88, 42, 24, 28, 'U3', 'LoRa Ra-01'))
cn.append(mod(82, 76, 22, 18, 'U4', 'MPU-6050'))
cn.append(mod(84, 100, 20, 18, 'U5', 'MAX30102'))
cn.append(mod(33, 36, 34, 52, 'U1', 'ESP32-WROOM-32', dashed=True))
cn.append(mod(5, 102, 15, 9, 'CN3', 'TEMP'))
cn.append(mod(5, 114.5, 15, 8, 'CN4', 'UART'))
cn.append(mod(28, 108, 34, 16, 'CN5', 'SW1-4'))
cn.append(mod(5, 38, 15, 13, 'CN1/2', 'BATT'))
cn.append(keepout(112, 40, 8, 35))
# labels for small parts
for t, x, y in (('R2/R3 100k', 27, 42.5), ('R1 4k7 · R5/R6 DNF', 18, 96.8),
                ('LED1', 36.5, 103), ('LED2', 60.5, 103), ('330R', 36.5, 96.5),
                ('C1-C7 on 3V3 pins of U2-U5', 60, 128.5)):
    cn.append(f'<text x="{P(x)}" y="{P(y)}" font-size="9.5" fill="{SILK}" '
              f'font-weight="600" text-anchor="middle">{t}</text>')
# divider + pull-up + LED discrete pads
cn.append(pad(27, 25) + pad(27, 31.5) + pad(27, 38, gnd=True))
for rx in (12, 18, 24):
    cn.append(pad(rx, 86) + pad(rx, 93))
for lx in (42, 55):
    cn.append(pad(lx, 94) + pad(lx, 99) + pad(lx, 101) + pad(lx, 105, gnd=True))

# ── pads ──
for i, lb in enumerate(CN_L):
    cn.append(pad(38, 40 + 4 * i, lb, 'l', gnd=(lb == 'GND')))
for i, lb in enumerate(CN_R):
    cn.append(pad(62, 40 + 4 * i, lb, 'r', gnd=(lb == 'GND')))
for i, lb in enumerate(CN_U3):
    cn.append(pad(88, 44 + 3 * i, lb, 'r'))
cn.append(pad(94, 42, '3V3', 't') + pad(100, 42, 'GND', 't', gnd=True))
cn.append(pad(82, 80) + pad(82, 84) + pad(82, 88) + pad(104, 80) + pad(104, 84)
          + pad(86, 94, 'VCC', 'b') + pad(90, 94, 'GND', 'b', gnd=True)
          + pad(100, 76, 'AD0', 't', gnd=True))
cn.append(pad(92, 100) + pad(96, 100) + pad(96, 118, 'VIN', 'l')
          + pad(100, 118, 'GND', 'r', gnd=True))
cn.append(pad(30, 56, 'VCC', 'l') + pad(30, 60, 'TX', 'l') + pad(30, 64, 'RX', 'l')
          + pad(30, 68, 'GND', 'l', gnd=True))
cn.append(pad(8, 40, 'B+', 'b') + pad(12, 40, 'B-', 'b', gnd=True)
          + pad(16, 40, 'S+', 'b') + pad(20, 40, 'S-', 'b', gnd=True))
cn.append(pad(8, 22) + pad(24, 22) + pad(42, 22) + pad(60, 22) + pad(72, 22) + pad(88, 22))
cn.append(pad(8, 100, '3V3', 't') + pad(12, 100) + pad(16, 100, 'GND', 't', gnd=True))
cn.append(pad(10, 111, 'TX0', 'b') + pad(14, 111, 'RX0', 'b')
          + pad(18, 111, 'GND', 'b', gnd=True))
for sx in (34, 40, 46, 52):
    cn.append(pad(sx, 112))
cn.append(pad(58, 112, 'GND', 'r', gnd=True))
cn.append(pad(35, 88, 'TX0', 'b') + pad(39, 88, 'RX0', 'b'))

CN_BODY = board_svg(120, 130, cn)


# ═══════════════════ BS-02 — BASE STATION · 120 x 100 mm ═══════════════════
BS_L = ['3V3', 'GND', 'IO21', 'IO22', 'GND']                    # x=40, y=30+4i
BS_R = ['IO5', 'IO14', 'IO26', 'IO18', 'IO19', 'IO23', 'IO2', 'IO4', 'IO15',
        'IO13', 'TX0', 'RX0']                                   # x=64, y=30+4i
BS_U2 = ['NSS', 'RST', 'DIO0', 'SCK', 'MISO', 'MOSI']           # x=92, y=29+3i

bs = []
# power chain: 12V -> LM2596 -> 5V -> LM1117 -> 3V3 trunk along the top edge
bs.append(trace([(10, 10), (26, 10)], 'pwr', 5, lab='12V', lx=18, ly=7.5))
bs.append(trace([(58, 12), (64, 12)], 'pwr', 5, lab='5V', lx=61, ly=8.5))
bs.append(trace([(78, 12), (84, 12)], 'pwr', 5, lab='3V3', lx=81, ly=8.5))
bs.append(trace([(84, 12), (100, 12), (100, 26)], 'pwr', 3.6))       # LoRa 3V3
bs.append(trace([(80, 12), (80, 24), (34, 24), (34, 36), (26, 36)], 'pwr', 3.6,
                lab='3V3', lx=30.5, ly=28.5))
bs.append(trace([(40, 30), (34, 30)], 'pwr', 3.6))                   # U1 3V3
bs.append(trace([(20, 36), (20, 38)], 'pwr', 2.6))                   # R5 top
bs.append(trace([(26, 36), (26, 38)], 'pwr', 2.6))                   # R6 top
bs.append(trace([(26, 36), (20, 36)], 'pwr', 3.6))
# SPI bundle — right row pads 1-6 straight across to U2
for i, pts in enumerate(([(64, 30), (76, 30), (80, 29), (92, 29)],
                         [(64, 34), (76, 34), (78, 32), (92, 32)],
                         [(64, 38), (72, 38), (75, 35), (92, 35)],
                         [(64, 42), (74, 42), (78, 38), (92, 38)],
                         [(64, 46), (72, 46), (77, 41), (92, 41)],
                         [(64, 50), (70, 50), (76, 44), (92, 44)])):
    bs.append(trace(pts, 'spi'))
# I2C pair — left row out to R5/R6 and down to the OLED
bs.append(trace([(40, 38), (36, 38), (36, 50), (30, 54), (29, 55)], 'i2c',
                lab='SDA', lx=46, ly=37))
bs.append(trace([(36, 47.5), (26, 47.5), (26, 46)], 'i2c'))
bs.append(trace([(40, 42), (38, 42), (38, 58), (20, 58), (20, 46)], 'i2c',
                lab='SCL', lx=46, ly=41))
bs.append(trace([(24, 58), (24, 55)], 'i2c'))
# LED group — right row pads 7-10 left into the resistor row
bs.append(trace([(64, 54), (48, 54), (48, 62)], 'led', lab='IO2', lx=55, ly=52.5))
bs.append(trace([(64, 58), (54, 58), (54, 62)], 'led'))
bs.append(trace([(64, 62), (60, 62)], 'led'))
bs.append(trace([(64, 66), (66, 66), (66, 62)], 'led'))
for rx in (48, 54, 60, 66):
    bs.append(trace([(rx, 68), (rx, 76)], 'led'))
# UART — bottom two pads down to CN2
bs.append(trace([(64, 70), (80, 70), (94, 78), (102, 80), (102, 84)], 'uart',
                lab='TX0', lx=86, ly=70.5))
bs.append(trace([(64, 74), (78, 74), (90, 80), (96, 81), (96, 84)], 'uart'))

# modules / silkscreen
bs.append(mod(4, 4, 16, 14, 'CN1', '12V'))
bs.append(mod(26, 4, 32, 18, 'U4', 'LM2596'))
bs.append(mod(64, 6, 14, 12, 'U5', 'LM1117'))
bs.append(mod(84, 8, 26, 10, 'C5 C1 C2', None))
bs.append(mod(92, 26, 22, 26, 'U2', 'LoRa Ra-01'))
bs.append(mod(6, 54, 30, 32, 'U3', 'SSD1306'))
bs.append(mod(36, 26, 32, 52, 'U1', 'ESP32-WROOM-32', dashed=True))
bs.append(mod(92, 86, 22, 10, 'CN2', 'UART'))
bs.append(keepout(114, 24, 6, 32))
for t, x, y in (('R5 R6 4k7', 13, 34.5), ('R1-R4 330R', 76.5, 72.5),
                ('LED1-4  G / B / Y / R', 57, 92)):
    bs.append(f'<text x="{P(x)}" y="{P(y)}" font-size="9.5" fill="{SILK}" '
              f'font-weight="600" text-anchor="middle">{t}</text>')
# discrete pads: pull-ups, LED resistors, LEDs
bs.append(pad(20, 38) + pad(20, 46) + pad(26, 38) + pad(26, 46))
for rx in (48, 54, 60, 66):
    bs.append(pad(rx, 62) + pad(rx, 68) + pad(rx, 76) + pad(rx, 81, gnd=True))
# module pads
for i, lb in enumerate(BS_L):
    bs.append(pad(40, 30 + 4 * i, lb, 'l', gnd=(lb == 'GND')))
for i, lb in enumerate(BS_R):
    bs.append(pad(64, 30 + 4 * i, lb, 'r'))
for i, lb in enumerate(BS_U2):
    bs.append(pad(92, 29 + 3 * i, lb, 'r'))
bs.append(pad(100, 26, '3V3', 'r') + pad(106, 26, 'GND', 'r', gnd=True))
bs.append(pad(14, 55, 'GND', 't', gnd=True) + pad(19, 55, 'VCC', 't')
          + pad(24, 55, 'SCL', 't') + pad(29, 55, 'SDA', 't'))
bs.append(trace([(20, 36), (16.5, 36), (16.5, 52), (19, 55)], 'pwr', 2.6))
bs.append(pad(10, 10) + pad(14, 14, gnd=True))
bs.append(pad(26, 10) + pad(58, 12) + pad(64, 12) + pad(78, 12) + pad(84, 12)
          + pad(100, 26))
bs.append(pad(96, 84, 'RX0', 'b') + pad(102, 84, 'TX0', 'b')
          + pad(108, 84, 'GND', 'r', gnd=True))

BS_BODY = board_svg(120, 100, bs)


# ═══════════════════ page wrapper + build ═══════════════════
LEG = [('pwr', 'Power (BATT / 5V / 3V3)'), ('spi', 'LoRa SPI bundle'),
       ('i2c', 'I2C bus'), ('uart', 'UART'), ('sig', 'Signal / sense'),
       ('led', 'LED group'), ('sw', 'Switch group'),
       ('lnk', 'Top-side wire link (dashed)')]

COMMON_NOTES = (
    '<li><b>Single-sided:</b> every solid trace is bottom copper, drawn as seen '
    'from the component side &mdash; <b>mirror horizontally</b> before toner-transfer '
    'or single-layer CNC. Dashed runs are insulated wire links soldered on top.</li>'
    '<li><b>GND is the pour:</b> the whole remaining bottom copper is flooded ground. '
    'Pads marked with corner spokes tie into the pour with thermal reliefs.</li>'
    '<li><b>Widths:</b> power chain 2.0&nbsp;mm, 3V3 distribution 1.2&nbsp;mm, '
    'signals 0.8&nbsp;mm, clearance 0.5&nbsp;mm. Drills: 1.0&nbsp;mm headers, '
    '3.2&nbsp;mm mounting.</li>'
    '<li><b>Modules sit on female headers</b> (dashed U1 outline = ESP32 module over '
    'its two pad rows), so traces may run beneath them &mdash; except U3/U2 LoRa, '
    'which solders flat; nothing routes under it or inside the antenna keep-out.</li>')


def page(title, sub, body_svg, group_notes, foot, badge, skip=()):
    rows = ''.join(
        f'<div class="lg"><span class="dot" style="background:{C[k]}"></span>{t}</div>'
        for k, t in LEG if k not in skip)
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>{title}</title><style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Segoe UI',Arial,sans-serif;background:#faf7f0;color:#2b2b26;width:1040px;padding:34px 44px}}
.caps{{font-size:11px;font-weight:800;letter-spacing:2px;color:#b0492f;font-family:Consolas,monospace}}
h1{{font-size:26px;font-weight:800;font-family:Consolas,monospace;margin:6px 0 2px}}
.sub{{font-size:12.5px;color:#8a857a;border-bottom:2px solid #2b2b26;padding-bottom:12px}}
.panel{{background:#101613;border-radius:14px;padding:30px 34px;margin-top:20px}}
.legend{{display:flex;flex-wrap:wrap;gap:9px 20px;margin-top:16px}}
.lg{{display:flex;align-items:center;gap:7px;font-size:11.5px;color:#4a463d}}
.dot{{width:15px;height:5px;border-radius:2px;flex-shrink:0}}
.nt{{font-size:11px;font-weight:800;letter-spacing:2px;color:#6b665c;margin:20px 0 6px;font-family:Consolas,monospace}}
ul{{list-style:none}}li{{font-size:12px;color:#4a463d;padding:3.5px 0 3.5px 14px;position:relative;line-height:1.55}}
li::before{{content:'\\2022';position:absolute;left:0;color:#b0492f;font-weight:900}}
.foot{{border-top:1px solid #d8d2c2;margin-top:18px;padding-top:10px;font-size:11px;color:#8a857a;font-family:Consolas,monospace}}
</style></head><body>
<div class="caps">RAMAMBO REV B &middot; SINGLE-SIDED &middot; ROUTED COPPER &middot; {badge}</div>
<h1>{title}</h1><div class="sub">{sub}</div>
<div class="panel">{body_svg}</div>
<div class="legend">{rows}</div>
<div class="nt">ROUTING &mdash; WHAT GOES WHERE</div><ul>{group_notes}</ul>
<div class="nt">FOR THE PERSON ASSEMBLING</div><ul>{COMMON_NOTES}</ul>
<div class="foot">{foot}</div>
</body></html>"""


CN_NOTES = (
    '<li><b>LoRa bundle (8 nets)</b> &mdash; IO5/14/26/12/13/18/19/23 run as a parallel '
    'bundle from the right pad row into U3. No crossings.</li>'
    '<li><b>I2C daisy-chain</b> &mdash; IO21/IO22 into U4 (MPU-6050), then out of U4&rsquo;s '
    'far side and down the right edge into U5 (MAX30102). Chain, not star. IO35 carries the '
    'MPU interrupt. R5/R6 are <b>DNF</b>: the GY-521 and MAX30102 breakouts carry their own '
    'pull-ups &mdash; fit R5/R6 (wire tails to SDA/SCL, top side) only with bare sensors.</li>'
    '<li><b>GPS pair</b> &mdash; IO16/IO17 straight across to U2, &asymp;54&nbsp;mm clear of U3.</li>'
    '<li><b>Switch group (4 nets)</b> &mdash; IO33/32/25/27 down the centre channel into CN5; '
    'switch commons return through the GND pour.</li>'
    '<li><b>Battery divider</b> &mdash; R2/R3 hang directly off the VBAT trunk beside U7; the '
    'high-impedance tap reaches IO34 through wire link LK1.</li>'
    '<li><b>Wire links</b> &mdash; LK1 (VBAT sense), LK2 (3V3 to R1 pull-up bank), LK3/LK4 '
    '(CN4 flash UART to the module&rsquo;s TX0/RX0). Plain insulated hookup wire on top.</li>')

BS_NOTES = (
    '<li><b>SPI bundle (6 nets)</b> &mdash; IO5/14/26/18/19/23 straight across to U2 as a '
    'parallel bundle. No crossings.</li>'
    '<li><b>LED group (4 nets)</b> &mdash; IO2/4/15/13 drop left to the 330R row, then the LED '
    'row below; cathodes return through the pour. Yellow = IO15, red = IO13 (firmware pins, '
    'not HARDWARE_DESIGN.md 2.3).</li>'
    '<li><b>I2C pair</b> &mdash; IO21/IO22 out of the left row, past the R5/R6 pull-ups, into '
    'the OLED. SCL loops under the OLED pad row to keep the layer crossing-free.</li>'
    '<li><b>UART</b> &mdash; TX0/RX0 from the bottom of the right row to CN2. Flash header; '
    'hold EN/IO0 by hand or flash the module before fitting.</li>'
    '<li><b>Power trunk</b> &mdash; 12V &rarr; U4 &rarr; 5V &rarr; U5 &rarr; 3V3 along the top '
    'edge at 2.0&nbsp;mm, then one 1.2&nbsp;mm 3V3 branch feeds pads, pull-ups and OLED. '
    'No wire links needed on this board.</li>')

CN_HTML = page('CN-02 — Collar Node',
               'Routed single-sided layout · 120 × 130 mm · 21 signal nets + power · '
               'GND = bottom pour', CN_BODY, CN_NOTES,
               'Three-stage power: LiPo → TP4056 → MT3608 → 5V → LM1117 → 3V3 · charge via '
               'U7 onboard USB · fit the 433 MHz antenna before first power-up.',
               'CN-02')
BS_HTML = page('BS-02 — Base Station',
               'Routed single-sided layout · 120 × 100 mm · 12 signal nets + power · '
               'GND = bottom pour', BS_BODY, BS_NOTES,
               'One power chain: 12V → LM2596 → 5V → LM1117 → 3V3 · build this board first — '
               'it proves the process before CN-02 spends copper.',
               'BS-02', skip=('sig', 'sw', 'lnk'))

for name, html in (('PCB_CN02_ROUTED', CN_HTML), ('PCB_BS02_ROUTED', BS_HTML)):
    (HERE / f'{name}.html').write_text(html, encoding='utf-8')
    print('wrote', name + '.html')
