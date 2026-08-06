"""
Builds PFUMA_Poster.pdf -- a research-poster-style one-pager summarizing the
platform, in the same section structure as the MASAISAI poster template
(Intro/Objective/Methodology/Results/Analysis/Conclusion/Key Sources), filled
with real PFUMA content and real computed numbers (no placeholder figures).

Palette: same as MASAISAI (dataviz skill's validated default).
Categorical slot 1 (blue #2a78d6) = primary/working, slot 2 (aqua #1baf7a) =
secondary/planned. Sequential ramp used for the species disease-coverage bars.

Regenerate: python make_poster.py && python render_poster.py
Numbers below are computed directly from the codebase, not invented:
  - 33 API endpoints:  grep -c "@app.route" backend/app.py
  - 15 diseases, per-species coverage: parsed from diseaseData.js
  - 12 compliance docs: find compliance -name "*.md" | wc -l
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent

# ---------- palette (dataviz skill reference instance, same as MASAISAI) ----------
BLUE = "#2a78d6"        # categorical slot 1 -- working/real
AQUA = "#1baf7a"         # categorical slot 2 -- secondary
RED = "#c0392b"          # veto / gate emphasis
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
SURFACE = "#fcfcfb"
SEQ_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"]  # light->dark blue

# ---------- real, computed data (see docstring for how each was derived) ----------
DISEASE_SPECIES = [("Cattle", 10), ("Goat", 7), ("Sheep", 7), ("Pig", 4)]
TOTAL_DISEASES = 15
API_ENDPOINTS = 33
COMPLIANCE_DOCS = 12
ROLES = 5


# ---------- system architecture diagram (inline SVG, mirrors MASAISAI's boxes-and-arrows figure) ----------
def architecture_svg():
    W, H = 760, 250
    box_h = 64
    gap = 18
    top_y = 20
    bottom_y = top_y + box_h + 70

    top_boxes = [
        ("Client Layer", "Web (React) + Mobile (Expo)", "#dfeaff", BLUE, INK),
        ("Auth / RBAC Layer", "JWT + bcrypt, per-owner data scoping", "#dfeaff", BLUE, INK),
        ("AI Layer", "Jinda — role-aware compliance assistant", "#dfeaff", BLUE, INK),
        ("Police Clearance Layer", "Verifies ownership/brand — final veto", "#fbe1de", RED, RED),
    ]
    bottom_boxes = [
        ("Data Layer", "MySQL — users, animals, clearances, bids", "#e7f7ef", "#0f8a53", INK),
        ("IoT Layer", "ESP32 collar + base station — pairing & telemetry", "#e7f7ef", "#0f8a53", INK),
    ]

    box_w = (W - gap * (len(top_boxes) - 1)) / len(top_boxes)
    svg = [f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="system-ui,-apple-system,Segoe UI,sans-serif">']

    top_centers = []
    for i, (title, sub, fill, stroke, textcolor) in enumerate(top_boxes):
        x = i * (box_w + gap)
        cx = x + box_w / 2
        top_centers.append(cx)
        svg.append(f'<rect x="{x:.1f}" y="{top_y}" width="{box_w:.1f}" height="{box_h}" rx="8" '
                    f'fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
        svg.append(f'<text x="{cx:.1f}" y="{top_y + 24}" text-anchor="middle" font-size="12.5" '
                    f'font-weight="700" fill="{textcolor}">{title}</text>')
        # wrap subtitle across two lines if long
        words = sub.split(" ")
        line1, line2 = " ".join(words[:len(words)//2 + (len(words) % 2)]), " ".join(words[len(words)//2 + (len(words) % 2):])
        svg.append(f'<text x="{cx:.1f}" y="{top_y + 40}" text-anchor="middle" font-size="9" '
                    f'fill="{INK_SECONDARY}">{line1}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{top_y + 52}" text-anchor="middle" font-size="9" '
                    f'fill="{INK_SECONDARY}">{line2}</text>')
        if i < len(top_boxes) - 1:
            ax = x + box_w + 2
            svg.append(f'<path d="M{ax:.1f},{top_y + box_h/2} L{ax + gap - 4:.1f},{top_y + box_h/2}" '
                        f'stroke="{INK_MUTED}" stroke-width="1.6" marker-end="url(#arrow)"/>')

    bw2 = (W - gap) / len(bottom_boxes)
    bottom_centers = []
    for i, (title, sub, fill, stroke, textcolor) in enumerate(bottom_boxes):
        x = i * (bw2 + gap)
        cx = x + bw2 / 2
        bottom_centers.append(cx)
        svg.append(f'<rect x="{x:.1f}" y="{bottom_y}" width="{bw2:.1f}" height="{box_h}" rx="8" '
                    f'fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
        svg.append(f'<text x="{cx:.1f}" y="{bottom_y + 24}" text-anchor="middle" font-size="12.5" '
                    f'font-weight="700" fill="{textcolor}">{title}</text>')
        words = sub.split(" ")
        line1, line2 = " ".join(words[:len(words)//2 + (len(words) % 2)]), " ".join(words[len(words)//2 + (len(words) % 2):])
        svg.append(f'<text x="{cx:.1f}" y="{bottom_y + 40}" text-anchor="middle" font-size="9" '
                    f'fill="{INK_SECONDARY}">{line1}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{bottom_y + 52}" text-anchor="middle" font-size="9" '
                    f'fill="{INK_SECONDARY}">{line2}</text>')

    # connectors from Auth layer (index 1) down to Data layer, and Police layer (index 3) down to IoT layer
    svg.append(f'<path d="M{top_centers[1]:.1f},{top_y + box_h} L{top_centers[1]:.1f},{top_y + box_h + 22} '
                f'L{bottom_centers[0]:.1f},{top_y + box_h + 22} L{bottom_centers[0]:.1f},{bottom_y}" '
                f'fill="none" stroke="{INK_MUTED}" stroke-width="1.6" marker-end="url(#arrow)"/>')
    svg.append(f'<path d="M{top_centers[3]:.1f},{top_y + box_h} L{top_centers[3]:.1f},{top_y + box_h + 40} '
                f'L{bottom_centers[1]:.1f},{top_y + box_h + 40} L{bottom_centers[1]:.1f},{bottom_y}" '
                f'fill="none" stroke="{RED}" stroke-width="1.6" marker-end="url(#arrow-red)"/>')

    svg.append(f'''<defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="{INK_MUTED}"/>
      </marker>
      <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="{RED}"/>
      </marker>
    </defs>''')
    svg.append("</svg>")
    return "".join(svg)


# ---------- bar chart: diseases modeled per species (real counts from diseaseData.js) ----------
def species_bar_svg():
    W, H = 520, 260
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
        color = SEQ_RAMP[min(int((count / max_val) * len(SEQ_RAMP)), len(SEQ_RAMP) - 1) + 1] if count / max_val > 0.15 else SEQ_RAMP[1]
        svg.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bar_w}" height="{bh:.1f}" '
                    f'rx="4" fill="{BLUE}"/>')
        svg.append(f'<text x="{bx + bar_w / 2:.1f}" y="{by - 6:.1f}" text-anchor="middle" '
                    f'font-size="11" font-weight="700" fill="{INK_SECONDARY}">{count}</text>')
        svg.append(f'<text x="{gx + group_w / 2:.1f}" y="{H - pad_b + 16:.1f}" text-anchor="middle" '
                    f'font-size="11" fill="{INK}" font-weight="600">{species}</text>')

    svg.append(f'<line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{W - pad_r}" y2="{pad_t + plot_h}" '
                f'stroke="#c3c2b7" stroke-width="1.5"/>')
    svg.append("</svg>")
    return "".join(svg)


arch_svg = architecture_svg()
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
    background: linear-gradient(120deg, #14532d 0%, #1b5e20 45%, #2a78d6 100%);
    color: white; padding: 46px 60px 34px 60px;
  }}
  .header h1 {{ margin: 0; font-size: 58px; font-weight: 800; letter-spacing: 0.5px; }}
  .header .tagline {{ font-size: 22px; font-weight: 400; opacity: 0.94; margin-top: 6px; }}
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
    font-size: 19px; color: {BLUE}; margin: 22px 0 10px 0; padding-bottom: 6px;
    border-bottom: 2px solid {BLUE};
  }}
  .col h2:first-child {{ margin-top: 0; }}
  p {{ font-size: 13.5px; line-height: 1.55; color: {INK}; margin: 0 0 10px 0; }}
  .small {{ font-size: 11.5px; color: {INK_MUTED}; }}
  .figure {{ margin: 8px 0 4px 0; text-align: center; }}
  .figure img {{ width: 100%; border-radius: 4px; }}
  .caption {{ font-size: 11px; color: {INK_MUTED}; text-align: center; margin-top: 4px; }}
  .legend {{ display: flex; gap: 16px; justify-content: center; margin-top: 4px; font-size: 11px; }}
  .legend span {{ display: inline-flex; align-items: center; gap: 5px; }}
  .swatch {{ width: 11px; height: 11px; border-radius: 2px; display: inline-block; }}
  .stat-row {{ display: flex; gap: 10px; margin: 10px 0; }}
  .stat {{
    flex: 1; background: #eef1f5; border-radius: 6px; padding: 10px 8px; text-align: center;
  }}
  .stat .v {{ font-size: 20px; font-weight: 700; color: {BLUE}; }}
  .stat .l {{ font-size: 10px; color: {INK_MUTED}; margin-top: 2px; }}
  table.status {{ width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0 14px 0; }}
  table.status th {{ text-align: left; font-size: 10.5px; color: {INK_MUTED}; text-transform: uppercase;
    letter-spacing: 0.4px; padding: 4px 6px; border-bottom: 1px solid {GRID}; }}
  table.status td {{ padding: 6px 6px; border-bottom: 1px solid {GRID}; vertical-align: top; }}
  .tag {{ display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }}
  .tag.real {{ background: #e7f7ef; color: #0f8a53; }}
  .tag.sim {{ background: #fff4e0; color: #a5670a; }}
  .footer {{
    margin: 20px 60px 0 60px; padding: 20px 24px; background: #0f2a1c; color: #eef1f5;
    border-radius: 8px;
  }}
  .footer h2 {{ color: #bfe8cf; border-bottom: 2px solid {BLUE}; font-size: 17px; }}
  .footer p {{ color: #cfd6e8; font-size: 12px; margin: 0 0 6px 0; }}
  .footer .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
</style></head>
<body>
<div class="poster">
  <div class="header">
    <h1>PFUMA</h1>
    <div class="tagline">Digitizing Zimbabwe's Livestock Trade &mdash; a Five-Role Platform for Disease Control, Anti-Theft Verification &amp; Market Access</div>
  </div>

  <div class="authors-bar">
    <div class="block">
      <h3>Authors</h3>
      <p>[Arnold &ndash; Full Legal Name], Adrianny Jaliele</p>
    </div>
    <div class="block right">
      <h3>Affiliation &amp; Submission</h3>
      <p>Team GRIWD, Zimbabwe &mdash; Zimbabwe Agricultural Show 2026</p>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <h2>Introduction</h2>
      <p>Livestock trade in Zimbabwe runs on paper, word-of-mouth, and informal trust. January
      Disease (Theileriosis) alone has killed over 500,000 cattle since 2016. Stock theft is
      organized enough that a single recent police crackdown produced over 3,400 arrests.
      Communal farmers &mdash; the majority &mdash; are routinely excluded from formal credit and
      verified trade because signup and paperwork assume freehold title they don't hold.</p>

      <h2>Objective</h2>
      <p>Build and deploy a role-aware digital platform &mdash; Farmer, Veterinarian, Supplier,
      Retailer, Police &mdash; that operationalizes Zimbabwe's actual legal framework for
      livestock trade (Stock Theft Prevention Act, Animal Health Act, Veterinary Surgeons Act,
      Consumer Protection Act) as working software, not an afterthought bolted onto a generic
      farm app.</p>

      <h2>Methodology</h2>
      <p>A React (Vite) web app and Expo mobile app share a Flask/MySQL backend with JWT
      authentication, bcrypt password hashing, and per-owner data scoping. An AI compliance
      assistant (Jinda) answers legal/health questions from researched Zimbabwean law and
      refuses to leak other users' data. ESP32/LoRa IoT hardware pairs collars and base
      stations to a farmer's account for herd health and anti-theft monitoring. The system
      architecture is shown at right &mdash; note the Police Clearance Layer.</p>
      <div class="stat-row">
        <div class="stat"><div class="v">{ROLES}</div><div class="l">stakeholder roles</div></div>
        <div class="stat"><div class="v">{API_ENDPOINTS}</div><div class="l">backend API endpoints</div></div>
        <div class="stat"><div class="v">{COMPLIANCE_DOCS}</div><div class="l">Zimbabwean law/species docs researched</div></div>
      </div>
    </div>

    <div class="col">
      <div class="figure">{arch_svg}</div>
      <div class="caption">Figure 1. System architecture &mdash; the Police Clearance Layer always has final veto over every livestock listing, mirroring Zimbabwe's real ownership &rarr; vet &rarr; police clearance sequence.</div>
      <h2 style="margin-top:18px;">Disease Coverage by Species</h2>
      <p class="small">{TOTAL_DISEASES} notifiable/high-impact diseases modeled in the diagnostics engine, spanning WOAH-notifiable and Zimbabwe-endemic conditions (FMD, January Disease, Anthrax, ASF, PPR, CCPP, and more).</p>
      <div class="figure">{bar_svg}</div>
    </div>

    <div class="col">
      <h2>Results</h2>
      <p>Every claim below was verified by exercising the running system (curl against the
      live Flask API, database round-trips), not asserted from the code alone. Rather than
      present the platform as uniformly "done," each capability is labelled honestly:</p>
      <table class="status">
        <tr><th>Capability</th><th>Status</th></tr>
        <tr><td>Auth (bcrypt + JWT), per-role &amp; per-owner data scoping</td><td><span class="tag real">Real</span></td></tr>
        <tr><td>Police signup review + sale-clearance workflow</td><td><span class="tag real">Real</span></td></tr>
        <tr><td>AI compliance assistant, role-aware data guard</td><td><span class="tag real">Real</span></td></tr>
        <tr><td>IoT device pairing + telemetry intake endpoint</td><td><span class="tag real">Real</span></td></tr>
        <tr><td>Live IoT sensor dashboard (continuous reading history)</td><td><span class="tag sim">Simulated</span></td></tr>
      </table>

      <h2>Analysis</h2>
      <p>The Police Clearance Layer is the structural core of the platform, not a UI badge:
      a livestock listing is created with status <code>pending_clearance</code> and is
      database-enforced invisible to buyers (<code>WHERE status='available'</code>) until an
      officer resolves it. This mirrors the same "software assists, but a hard rules layer
      has final veto" pattern used in Team GRIWD's MASAISAI submission to the POTRAZ AI4I
      challenge &mdash; disease/AI signals inform the decision, but only a verified authority
      can grant access.</p>

      <h2>Conclusion</h2>
      <p>A working, tested prototype demonstrates that a legally-grounded, role-aware
      livestock platform is achievable today &mdash; not a future roadmap item &mdash; giving
      Zimbabwe's Agricultural Show a concrete technical case for formal, law-compliant
      digital trade infrastructure that protects farmers, deters stock theft, and supports
      national disease surveillance.</p>
    </div>
  </div>

  <div class="footer">
    <h2>Key Sources &amp; Acknowledgements</h2>
    <div class="cols">
      <div>
        <p>Stock Theft Prevention Act [Chapter 9:18], Zimbabwe</p>
        <p>Animal Health Act [Chapter 19:01] &amp; Animal Health (General) Regulations, 1994</p>
        <p>Veterinary Surgeons Act [Chapter 27:15] &mdash; Council of Veterinary Surgeons of Zimbabwe (CVSZ)</p>
        <p>Consumer Protection Act [Chapter 14:44], Zimbabwe, 2019</p>
      </div>
      <div>
        <p>World Organisation for Animal Health (WOAH) &amp; FAO disease references</p>
        <p>Zimbabwe Republic Police &mdash; Anti Stock Theft Unit statements</p>
        <p>Full legal research &amp; source citations: /compliance folder in repository</p>
        <p>Contact: teamgriwd@gmail.com</p>
      </div>
    </div>
  </div>
</div>
</body></html>
"""

out_html = HERE / "poster.html"
out_html.write_text(html, encoding="utf-8")
print(f"Wrote {out_html}")
