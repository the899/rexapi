#!/usr/bin/env python3
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


API_URL = "https://api.pptoken.cc/v1/images/generations"
MODEL = "gpt-image-2"
SIZE = "1024x1024"
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "generated"


VARIANTS = [
    (
        "player_tank_light_src.png",
        "a blue light scout player tank viewed straight from above, slim agile hull, smaller turret, exposed fast tracks, compact silhouette",
    ),
    (
        "player_tank_heavy_src.png",
        "a blue heavy armor player tank viewed straight from above, thicker chassis, reinforced side armor plates, powerful armored silhouette",
    ),
    (
        "player_tank_assault_src.png",
        "a blue assault cannon player tank viewed straight from above, long heavy main cannon, reinforced turret, firepower-focused silhouette",
    ),
    (
        "player_tank_shield_src.png",
        "a blue energy shield player tank viewed straight from above, integrated cyan shield generator coils on the hull, clean sci-fi armored details",
    ),
    (
        "player_tank_speed_src.png",
        "a blue high-speed player tank viewed straight from above, aerodynamic compact hull, bright cyan track modules, fast maneuver silhouette",
    ),
]


def prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: top-down player tank sprite for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Style: match the existing arcade pixel-art top-down tank assets, crisp readable details, blue player faction color, dark treads, no isometric perspective. "
        "Composition: one single complete tank only, centered with generous padding, cannon pointing straight up, clear directional silhouette. "
        "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal. "
        "No ground plane, no cast shadow, no contact shadow, no text, no watermark, no extra objects. "
        "Do not use #00ff00 anywhere in the subject."
    )


def request_image(api_key: str, text: str) -> dict:
    body = json.dumps({"model": MODEL, "prompt": text, "size": SIZE}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=420) as res:
        return json.loads(res.read().decode("utf-8"))


def save_image(data: dict, path: Path) -> None:
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


def main() -> int:
    api_key = os.environ.get("PPTOKEN_API_KEY")
    if not api_key:
        print("PPTOKEN_API_KEY is required", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for filename, subject in VARIANTS:
        out = OUT_DIR / filename
        if out.exists() and out.stat().st_size > 0:
            print(f"skip {filename}")
            continue
        print(f"generate {filename}", flush=True)
        last_error = ""
        for attempt in range(1, 3):
            try:
                print(f"  try {MODEL} attempt {attempt}", flush=True)
                data = request_image(api_key, prompt(subject))
                save_image(data, out)
                last_error = ""
                break
            except urllib.error.HTTPError as exc:
                last_error = f"{exc.code} {exc.read().decode('utf-8', errors='replace')}"
            except Exception as exc:
                last_error = str(exc)
            time.sleep(8)
        if last_error:
            print(f"failed {filename}: {last_error}", file=sys.stderr)
            failures.append((filename, last_error))
        time.sleep(2)

    if failures:
        print("summary failures:", file=sys.stderr)
        for filename, error in failures:
            print(f"  {filename}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
