"""Builds hardware/BREADBOARD_LAYOUT.html — visual breadboard placement for CN-01 and BS-01.

Pin data comes from collar_node.ino / base_station.ino (authoritative over
HARDWARE_DESIGN.md section 2.3, which has a GPIO5 double-assignment).
Styled to match PROTEUS_SCHEMATIC.html.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ── breadboard geometry ────────────────────────────────────────────────────
P = 19                      # hole pitch, px
COLS = 60                   # tie-point columns drawn
LEFT = 74                   # x of column 1
TOP = 30                    # y of the top (+) rail

ROW_Y = {}
_y = TOP
ROW_Y['+T'] = _y;           _y += P
ROW_Y['-T'] = _y;           _y += int(P * 1.7)
for r in 'ABCDE':
    ROW_Y[r] = _y;          _y += P
_y += int(P * 0.9)                      # centre channel
for r in 'FGHIJ':
    ROW_Y[r] = _y;          _y += P
_y += int(P * 0.7)
ROW_Y['+B'] = _y;           _y += P
ROW_Y['-B'] = _y
BOARD_H = _y + 34
BOARD_W = LEFT + COLS * P + 40

RAIL_ROWS = ('+T', '-T', '+B', '-B')

def hx(col):  return LEFT + (col - 1) * P
def hy(row):  return ROW_Y[row]

WIRE = {  # semantic -> colour
    'pwr':  '#ef4444',   # 3V3
    'gnd':  '#4b5563',   # ground
    'spi':  '#a855f7',   # SPI to LoRa
    'i2c':  '#3b82f6',   # I2C bus
    'uart': '#22c55e',   # GPS UART
    'sig':  '#f59e0b',   # misc signal / interrupt
    'led':  '#f97316',   # LED and button
}


def breadboard_svg(modules, wires, notes):
    s = [f'<svg viewBox="0 0 {BOARD_W} {BOARD_H}" width="100%" '
         f'xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI,Arial,sans-serif">']

    # body
    s.append(f'<rect x="40" y="{TOP-16}" width="{BOARD_W-70}" height="{BOARD_H-TOP-4}" '
             f'rx="8" fill="#f5f2e8" stroke="#c9c2ac" stroke-width="2"/>')
    # centre channel
    ch_y = ROW_Y['E'] + P - 4
    s.append(f'<rect x="46" y="{ch_y}" width="{BOARD_W-82}" height="{ROW_Y["F"]-ch_y-4}" '
             f'fill="#e8e3d3" stroke="#d5cfbb"/>')

    # power rail stripes
    for row, col in (('+T', '#ef4444'), ('-T', '#3b82f6'), ('+B', '#ef4444'), ('-B', '#3b82f6')):
        y = hy(row)
        s.append(f'<line x1="52" y1="{y}" x2="{BOARD_W-46}" y2="{y}" stroke="{col}" '
                 f'stroke-width="1" opacity=".35"/>')
        s.append(f'<text x="46" y="{y+4}" font-size="11" font-weight="700" fill="{col}" '
                 f'text-anchor="end">{"+" if row.startswith("+") else "−"}</text>')

    # holes
    for row in ROW_Y:
        for c in range(1, COLS + 1):
            if row in RAIL_ROWS and c % 6 == 0:
                continue                      # rail gap every 6, as on a real board
            s.append(f'<rect x="{hx(c)-3.5}" y="{hy(row)-3.5}" width="7" height="7" rx="1.5" '
                     f'fill="#fffdf6" stroke="#bdb6a1" stroke-width=".8"/>')

    # row letters + column numbers
    for r in 'ABCDEFGHIJ':
        s.append(f'<text x="{LEFT-16}" y="{hy(r)+4}" font-size="10" fill="#8a8370" '
                 f'text-anchor="middle">{r}</text>')
    for c in range(1, COLS + 1, 5):
        s.append(f'<text x="{hx(c)}" y="{ROW_Y["A"]-8}" font-size="9" fill="#8a8370" '
                 f'text-anchor="middle">{c}</text>')

    # modules
    for m in modules:
        c1, c2, row_top, row_bot = m['c1'], m['c2'], m['rt'], m['rb']
        x = hx(c1) - 9
        y = hy(row_top) - 9
        w = (c2 - c1) * P + 18
        h = hy(row_bot) - hy(row_top) + 18
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" '
                 f'fill="{m.get("fill", "#1f2937")}" stroke="#0f172a" stroke-width="1.5" opacity=".93"/>')
        s.append(f'<text x="{x + w/2}" y="{y + h/2 - 2}" font-size="12" font-weight="800" '
                 f'fill="#fff" text-anchor="middle">{m["label"]}</text>')
        if m.get('sub'):
            s.append(f'<text x="{x + w/2}" y="{y + h/2 + 12}" font-size="9" fill="#93c5fd" '
                     f'text-anchor="middle">{m["sub"]}</text>')
        # pin ticks
        for i, pin in enumerate(m.get('pins', [])):
            if not pin:
                continue
            px = hx(c1 + i)
            py = y + h + 3 if m.get('pin_side', 'below') == 'below' else y - 3
            anchor_y = py + 9 if m.get('pin_side', 'below') == 'below' else py - 2
            s.append(f'<text x="{px}" y="{anchor_y}" font-size="8" fill="#374151" '
                     f'text-anchor="middle" transform="rotate(-90 {px} {anchor_y})">{pin}</text>')

    # wires
    for w in wires:
        (c1, r1), (c2, r2), kind = w['a'], w['b'], w['k']
        x1, y1, x2, y2 = hx(c1), hy(r1), hx(c2), hy(r2)
        col = WIRE[kind]
        dy = -abs(x2 - x1) * 0.16 - 12
        s.append(f'<path d="M{x1},{y1} C{x1},{y1+dy} {x2},{y2+dy} {x2},{y2}" fill="none" '
                 f'stroke="{col}" stroke-width="2.4" stroke-linecap="round" opacity=".92"/>')
        for (xx, yy) in ((x1, y1), (x2, y2)):
            s.append(f'<circle cx="{xx}" cy="{yy}" r="3.4" fill="{col}"/>')
        if w.get('lab'):
            ly = y2 + 15 if r2 in 'GHIJ' else y2 - 9
            s.append(f'<text x="{x2}" y="{ly}" font-size="8.5" font-weight="700" fill="{col}" '
                     f'text-anchor="middle">{w["lab"]}</text>')

    for n in notes:
        s.append(f'<text x="{n["x"]}" y="{n["y"]}" font-size="10" font-style="italic" '
                 f'fill="#6b7280">{n["t"]}</text>')

    s.append('</svg>')
    return ''.join(s)


# ── CN-01 placement ────────────────────────────────────────────────────────
CN_MODULES = [
    dict(c1=3, c2=21, rt='E', rb='F', label='ESP32-WROOM-32 DevKit',
         sub='straddles the centre channel', fill='#111827'),
    dict(c1=27, c2=34, rt='F', rb='H', label='SX1278 Ra-02', sub='LoRa 433 MHz', fill='#4c1d95',
         pins=['GND', '3V3', 'RST', 'DIO0', 'DIO1', 'DIO2', 'NSS', 'MOSI']),
    dict(c1=39, c2=46, rt='F', rb='H', label='MPU-6050', sub='GY-521', fill='#1e3a8a',
         pins=['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT']),
    dict(c1=50, c2=54, rt='F', rb='H', label='MAX30102', sub='heart rate', fill='#1e3a8a',
         pins=['VIN', 'GND', 'SCL', 'SDA', 'INT']),
    dict(c1=27, c2=30, rt='B', rb='C', label='NEO-6M GPS', fill='#065f46',
         pins=['VCC', 'RX', 'TX', 'GND'], pin_side='above'),
    dict(c1=36, c2=38, rt='B', rb='C', label='DS18B20', sub='probe leads', fill='#7c2d12',
         pins=['RED', 'YEL', 'BLK'], pin_side='above'),
    dict(c1=44, c2=46, rt='B', rb='C', label='LED + SW', fill='#78350f',
         pins=['LED', 'R', 'SW'], pin_side='above'),
]

CN_WIRES = [
    # power rails from the devkit
    dict(a=(3, 'D'), b=(3, '+T'), k='pwr', lab='3V3'), dict(a=(5, 'G'), b=(5, '-B'), k='gnd', lab='GND'),
    # LoRa SPI + control
    dict(a=(27, 'I'), b=(27, '-B'), k='gnd'), dict(a=(28, 'I'), b=(28, '+B'), k='pwr'),
    dict(a=(29, 'I'), b=(14, 'G'), k='spi', lab='19'), dict(a=(30, 'I'), b=(16, 'G'), k='spi', lab='23'),
    dict(a=(31, 'I'), b=(17, 'G'), k='spi', lab='18'), dict(a=(32, 'I'), b=(18, 'G'), k='spi', lab='5'),
    dict(a=(33, 'I'), b=(19, 'G'), k='spi', lab='14'), dict(a=(34, 'I'), b=(20, 'G'), k='spi', lab='26'),
    # I2C bus
    dict(a=(39, 'I'), b=(39, '+B'), k='pwr'), dict(a=(40, 'I'), b=(40, '-B'), k='gnd'),
    dict(a=(41, 'I'), b=(12, 'G'), k='i2c', lab='21'), dict(a=(42, 'I'), b=(11, 'G'), k='i2c', lab='22'),
    dict(a=(45, 'I'), b=(45, '-B'), k='gnd'), dict(a=(46, 'I'), b=(10, 'G'), k='sig', lab='35'),
    dict(a=(50, 'I'), b=(50, '+B'), k='pwr'), dict(a=(51, 'I'), b=(51, '-B'), k='gnd'),
    dict(a=(52, 'I'), b=(41, 'J'), k='i2c'), dict(a=(53, 'I'), b=(42, 'J'), k='i2c'),
    # GPS
    dict(a=(27, 'A'), b=(27, '+T'), k='pwr'), dict(a=(30, 'A'), b=(30, '-T'), k='gnd'),
    dict(a=(28, 'A'), b=(9, 'C'), k='uart', lab='16'), dict(a=(29, 'A'), b=(8, 'C'), k='uart', lab='17'),
    # DS18B20
    dict(a=(36, 'A'), b=(36, '+T'), k='pwr'), dict(a=(38, 'A'), b=(38, '-T'), k='gnd'),
    dict(a=(37, 'A'), b=(7, 'C'), k='sig', lab='4'),
    # LED + button
    dict(a=(44, 'A'), b=(6, 'C'), k='led', lab='2'), dict(a=(46, 'A'), b=(46, '-T'), k='gnd'),
]

CN_NOTES = [
    dict(x=LEFT, y=BOARD_H - 12,
         t='Pin labels follow the usual silkscreen for each breakout. Always match by printed label, not by position — vendors vary.'),
]

# ── BS-01 placement ────────────────────────────────────────────────────────
BS_MODULES = [
    dict(c1=3, c2=21, rt='E', rb='F', label='ESP32-WROOM-32 DevKit',
         sub='straddles the centre channel', fill='#111827'),
    dict(c1=27, c2=34, rt='F', rb='H', label='SX1278 Ra-02', sub='LoRa 433 MHz', fill='#4c1d95',
         pins=['GND', '3V3', 'RST', 'DIO0', 'NSS', 'MOSI', 'MISO', 'SCK']),
    dict(c1=40, c2=43, rt='F', rb='H', label='SSD1306 OLED', sub='I2C 0x3C', fill='#1e3a8a',
         pins=['GND', 'VCC', 'SCL', 'SDA']),
    dict(c1=27, c2=34, rt='B', rb='C', label='4 x LED + 330R', sub='G / B / Y / R', fill='#78350f',
         pins=['G', '', 'B', '', 'Y', '', 'R', ''], pin_side='above'),
]

BS_WIRES = [
    dict(a=(3, 'D'), b=(3, '+T'), k='pwr', lab='3V3'), dict(a=(5, 'G'), b=(5, '-B'), k='gnd', lab='GND'),
    dict(a=(27, 'I'), b=(27, '-B'), k='gnd'), dict(a=(28, 'I'), b=(28, '+B'), k='pwr'),
    dict(a=(29, 'I'), b=(14, 'G'), k='spi', lab='14'), dict(a=(30, 'I'), b=(20, 'G'), k='spi', lab='26'),
    dict(a=(31, 'I'), b=(15, 'G'), k='spi', lab='5'), dict(a=(32, 'I'), b=(16, 'G'), k='spi', lab='23'),
    dict(a=(33, 'I'), b=(17, 'G'), k='spi', lab='19'), dict(a=(34, 'I'), b=(18, 'G'), k='spi', lab='18'),
    dict(a=(40, 'I'), b=(40, '-B'), k='gnd'), dict(a=(41, 'I'), b=(41, '+B'), k='pwr'),
    dict(a=(42, 'I'), b=(12, 'G'), k='i2c', lab='21'), dict(a=(43, 'I'), b=(11, 'G'), k='i2c', lab='22'),
    dict(a=(27, 'A'), b=(9, 'C'), k='led', lab='2'), dict(a=(29, 'A'), b=(8, 'C'), k='led', lab='4'),
    dict(a=(31, 'A'), b=(7, 'C'), k='led', lab='15'), dict(a=(33, 'A'), b=(6, 'C'), k='led', lab='13'),
    dict(a=(34, 'A'), b=(34, '-T'), k='gnd'),
]

BS_NOTES = [
    dict(x=LEFT, y=BOARD_H - 12,
         t='LED pins shown corrected against base_station.ino: WiFi yellow on GPIO15 and alert red on GPIO13, not the values in HARDWARE_DESIGN.md 2.3.'),
]

# ── wire lists (text, mirrors the SVG) ─────────────────────────────────────
CN_LIST = [
    ('pwr', 'ESP32 3V3 &rarr; both + rails'), ('gnd', 'ESP32 GND &rarr; both &minus; rails'),
    ('pwr', 'SX1278 3.3V &rarr; + rail'), ('gnd', 'SX1278 GND &rarr; &minus; rail'),
    ('spi', 'SX1278 MISO &rarr; GPIO19'), ('spi', 'SX1278 MOSI &rarr; GPIO23'),
    ('spi', 'SX1278 SCK &rarr; GPIO18'), ('spi', 'SX1278 NSS &rarr; GPIO5'),
    ('spi', 'SX1278 RST &rarr; GPIO14'), ('spi', 'SX1278 DIO0 &rarr; GPIO26'),
    ('spi', 'SX1278 DIO1 &rarr; GPIO12'), ('spi', 'SX1278 DIO2 &rarr; GPIO13'),
    ('pwr', 'MPU-6050 VCC &rarr; + rail'), ('gnd', 'MPU-6050 GND &rarr; &minus; rail'),
    ('i2c', 'MPU-6050 SDA &rarr; GPIO21'), ('i2c', 'MPU-6050 SCL &rarr; GPIO22'),
    ('gnd', 'MPU-6050 AD0 &rarr; &minus; rail (addr 0x68)'), ('sig', 'MPU-6050 INT &rarr; GPIO35'),
    ('pwr', 'MAX30102 VIN &rarr; + rail'), ('gnd', 'MAX30102 GND &rarr; &minus; rail'),
    ('i2c', 'MAX30102 SDA &rarr; shared SDA row'), ('i2c', 'MAX30102 SCL &rarr; shared SCL row'),
    ('pwr', 'GPS VCC &rarr; + rail'), ('gnd', 'GPS GND &rarr; &minus; rail'),
    ('uart', 'GPS TX &rarr; GPIO16'), ('uart', 'GPS RX &rarr; GPIO17'),
    ('pwr', 'DS18B20 red &rarr; + rail'), ('gnd', 'DS18B20 black &rarr; &minus; rail'),
    ('sig', 'DS18B20 yellow &rarr; GPIO4, plus 4.7k to + rail'),
    ('led', 'GPIO2 &rarr; 330R &rarr; LED &rarr; &minus; rail'),
    ('led', 'Button GPIO0 &rarr; &minus; rail'),
]

BS_LIST = [
    ('pwr', 'ESP32 3V3 &rarr; both + rails'), ('gnd', 'ESP32 GND &rarr; both &minus; rails'),
    ('pwr', 'SX1278 3.3V &rarr; + rail'), ('gnd', 'SX1278 GND &rarr; &minus; rail'),
    ('spi', 'SX1278 MISO &rarr; GPIO19'), ('spi', 'SX1278 MOSI &rarr; GPIO23'),
    ('spi', 'SX1278 SCK &rarr; GPIO18'), ('spi', 'SX1278 NSS &rarr; GPIO5'),
    ('spi', 'SX1278 RST &rarr; GPIO14'), ('spi', 'SX1278 DIO0 &rarr; GPIO26'),
    ('pwr', 'OLED VCC &rarr; + rail'), ('gnd', 'OLED GND &rarr; &minus; rail'),
    ('i2c', 'OLED SDA &rarr; GPIO21'), ('i2c', 'OLED SCL &rarr; GPIO22'),
    ('led', 'GPIO2 &rarr; 330R &rarr; green LED'), ('led', 'GPIO4 &rarr; 330R &rarr; blue LED'),
    ('led', 'GPIO15 &rarr; 330R &rarr; yellow LED'), ('led', 'GPIO13 &rarr; 330R &rarr; red LED'),
]

CLS = {'pwr': 'wire-red', 'gnd': 'wire-blk', 'spi': 'wire-pur', 'i2c': 'wire-blu',
       'uart': 'wire-grn', 'sig': 'wire-yel', 'led': 'wire-org'}


def wire_ul(items):
    return '<ul class="wire-list">' + ''.join(
        f'<li class="{CLS[k]}">{t}</li>' for k, t in items) + '</ul>'


LEGEND = ''.join(
    f'<div class="leg-item"><span class="leg-dot" style="background:{WIRE[k]}"></span>{lab}</div>'
    for k, lab in [('pwr', '3V3 power'), ('gnd', 'Ground'), ('spi', 'SPI to LoRa'),
                   ('i2c', 'I2C bus'), ('uart', 'GPS UART'), ('sig', 'Signal / interrupt'),
                   ('led', 'LED and button')])

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PFUMA &mdash; Breadboard Layout</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Segoe UI',Arial,sans-serif;background:#1a1a2e;color:#e0e0e0;min-height:100vh}}
  .page-header{{background:linear-gradient(135deg,#0d7377,#14a085);padding:28px 36px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}}
  .page-header h1{{font-size:26px;font-weight:900;color:#fff;letter-spacing:1px}}
  .page-header p{{font-size:13px;color:#b2dfdb;margin-top:4px}}
  .badge{{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;font-size:11px;color:#fff;font-weight:700;white-space:nowrap}}
  .tabs{{display:flex;gap:4px;padding:16px 24px 0;background:#12122a}}
  .tab{{padding:10px 24px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:background .2s}}
  .tab.active{{background:#0d7377;color:#fff}}
  .tab:not(.active){{background:#22223b;color:#9ca3af}}
  .tab:hover:not(.active){{background:#2d2d4e;color:#fff}}
  .panel{{display:none;padding:24px;background:#12122a}}
  .panel.active{{display:block}}
  .section-title{{font-size:18px;font-weight:800;color:#14a085;margin-bottom:6px;letter-spacing:.5px}}
  .section-sub{{font-size:12px;color:#6b7280;margin-bottom:20px}}
  .schematic-wrap{{background:#fdf6e3;border-radius:12px;padding:16px;overflow:auto;border:2px solid #0d7377}}
  .schematic-wrap svg{{display:block;margin:auto;min-width:1000px}}
  .legend{{display:flex;flex-wrap:wrap;gap:14px;margin:16px 0}}
  .leg-item{{display:flex;align-items:center;gap:6px;font-size:11px;color:#d1d5db}}
  .leg-dot{{width:14px;height:14px;border-radius:3px;flex-shrink:0}}
  .wire-list{{list-style:none;padding:0;columns:2;gap:24px;margin-top:12px}}
  .wire-list li{{font-size:12px;color:#d1d5db;padding:5px 0;border-bottom:1px solid #1e1e35;display:flex;align-items:center;gap:8px;break-inside:avoid}}
  .wire-list li::before{{content:'';display:inline-block;width:24px;height:3px;border-radius:2px;flex-shrink:0}}
  .wire-red::before{{background:{WIRE['pwr']}}} .wire-blk::before{{background:{WIRE['gnd']}}}
  .wire-grn::before{{background:{WIRE['uart']}}} .wire-blu::before{{background:{WIRE['i2c']}}}
  .wire-yel::before{{background:{WIRE['sig']}}} .wire-pur::before{{background:{WIRE['spi']}}}
  .wire-org::before{{background:{WIRE['led']}}}
  .info-box{{background:#1e3a3a;border:1px solid #0d7377;border-radius:10px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#a7f3d0;line-height:1.7}}
  .info-box strong{{color:#14a085}}
  .warn-box{{background:#2d1a1a;border:1px solid #ef4444;border-radius:10px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#fca5a5;line-height:1.7}}
  .warn-box strong{{color:#ef4444}}
</style>
</head>
<body>
<div class="page-header">
  <div style="flex:1">
    <h1>PFUMA &mdash; Breadboard Layout</h1>
    <p>Where each module sits and which hole every jumper goes into, for the bench build</p>
  </div>
  <span class="badge">CN-01 &middot; 31 wires</span>
  <span class="badge">BS-01 &middot; 18 wires</span>
  <span class="badge">Pins from firmware</span>
</div>

<div class="tabs">
  <button class="tab active" onclick="show(0,this)">CN-01 Collar Node</button>
  <button class="tab" onclick="show(1,this)">BS-01 Base Station</button>
</div>

<div class="panel active">
  <div class="section-title">CN-01 &mdash; Collar Node</div>
  <div class="section-sub">One full-size 830-point breadboard. ESP32 straddles the centre channel; sensors sit to the right, GPS and indicators above.</div>
  <div class="warn-box"><strong>Power from USB only.</strong> The devkit's regulator feeds the 3V3 rail. Do not put the LiPo, solar panel or TP4056 on the breadboard. Fit the 433 MHz antenna before powering up &mdash; transmitting without one can destroy the SX1278.</div>
  <div class="schematic-wrap">{breadboard_svg(CN_MODULES, CN_WIRES, CN_NOTES)}</div>
  <div class="legend">{LEGEND}</div>
  <div class="info-box"><strong>Two resistors matter here.</strong> The DS18B20 needs a 4.7k pull-up from its yellow data line to the + rail or it reads &minus;127. The I2C bus does <em>not</em> need one &mdash; the GY-521 and MAX30102 breakouts already carry their own, so leave R5/R6 for the PCB.</div>
  {wire_ul(CN_LIST)}
</div>

<div class="panel">
  <div class="section-title">BS-01 &mdash; Base Station</div>
  <div class="section-sub">Second breadboard. No GPS and no sensors &mdash; radio, display and four status LEDs.</div>
  <div class="warn-box"><strong>Corrected pins.</strong> HARDWARE_DESIGN.md section 2.3 puts the yellow WiFi LED on GPIO5, which is already the LoRa chip-select. The firmware uses GPIO15 for yellow and GPIO13 for red. The layout below follows the firmware.</div>
  <div class="schematic-wrap">{breadboard_svg(BS_MODULES, BS_WIRES, BS_NOTES)}</div>
  <div class="legend">{LEGEND}</div>
  <div class="info-box"><strong>Leave the LM2596 and the 12 V adapter off the breadboard.</strong> They exist to run the finished enclosure from mains. USB is enough on the bench, and both boards must share the same radio settings: 433 MHz, SF7, 125 kHz.</div>
  {wire_ul(BS_LIST)}
</div>

<script>
function show(i, btn) {{
  document.querySelectorAll('.panel').forEach((p, n) => p.classList.toggle('active', n === i));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}}
</script>
</body>
</html>
"""

out = HERE / "BREADBOARD_LAYOUT.html"
out.write_text(HTML, encoding="utf-8")
print("wrote", out, f"({len(HTML)/1024:.0f} KB)")
