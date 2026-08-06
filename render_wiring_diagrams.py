"""Renders wiring_cn01.html / wiring_bs01.html to PDF + PNG preview via Playwright."""

from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent

PAGES = [
    ("wiring_cn01.html", "PFUMA_CN01_Wiring_Diagram.pdf", "wiring_cn01_preview.png"),
    ("wiring_bs01.html", "PFUMA_BS01_Wiring_Diagram.pdf", "wiring_bs01_preview.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for html_name, pdf_name, png_name in PAGES:
        html_path = HERE / html_name
        page = browser.new_page(viewport={"width": 1700, "height": 1200})
        page.goto(f"file:///{html_path.as_posix()}")
        page.wait_for_timeout(300)

        height = page.evaluate("document.querySelector('.sheet').scrollHeight")
        page.set_viewport_size({"width": 1700, "height": int(height)})

        page.screenshot(path=str(HERE / png_name), full_page=True)
        page.pdf(
            path=str(HERE / pdf_name),
            width="1700px",
            height=f"{height}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        page.close()
        print(f"Saved {pdf_name} and {png_name}")
    browser.close()
