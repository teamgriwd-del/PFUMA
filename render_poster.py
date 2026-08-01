"""Renders poster.html to PFUMA_Poster.pdf and a PNG preview via Playwright."""

from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
html_path = HERE / "poster.html"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1800, "height": 1200})
    page.goto(f"file:///{html_path.as_posix()}")
    page.wait_for_timeout(300)

    height = page.evaluate("document.querySelector('.poster').scrollHeight")
    page.set_viewport_size({"width": 1800, "height": int(height)})

    page.screenshot(path=str(HERE / "poster_preview.png"), full_page=True)

    page.pdf(
        path=str(HERE / "PFUMA_Poster.pdf"),
        width="1800px",
        height=f"{height}px",
        print_background=True,
        margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
    )
    browser.close()

print("Saved PFUMA_Poster.pdf and poster_preview.png")
