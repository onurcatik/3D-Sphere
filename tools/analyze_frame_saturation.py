#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image

NEAR_WHITE_CHANNEL = 248
HIGH_LUMA_AVERAGE = 245.0
NEAR_WHITE_WARNING = 0.08
HIGH_LUMA_WARNING = 0.12


def analyze(path: Path) -> dict:
    image = Image.open(path).convert("RGB")
    pixels = list(image.getdata())
    total = max(1, len(pixels))
    near_white = 0
    high_luma = 0
    for red, green, blue in pixels:
        if red >= NEAR_WHITE_CHANNEL and green >= NEAR_WHITE_CHANNEL and blue >= NEAR_WHITE_CHANNEL:
            near_white += 1
        if (red + green + blue) / 3.0 >= HIGH_LUMA_AVERAGE:
            high_luma += 1
    near_ratio = near_white / total
    luma_ratio = high_luma / total
    return {
        "file": str(path),
        "width": image.width,
        "height": image.height,
        "nearWhiteRatio": near_ratio,
        "highLumaRatio": luma_ratio,
        "warning": near_ratio > NEAR_WHITE_WARNING or luma_ratio > HIGH_LUMA_WARNING,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    files = sorted(args.input.glob("*.png")) if args.input.is_dir() else [args.input]
    rows = [analyze(path) for path in files if path.exists()]
    report = {
        "metric": {
            "nearWhiteChannelMinimum": NEAR_WHITE_CHANNEL,
            "highLumaAverageMinimum": HIGH_LUMA_AVERAGE,
            "nearWhiteWarningRatio": NEAR_WHITE_WARNING,
            "highLumaWarningRatio": HIGH_LUMA_WARNING,
            "purpose": "QA warning only; not an aesthetic pass/fail metric"
        },
        "frames": rows,
        "maxNearWhiteRatio": max((row["nearWhiteRatio"] for row in rows), default=0),
        "maxHighLumaRatio": max((row["highLumaRatio"] for row in rows), default=0),
        "warnings": sum(1 for row in rows if row["warning"]),
    }
    payload = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload)
    print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
