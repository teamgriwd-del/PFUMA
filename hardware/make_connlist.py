import sys; sys.path.insert(0, ".")
import vero, conn_list

C = {"pwr":"#ef4444","gnd":"#6b7280","spi":"#a855f7","i2c":"#3b82f6",
     "uart":"#22c55e","sig":"#f59e0b","led":"#f97316"}
LEG = [("pwr","Power rail"),("gnd","Ground"),("spi","SPI / LoRa"),("i2c","I2C bus"),
       ("uart","UART / GPS"),("sig","Signal / sense"),("led","LED")]

def board_html(board, fn, sub):
    groups = conn_list.rows_for(board, fn) + conn_list.chains(board, fn)
    total = sum(len(i) for _, i in groups)
    h = ['<div class="board"><div class="bh"><h2>%s</h2><span class="cnt">%d connections</span></div>'
         '<div class="bsub">%s</div><div class="cols">' % (board, total, sub)]
    for name, items in groups:
        h.append('<div class="grp"><div class="gt">%s</div><ul>' % name)
        for k, _, lab, dest, hole in items:
            h.append('<li style="--c:%s"><span class="pin">%s</span>'
                     '<span class="arw">&rarr;</span><span class="dst">%s</span></li>'
                     % (C[k], lab, dest))
        h.append('</ul></div>')
    h.append('</div></div>')
    return "".join(h)

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#12122a;color:#e0e0e0;padding:26px 30px}
h1{font-size:24px;font-weight:900;color:#fff}
.top{background:linear-gradient(135deg,#0d7377,#14a085);padding:20px 26px;border-radius:12px;margin-bottom:18px}
.top p{font-size:12.5px;color:#c9f2e9;margin-top:5px}
.legend{display:flex;flex-wrap:wrap;gap:16px;margin:14px 0 22px}
.lg{display:flex;align-items:center;gap:7px;font-size:11.5px;color:#9fb3c8}
.dot{width:22px;height:4px;border-radius:2px}
.board{margin-bottom:26px}
.bh{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid #0d7377;padding-bottom:7px}
h2{font-size:19px;color:#14a085;font-family:Consolas,monospace}
.cnt{font-size:11px;color:#6b7280}
.bsub{font-size:11.5px;color:#8b93a7;margin:7px 0 14px}
.cols{columns:2;column-gap:34px}
.grp{break-inside:avoid;margin-bottom:15px}
.gt{font-size:12px;font-weight:800;color:#cbd5e1;letter-spacing:.4px;margin-bottom:5px;
    border-left:3px solid #14a085;padding-left:8px}
ul{list-style:none}
li{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0 4px 8px;
   border-bottom:1px solid #1e1e35;break-inside:avoid}
li::before{content:'';width:20px;height:3.5px;border-radius:2px;background:var(--c);flex:0 0 auto}
.pin{font-family:Consolas,monospace;color:#fff;font-weight:700;min-width:118px}
.arw{color:#6b7280}
.dst{color:#b8c4d4}
b{color:#fff}
"""

BS = ("Every connection on the base station. GPIO numbers are the ESP32 devkit "
      "silkscreen. Rails are the shared strips: 3V3, 5V, GND, 12V.")
CN = ("Every connection on the collar node. No solar &mdash; the TP4056 charges "
      "through its own micro-USB. R5/R6 are not fitted; the breakouts carry their "
      "own I2C pull-ups. R1 4k7 sits across DS18B20 DATA and the 3V3 rail.")

html = ('<meta charset="utf-8"><title>PFUMA connections</title><style>%s</style>'
        '<div class="top"><h1>PFUMA &mdash; Pin Connections</h1>'
        '<p>Veroboard build. Generated from the verified netlist &mdash; matches the build sheets exactly.</p></div>'
        '<div class="legend">%s</div>%s%s' % (
        CSS,
        "".join('<div class="lg"><span class="dot" style="background:%s"></span>%s</div>' % (C[k], t)
                for k, t in LEG),
        board_html("BS-02", vero.bs02, BS),
        board_html("CN-02", vero.cn02, CN)))
open("CONNECTIONS.html", "w", encoding="utf-8").write(html)
print("wrote CONNECTIONS.html")
