#!/usr/bin/env python3
import base64
import json
import os
import shutil
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
        "bullet_fire",
        "an incendiary tank shell bullet, horizontal side view pointing right, orange-red metal body, bright flame tail, compact elongated projectile, readable as a fire bullet sprite",
    ),
    (
        "terrain_fire",
        "a top-down patch of burning ground fire, circular low flame residue, orange core fading into dark red embers, compact readable hazard tile",
    ),
    (
        "mine",
        "a small round land mine viewed straight from above, dark graphite metal casing, raised edge studs, red warning core in the center, compact hazard object",
    ),
    (
        "enemy_mine_layer",
        "an olive drab mine-laying armored vehicle viewed straight from above, compact tank-like body, visible rear mine dispenser, rugged treads, clear forward direction",
    ),
    (
        "enemy_laser_turret",
        "a blue-silver laser turret viewed straight from above, compact fixed turret body, glowing cyan crystal emitter on top, sci-fi cannon housing, clear directional silhouette",
    ),
]


def build_prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: top-down pixel-art sprite for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Style/medium: polished arcade pixel-art game sprite, crisp silhouette, high contrast, readable at small in-game size, matching existing top-down tank sprites. "
        "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal. "
        "Subject: one single object only, centered with generous padding. "
        "No ground plane except for the terrain_fire hazard tile, no cast shadow, no contact shadow, no text, no letters, no watermark, no extra objects. "
        "Do not use #00ff00 anywhere in the subject."
    )


def request_image(api_key: str, prompt: str) -> dict:
    body = json.dumps({"model": MODEL, "prompt": prompt, "size": SIZE}).encode("utf-8")
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
        pad = 36
        image = image.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(image.width, bbox[2] + pad),
                min(image.height, bbox[3] + pad),
            )
        )
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
        backup = OUT_DIR / f"{stem}_placeholder_backup.png"
        if out.exists() and not backup.exists():
            shutil.copy(out, backup)

        last_error = ""
        for attempt in range(1, 4):
            try:
                print(f"generate {src.name} attempt {attempt}", flush=True)
                data = request_image(api_key, build_prompt(subject))
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
