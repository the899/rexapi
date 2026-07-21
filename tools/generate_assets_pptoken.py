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
MODELS = ["gpt-image-2"]
SIZE = "1024x1024"
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "generated"


ASSETS = [
    (
        "enemy_elite_src.png",
        "a gold and black elite heavy tank viewed straight from above, compact but imposing, pixel-art arcade style, thick armor plates, double cannon detail, commander hatch, clear directional silhouette",
    ),
    (
        "wall_block_src.png",
        "a square reinforced concrete wall block viewed straight from above, pixel-art arcade style, gray concrete, dark metal braces, chipped edges, readable as an indestructible wall tile",
    ),
    (
        "crate_src.png",
        "a wooden supply crate viewed straight from above, pixel-art arcade style, X-braced planks, metal corner caps, visibly destructible but sturdy",
    ),
    (
        "bullet_basic_src.png",
        "a small elongated brass tank shell bullet, side-facing horizontally to the right, pixel-art arcade style, pointed tip, subtle orange muzzle glow at the rear, clearly not circular",
    ),
    (
        "bullet_pierce_src.png",
        "a slim steel armor-piercing tank projectile, side-facing horizontally to the right, pixel-art arcade style, pointed silver tip, blue-white speed streaks, clearly not circular",
    ),
    (
        "bullet_burst_src.png",
        "a red-orange explosive tank shell, horizontal side view pointing right, pixel-art sprite, elongated body, fiery rear glow, not circular",
    ),
    (
        "bullet_emp_src.png",
        "one cyan electric energy bullet, horizontal side view pointing right, pixel-art sprite, elongated capsule, no text",
    ),
    (
        "hit_explosion_src.png",
        "a compact arcade tank shell impact explosion sprite, viewed from above, pixel-art style, orange yellow blast core with dark smoke fragments, centered",
    ),
]


def build_prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: top-down game sprite for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal. "
        "Subject: one single object only, centered with generous padding, crisp silhouette. "
        "No ground plane, no cast shadow, no contact shadow, no text, no watermark, no extra objects. "
        "Do not use #00ff00 anywhere in the subject."
    )


def request_image(api_key: str, model: str, prompt: str) -> dict:
    body = json.dumps({"model": model, "prompt": prompt, "size": SIZE}).encode("utf-8")
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


def save_image(data: dict, path: Path) -> None:
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
    for filename, subject in ASSETS:
        path = OUT_DIR / filename
        if path.exists() and path.stat().st_size > 0:
            print(f"skip {filename}")
            continue
        print(f"generate {filename}", flush=True)
        saved = False
        last_error = ""
        for model in MODELS:
            for attempt in range(1, 3):
                try:
                    print(f"  try {model} attempt {attempt}", flush=True)
                    data = request_image(api_key, model, build_prompt(subject))
                    if "error" in data:
                        last_error = json.dumps(data["error"], ensure_ascii=False)
                        time.sleep(8)
                        continue
                    save_image(data, path)
                    saved = True
                    break
                except urllib.error.HTTPError as exc:
                    detail = exc.read().decode("utf-8", errors="replace")
                    last_error = f"{exc.code} {detail}"
                except Exception as exc:
                    last_error = str(exc)
                time.sleep(8)
            if saved:
                break
        if not saved:
            print(f"failed {filename}: {last_error}", file=sys.stderr)
            failures.append((filename, last_error))
            continue
        time.sleep(2)

    if failures:
        print("summary failures:", file=sys.stderr)
        for filename, last_error in failures:
            print(f"  {filename}: {last_error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
