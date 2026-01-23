#!/usr/bin/env python3
"""
convert_custom_ansi.py

Updates:
- Supports ESC[49m as "clear background color"
- Strips any stray '[...m' sequences not preceded by ESC
"""

from __future__ import annotations

import argparse
import dataclasses
import re
from pathlib import Path
from typing import List, Optional, Tuple


# Matches *real* SGR sequences
CSI_M_PATTERN = re.compile(r"\x1b\[([0-9;]*)m")

# Matches stray SGR-like text WITHOUT ESC (to be stripped)
STRAY_SGR_PATTERN = re.compile(r"(?<!\x1b)\[[0-9;]*m")


@dataclasses.dataclass
class AnsiState:
    fg: Optional[int] = None  # 0–15
    bg: Optional[int] = None  # 0–15


def _color_to_sgr_param(is_fg: bool, color_0_15: int) -> int:
    bright = color_0_15 >= 8
    base = color_0_15 - 8 if bright else color_0_15
    return (90 + base) if (is_fg and bright) else \
           (30 + base) if is_fg else \
           (100 + base) if bright else \
           (40 + base)


def _parse_params(param_str: str) -> List[int]:
    if param_str == "":
        return [0]
    out = []
    for p in param_str.split(";"):
        if p == "":
            continue
        try:
            out.append(int(p))
        except ValueError:
            return []
    return out


def _consume_custom_triplet(
    params: List[int], i: int
) -> Tuple[Optional[Tuple[str, int]], int]:
    if i + 2 >= len(params):
        return None, i
    head = params[i]
    if head not in (38, 48):
        return None, i
    color = params[i + 2]
    if not (0 <= color <= 15):
        return None, i + 3
    return (("fg" if head == 38 else "bg"), color), i + 3


def convert_text(text: str, ensure_reset: bool = False) -> str:
    # 1. Strip stray "[...m" fragments with no ESC
    text = STRAY_SGR_PATTERN.sub("", text)

    state = AnsiState()
    out: List[str] = []
    pos = 0

    for m in CSI_M_PATTERN.finditer(text):
        start, end = m.span()
        params = _parse_params(m.group(1))

        if start > pos:
            out.append(text[pos:start])

        if not params:
            pos = end
            continue

        desired_fg = state.fg
        desired_bg = state.bg

        i = 0
        while i < len(params):
            p = params[i]

            if p == 0:
                desired_fg = None
                desired_bg = None
                i += 1
                continue

            if p == 49:
                desired_bg = None
                i += 1
                continue

            custom, ni = _consume_custom_triplet(params, i)
            if custom:
                which, color = custom
                if which == "fg":
                    desired_fg = color
                else:
                    desired_bg = color
                i = ni
                continue

            i += 1  # strip unrecognized params

        emit: List[int] = []

        if (desired_fg, desired_bg) != (state.fg, state.bg):
            if desired_fg is None and desired_bg is None:
                emit.append(0)
            else:
                if state.fg is not None and desired_fg is None:
                    emit.append(39)
                if state.bg is not None and desired_bg is None:
                    emit.append(49)
                if desired_fg is not None and desired_fg != state.fg:
                    emit.append(_color_to_sgr_param(True, desired_fg))
                if desired_bg is not None and desired_bg != state.bg:
                    emit.append(_color_to_sgr_param(False, desired_bg))

            if emit:
                out.append("\x1b[" + ";".join(map(str, emit)) + "m")

            state.fg = desired_fg
            state.bg = desired_bg

        pos = end

    if pos < len(text):
        tail = text[pos:]
        if tail.endswith("\x1b"):
            tail = tail[:-1]
        out.append(tail)

    if ensure_reset and (state.fg is not None or state.bg is not None):
        out.append("\x1b[0m")

    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--ensure-reset", action="store_true")
    args = ap.parse_args()

    raw = args.input.read_text(encoding="utf-8", errors="strict")
    converted = convert_text(raw, ensure_reset=args.ensure_reset)
    args.output.write_text(converted, encoding="utf-8", errors="strict")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
