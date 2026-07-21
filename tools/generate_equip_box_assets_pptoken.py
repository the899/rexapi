#!/usr/bin/env python3
import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image


API_URL = "https://api.pptoken.cc/v1/images/generations"
MODEL = "gpt-image-2"
SIZE = "1024x1024"
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "generated"
KEY_COLOR = (0, 255, 0)


ASSETS = [
    (
        "equip_box_gold",
        "a compact golden equipment supply box viewed straight from above, top-down arcade tank game pickup sprite, beveled metal panels, small latch and reinforced corners, rich gold color, readable at 24 pixels, one single object",
    ),
    (
        "equip_box_bonus",
        "a compact gold and crimson elite equipment supply box viewed straight from above, top-down arcade tank game pickup sprite, gold metal frame, red armor panels, bright premium highlight, small latch and reinforced corners, readable at 24 pixels, one single object",
    ),
]


def build_prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: top-down game pickup sprite for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal. "
        "Subject: centered with generous padding, crisp silhouette. "
        "Style/medium: polished pixel-art arcade sprite, high contrast, clear tiny-game readability. "
        "No ground plane, no cast shadow, no contact shadow, no text, no watermark, no extra objects. "
        "Do not use #00ff00 anywhere in the subject."
    )


def request_image(api_key: str, prompt: str) -> dict:
    body = json.dumps({"model": MODEL, "prompt": prompt, "size": SIZE}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=360) as res:
        return json.loads(res.read().decode("utf-8"))


def save_source(data: dict, path: Path) -> None:
    item = data["data"][0]
    if item.get("b64_json"):
        path.write_bytes(base64.b64decode(item["b64_json"]))
        return
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=120) as res:
            path.write_bytes(res.read())
        return
    raise RuntimeError("image response did not include b64_json or url")


def remove_chroma_key(src: Path, out: Path) -> None:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            distance = abs(r - KEY_COLOR[0]) + abs(g - KEY_COLOR[1]) + abs(b - KEY_COLOR[2])
            if distance < 90:
                pixels[x, y] = (r, g, b, 0)
            elif g > 160 and r < 90 and b < 90:
                pixels[x, y] = (r, g, b, max(0, a - 160))
    bbox = image.getchannel("A").getbbox()
    if bbox:
        pad = 32
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(image.width, bbox[2] + pad)
        bottom = min(image.height, bbox[3] + pad)
        image = image.crop((left, top, right, bottom))
    image.save(out)


def main() -> int:
    api_key = os.environ.get("PPTOKEN_API_KEY")
    if not api_key:
        print("PPTOKEN_API_KEY is required")
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stem, subject in ASSETS:
        src = OUT_DIR / f"{stem}_src.png"
        out = OUT_DIR / f"{stem}.png"
        if out.exists() and out.stat().st_size > 0:
            print(f"skip {out.name}")
            continue

        print(f"generate {src.name}", flush=True)
        last_error = ""
        for attempt in range(1, 4):
            try:
                data = request_image(api_key, build_prompt(subject))
                if "error" in data:
                    last_error = json.dumps(data["error"], ensure_ascii=False)
                    time.sleep(8)
                    continue
                save_source(data, src)
                remove_chroma_key(src, out)
                print(f"saved {out.name}", flush=True)
                break
            except urllib.error.HTTPError as exc:
                last_error = f"{exc.code} {exc.read().decode('utf-8', errors='replace')}"
            except Exception as exc:
                last_error = str(exc)
            time.sleep(8)
        else:
            print(f"failed {stem}: {last_error}")
            return 1

        time.sleep(2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
