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


GROUND_TILES = [
    (
        "terrain_ground_dirt.png",
        "a seamless square top-down battlefield dirt ground tile, pixel-art arcade style, compact gravel, tire marks, small cracks, muted brown-gray military palette, fills the full image edge to edge, no objects, no shadows, no text",
    ),
    (
        "terrain_ground_grass.png",
        "a seamless square top-down battlefield grass ground tile, pixel-art arcade style, worn short grass with patches of dirt and tank tracks, muted green military palette, fills the full image edge to edge, no objects, no shadows, no text",
    ),
    (
        "terrain_ground_concrete.png",
        "a seamless square top-down battlefield concrete ground tile, pixel-art arcade style, cracked concrete slabs, subtle stains, small grit, muted gray palette, fills the full image edge to edge, no objects, no shadows, no text",
    ),
    (
        "terrain_ground_scorched.png",
        "a seamless square top-down scorched battlefield ground tile, pixel-art arcade style, dark blast marks, ash, broken dirt, small rubble flecks, fills the full image edge to edge, no objects, no shadows, no text",
    ),
]


TERRAIN_SPRITES = [
    (
        "terrain_tree_single_src.png",
        "one top-down battlefield tree sprite, pixel-art arcade style, leafy green crown with visible trunk center, readable obstacle silhouette, centered with padding",
    ),
    (
        "terrain_tree_cluster_src.png",
        "a small cluster of three top-down battlefield trees, pixel-art arcade style, overlapping leafy crowns, compact terrain blocker silhouette, centered with padding",
    ),
    (
        "terrain_rock_cluster_src.png",
        "a cluster of gray battlefield rocks viewed straight from above, pixel-art arcade style, chipped stones, readable low cover obstacle, centered with padding",
    ),
    (
        "terrain_bush_src.png",
        "one low green battlefield bush viewed straight from above, pixel-art arcade style, irregular foliage patch, readable soft cover, centered with padding",
    ),
    (
        "terrain_crater_src.png",
        "one round shell crater viewed straight from above, pixel-art arcade style, dark center, cracked rim, scorched dirt fragments, centered with padding",
    ),
    (
        "terrain_sandbags_src.png",
        "a curved line of tan military sandbags viewed straight from above, pixel-art arcade style, compact defensive terrain, centered with padding",
    ),
]


def ground_prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: seamless top-down ground tile for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Consistent with pixel-art tank game assets. No text, no watermark."
    )


def sprite_prompt(subject: str) -> str:
    return (
        "Use case: stylized-concept. "
        "Asset type: top-down terrain sprite for a web tank survival roguelite. "
        f"Primary request: {subject}. "
        "Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for later removal. "
        "Subject: one terrain object only, crisp silhouette. "
        "No ground plane, no cast shadow, no contact shadow, no text, no watermark, no extra objects. "
        "Do not use #ff00ff anywhere in the subject."
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
    with urllib.request.urlopen(req, timeout=420) as res:
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


def generate(api_key: str, filename: str, prompt: str, failures: list[tuple[str, str]]) -> None:
    path = OUT_DIR / filename
    if path.exists() and path.stat().st_size > 0:
        print(f"skip {filename}")
        return
    print(f"generate {filename}", flush=True)
    last_error = ""
    for attempt in range(1, 3):
        try:
            print(f"  try {MODEL} attempt {attempt}", flush=True)
            data = request_image(api_key, prompt)
            if "error" in data:
                last_error = json.dumps(data["error"], ensure_ascii=False)
                time.sleep(8)
                continue
            save_image(data, path)
            return
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            last_error = f"{exc.code} {detail}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(8)
    print(f"failed {filename}: {last_error}", file=sys.stderr)
    failures.append((filename, last_error))


def main() -> int:
    api_key = os.environ.get("PPTOKEN_API_KEY")
    if not api_key:
        print("PPTOKEN_API_KEY is required", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for filename, subject in GROUND_TILES:
        generate(api_key, filename, ground_prompt(subject), failures)
        time.sleep(2)
    for filename, subject in TERRAIN_SPRITES:
        generate(api_key, filename, sprite_prompt(subject), failures)
        time.sleep(2)

    if failures:
        print("summary failures:", file=sys.stderr)
        for filename, last_error in failures:
            print(f"  {filename}: {last_error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
