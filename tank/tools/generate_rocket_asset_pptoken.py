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


def prompt() -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: small top-down rocket projectile sprite for a web tank survival roguelite. "
        "Primary request: one elongated enemy rocket missile, horizontal side view pointing right, red nose cone, dark steel body, small fins, bright orange exhaust flame, clearly not circular. "
        "Style/medium: polished pixel-art arcade sprite, high contrast, readable at 28 pixels wide. "
        "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal. "
        "Subject: one single complete rocket only, centered with generous padding, crisp silhouette. "
        "No ground plane, no cast shadow, no contact shadow, no text, no watermark, no extra objects. "
        "Do not use #00ff00 anywhere in the subject."
    )


def request_image(api_key: str) -> dict:
    body = json.dumps({"model": MODEL, "prompt": prompt(), "size": SIZE}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=420) as res:
        return json.loads(res.read().decode("utf-8"))


def save_source(data: dict, path: Path) -> None:
    if "error" in data:
        raise RuntimeError(json.dumps(data["error"], ensure_ascii=False))
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
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            distance = abs(r - KEY_COLOR[0]) + abs(g - KEY_COLOR[1]) + abs(b - KEY_COLOR[2])
            if distance < 90:
                pixels[x, y] = (r, g, b, 0)
            elif g > 160 and r < 90 and b < 90:
                pixels[x, y] = (r, g, b, max(0, a - 160))
    bbox = image.getchannel("A").getbbox()
    if bbox:
        pad = 28
        image = image.crop((
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(image.width, bbox[2] + pad),
            min(image.height, bbox[3] + pad),
        ))
    image.save(out)


def main() -> int:
    api_key = os.environ.get("PPTOKEN_API_KEY")
    if not api_key:
        print("PPTOKEN_API_KEY is required")
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = OUT_DIR / "bullet_rocket_src.png"
    out = OUT_DIR / "bullet_rocket.png"
    if out.exists() and out.stat().st_size > 0:
        print("skip bullet_rocket.png")
        return 0

    last_error = ""
    for attempt in range(1, 4):
        try:
            print(f"generate bullet_rocket_src.png attempt {attempt}", flush=True)
            data = request_image(api_key)
            save_source(data, src)
            remove_chroma_key(src, out)
            print("saved bullet_rocket.png")
            return 0
        except urllib.error.HTTPError as exc:
            last_error = f"{exc.code} {exc.read().decode('utf-8', errors='replace')}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(8)
    print(f"failed bullet_rocket.png: {last_error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
