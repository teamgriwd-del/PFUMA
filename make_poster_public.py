"""
Builds PFUMA_Poster_Public.pdf -- a plain-language, benefit-focused companion
to PFUMA_Poster.pdf (the technical poster). Same visual template/palette so
they read as a matched pair, but written for farmers, traders, and visitors
at the Zimbabwe Agricultural Show who have never seen an API endpoint and
don't need to. No jargon: no "JWT", "RBAC", "backend", "endpoint", etc.

Regenerate: python make_poster_public.py && python render_poster_public.py
Same real, computed numbers as the technical poster (15 diseases, 5 roles).
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent

# ---------- palette (same family as the technical poster, for a matched pair) ----------
BLUE = "#2a78d6"
GREEN = "#1b5e20"
GOLD = "#ca8a04"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
SURFACE = "#fcfcfb"
SEQ_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"]

DISEASE_SPECIES = [("Cattle", 10), ("Goat", 7), ("Sheep", 7), ("Pig", 4)]
TOTAL_DISEASES = 15


# ---------- "how it works" journey diagram: 4 friendly numbered steps ----------
def journey_svg():
    W, H = 760, 210
    steps = [
        ("1", "Register Your Animals", "Get a digital ID for every animal — always-on proof it's yours."),
        ("2", "Watch Their Health", "Jinda, your AI helper, answers questions and tracks vaccines in plain language."),
        ("3", "List It For Sale", "Post your animal for verified buyers across Zimbabwe to see."),
        ("4", "Get Police Clearance", "Officers check the papers before any sale goes live — trusted by buyers, safe for you."),
    ]
    n = len(steps)
    gap = 20
    box_w = (W - gap * (n - 1)) / n
    box_h = 150
    y = 30
    circle_r = 22

    svg = [f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="system-ui,-apple-system,Segoe UI,sans-serif">']

    for i, (num, title, desc) in enumerate(steps):
        x = i * (box_w + gap)
        cx = x + box_w / 2
        svg.append(f'<rect x="{x:.1f}" y="{y}" width="{box_w:.1f}" height="{box_h}" rx="12" '
                    f'fill="#eef7ee" stroke="{GREEN}" stroke-width="1.4"/>')
        svg.append(f'<circle cx="{cx:.1f}" cy="{y + 34}" r="{circle_r}" fill="{GREEN}"/>')
        svg.append(f'<text x="{cx:.1f}" y="{y + 41}" text-anchor="middle" font-size="20" '
                    f'font-weight="800" fill="white">{num}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{y + 76}" text-anchor="middle" font-size="12.5" '
                    f'font-weight="700" fill="{INK}">{title}</text>')
        words = desc.split(" ")
        lines, cur = [], []
        for w in words:
            cur.append(w)
            if len(" ".join(cur)) > 26:
                lines.append(" ".join(cur[:-1])); cur = [w]
        lines.append(" ".join(cur))
        for li, line in enumerate(lines[:4]):
            svg.append(f'<text x="{cx:.1f}" y="{y + 94 + li * 13}" text-anchor="middle" font-size="9.5" '
                        f'fill="{INK_SECONDARY}">{line}</text>')
        if i < n - 1:
            ax = x + box_w + 2
            svg.append(f'<path d="M{ax:.1f},{y + box_h/2} L{ax + gap - 4:.1f},{y + box_h/2}" '
                        f'stroke="{GOLD}" stroke-width="2.4" marker-end="url(#garrow)"/>')

    svg.append(f'''<defs>
      <marker id="garrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="{GOLD}"/>
      </marker>
    </defs>''')
    svg.append("</svg>")
    return "".join(svg)


# ---------- disease bar chart (same real counts as the technical poster) ----------
def species_bar_svg():
    W, H = 520, 240
    pad_l, pad_r, pad_t, pad_b = 40, 10, 10, 40
    plot_w, plot_h = W - pad_l - pad_r, H - pad_t - pad_b
    group_w = plot_w / len(DISEASE_SPECIES)
    bar_w = 46
    max_val = TOTAL_DISEASES

    svg = [f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="system-ui,-apple-system,Segoe UI,sans-serif">']

    for frac in [0, 0.25, 0.5, 0.75, 1.0]:
        y = pad_t + plot_h - frac * plot_h
        val = frac * max_val
        svg.append(f'<line x1="{pad_l}" y1="{y:.1f}" x2="{W - pad_r}" y2="{y:.1f}" '
                    f'stroke="{GRID}" stroke-width="1"/>')
        svg.append(f'<text x="{pad_l - 6}" y="{y + 3:.1f}" text-anchor="end" font-size="9" '
                    f'fill="{INK_MUTED}">{val:.0f}</text>')

    for i, (species, count) in enumerate(DISEASE_SPECIES):
        gx = pad_l + i * group_w
        bx = gx + group_w / 2 - bar_w / 2
        bh = (count / max_val) * plot_h
        by = pad_t + plot_h - bh
        svg.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bar_w}" height="{bh:.1f}" '
                    f'rx="4" fill="{GREEN}"/>')
        svg.append(f'<text x="{bx + bar_w / 2:.1f}" y="{by - 6:.1f}" text-anchor="middle" '
                    f'font-size="11" font-weight="700" fill="{INK_SECONDARY}">{count}</text>')
        svg.append(f'<text x="{gx + group_w / 2:.1f}" y="{H - pad_b + 16:.1f}" text-anchor="middle" '
                    f'font-size="11" fill="{INK}" font-weight="600">{species}</text>')

    svg.append(f'<line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{W - pad_r}" y2="{pad_t + plot_h}" '
                f'stroke="#c3c2b7" stroke-width="1.5"/>')
    svg.append("</svg>")
    return "".join(svg)


journey = journey_svg()
bar_svg = species_bar_svg()

html = f"""<!doctype html>
<html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; font-family: system-ui,-apple-system,'Segoe UI',sans-serif;
    background: {SURFACE}; color: {INK};
  }}
  .poster {{ width: 1800px; padding: 0 0 40px 0; }}
  .header {{
    background: linear-gradient(120deg, #14532d 0%, {GREEN} 45%, {BLUE} 100%);
    color: white; padding: 46px 60px 34px 60px;
  }}
  .header h1 {{ margin: 0; font-size: 58px; font-weight: 800; letter-spacing: 0.5px; }}
  .header .tagline {{ font-size: 24px; font-weight: 500; opacity: 0.96; margin-top: 8px; }}
  .authors-bar {{
    background: #eef1f5; padding: 18px 60px; display: flex; justify-content: space-between;
    border-bottom: 1px solid {GRID};
  }}
  .authors-bar .block h3 {{ margin: 0 0 4px 0; font-size: 15px; color: {INK}; }}
  .authors-bar .block p {{ margin: 0; font-size: 14px; color: {INK_SECONDARY}; }}
  .authors-bar .block {{ text-align: left; }}
  .authors-bar .block.right {{ text-align: right; }}
  .grid {{
    display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 0;
    padding: 30px 60px 10px 60px;
  }}
  .col {{ padding: 0 22px; }}
  .col + .col {{ border-left: 1px solid {GRID}; }}
  h2 {{
    font-size: 20px; color: {GREEN}; margin: 22px 0 10px 0; padding-bottom: 6px;
    border-bottom: 2px solid {GREEN};
  }}
  .col h2:first-child {{ margin-top: 0; }}
  p {{ font-size: 14px; line-height: 1.6; color: {INK}; margin: 0 0 10px 0; }}
  .small {{ font-size: 11.5px; color: {INK_MUTED}; }}
  .figure {{ margin: 8px 0 4px 0; text-align: center; }}
  .caption {{ font-size: 11.5px; color: {INK_MUTED}; text-align: center; margin-top: 4px; }}
  .stat-row {{ display: flex; gap: 10px; margin: 10px 0; }}
  .stat {{
    flex: 1; background: #eef7ee; border-radius: 6px; padding: 12px 8px; text-align: center;
  }}
  .stat .v {{ font-size: 22px; font-weight: 800; color: {GREEN}; }}
  .stat .l {{ font-size: 10.5px; color: {INK_MUTED}; margin-top: 3px; }}
  .role-list {{ list-style: none; margin: 0 0 14px 0; padding: 0; }}
  .role-list li {{ margin-bottom: 10px; font-size: 13.5px; line-height: 1.5; padding-left: 14px; border-left: 3px solid {GREEN}; }}
  .role-list b {{ color: {INK}; }}
  table.compare {{ width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 8px 0 16px 0; }}
  table.compare th {{ text-align: left; font-size: 11px; color: {INK_MUTED}; text-transform: uppercase;
    letter-spacing: 0.4px; padding: 6px; border-bottom: 1px solid {GRID}; }}
  table.compare td {{ padding: 8px 6px; border-bottom: 1px solid {GRID}; vertical-align: top; }}
  table.compare .old {{ color: {INK_MUTED}; }}
  table.compare .new {{ color: {GREEN}; font-weight: 600; }}
  .cta {{
    margin-top: 4px; background: {GOLD}; color: white; border-radius: 10px; padding: 16px 18px;
  }}
  .cta h3 {{ margin: 0 0 6px 0; font-size: 15px; }}
  .cta p {{ color: white; margin: 0; font-size: 13px; }}
  .footer {{
    margin: 20px 60px 0 60px; padding: 20px 24px; background: #0f2a1c; color: #eef1f5;
    border-radius: 8px; text-align: center;
  }}
  .footer h2 {{ color: #bfe8cf; border-bottom: none; font-size: 22px; margin: 0 0 8px 0; }}
  .footer p {{ color: #cfd6e8; font-size: 14px; margin: 0 0 4px 0; }}
</style></head>
<body>
<div class="poster">
  <div class="header">
    <h1>PFUMA</h1>
    <div class="tagline">Healthier Herds. Honest Sales. Peace of Mind for Every Zimbabwean Farmer.</div>
  </div>

  <div class="authors-bar">
    <div class="block">
      <h3>Brought To You By</h3>
      <p>Arnold T. Mapindu &amp; Adrianny Jaliele</p>
    </div>
    <div class="block right">
      <h3>Find Us At</h3>
      <p>Zimbabwe Agricultural Show 2026</p>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <h2>The Problem</h2>
      <p>Your livestock is one of your family's biggest investments — but it's at risk every
      day. Diseases like January Disease have killed over 500,000 cattle in Zimbabwe since
      2016, often before anyone notices an animal is sick. Cattle theft is common enough that
      police recently arrested over 3,400 people in a single crackdown. And when you sell an
      animal, how do you prove — to a buyer, or to the police — that it's really yours?</p>

      <h2>Meet PFUMA</h2>
      <p>PFUMA is a simple app that helps you look after your animals, prove they're yours,
      and sell them safely — built around how Zimbabwean farmers, vets, traders, and police
      already do business, just made faster, fairer, and safer.</p>

      <h2>Who It's For</h2>
      <ul class="role-list">
        <li><span><b>Farmers</b> — track your herd's health and sell with confidence.</span></li>
        <li><span><b>Vets</b> — reach the farmers who need you and issue certificates.</span></li>
        <li><span><b>Suppliers</b> — deliver medicine and feed where it's needed.</span></li>
        <li><span><b>Retailers</b> — buy livestock knowing the paperwork is real.</span></li>
        <li><span><b>Police</b> — verify ownership and stop stolen cattle from being sold.</span></li>
      </ul>
      <div class="stat-row">
        <div class="stat"><div class="v">5</div><div class="l">kinds of people, one platform</div></div>
        <div class="stat"><div class="v">15</div><div class="l">diseases PFUMA helps you catch early</div></div>
        <div class="stat"><div class="v">100%</div><div class="l">of sales checked before going live</div></div>
      </div>
    </div>

    <div class="col">
      <h2>How It Works</h2>
      <div class="figure">{journey}</div>
      <h2 style="margin-top:18px;">Diseases PFUMA Helps You Catch Early</h2>
      <p class="small">From Foot-and-Mouth Disease to January Disease, PFUMA recognizes 15 of the most common and dangerous livestock diseases in Zimbabwe — across cattle, goats, sheep, and pigs.</p>
      <div class="figure">{bar_svg}</div>
      <div class="cta">
        <h3>Ready to protect your herd?</h3>
        <p>Visit our stand at the Zimbabwe Agricultural Show 2026 to see PFUMA live on a phone in your hands — or reach us any time at teamgriwd@gmail.com.</p>
      </div>
    </div>

    <div class="col">
      <h2>Why You Can Trust PFUMA</h2>
      <p><b>Your information stays private.</b> Only you — and the people you choose to work
      with — can see your animals and records.</p>
      <p><b>No unfair middlemen.</b> You deal directly with real buyers, vets, and suppliers.</p>
      <p><b>Works for every farmer.</b> Whether you hold a title deed or a communal land
      allocation letter, PFUMA accepts it — you don't need to be a big commercial operation
      to be taken seriously.</p>
      <p><b>Built on Zimbabwean law.</b> Not just an app — a system designed around the same
      rules courts and police already use to protect farmers from theft and fraud.</p>

      <h2>The Old Way vs. The PFUMA Way</h2>
      <table class="compare">
        <tr><th>Before</th><th>With PFUMA</th></tr>
        <tr><td class="old">Paper records — easy to lose</td><td class="new">Digital ID, always with you</td></tr>
        <tr><td class="old">"Trust me, it's my cow"</td><td class="new">Police-verified before every sale</td></tr>
        <tr><td class="old">Wait weeks to reach a vet</td><td class="new">Message a vet directly, any time</td></tr>
        <tr><td class="old">Sell to whoever shows up first</td><td class="new">Reach verified buyers across Zimbabwe</td></tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <h2>Come See PFUMA at the Zimbabwe Agricultural Show 2026</h2>
    <p>Every feature is built to respect Zimbabwe's laws on animal health, stock theft, and consumer protection — so you're always on the right side of the law.</p>
    <p>Team GRIWD &nbsp;|&nbsp; teamgriwd@gmail.com</p>
  </div>
</div>
</body></html>
"""

out_html = HERE / "poster_public.html"
out_html.write_text(html, encoding="utf-8")
print(f"Wrote {out_html}")
