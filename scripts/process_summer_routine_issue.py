#!/usr/bin/env python3
"""Parse a trusted GitHub Issue request and update routines.json."""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from argparse import Namespace
from datetime import datetime, timezone
from pathlib import Path

import manage_summer_routine as manager

MARKER_RE = re.compile(
    r"<!--\s*SUMMER_ROUTINE_REQUEST_BASE64\s+([A-Za-z0-9_-]+)\s*-->",
)


def fail(message: str) -> "NoReturn":
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_event(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as handle:
            event = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"GitHub event JSON을 읽지 못했습니다: {exc}")
    if not isinstance(event, dict):
        fail("GitHub event 구조가 올바르지 않습니다.")
    return event


def parse_request(event: dict) -> dict:
    issue = event.get("issue") or {}
    repository = event.get("repository") or {}
    owner = ((repository.get("owner") or {}).get("login") or "").strip()
    author = ((issue.get("user") or {}).get("login") or "").strip()
    title = str(issue.get("title") or "")
    body = str(issue.get("body") or "")

    if not owner or author != owner:
        fail("저장소 소유자가 생성한 Issue만 처리할 수 있습니다.")
    if not title.startswith("[Summer Routine]"):
        fail("Summer Routine 자동 요청 제목이 아닙니다.")

    match = MARKER_RE.search(body)
    if not match:
        fail("Issue 본문에서 Summer Routine 자동 요청 데이터를 찾지 못했습니다.")
    encoded = match.group(1)
    encoded += "=" * (-len(encoded) % 4)
    try:
        decoded = base64.urlsafe_b64decode(encoded.encode("ascii")).decode("utf-8")
        request = json.loads(decoded)
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"자동 요청 데이터가 올바르지 않습니다: {exc}")
    if not isinstance(request, dict) or request.get("version") != 1:
        fail("지원하지 않는 자동 요청 버전입니다.")
    return request


def apply_request(request: dict) -> str:
    operation = str(request.get("operation") or "").strip().lower()
    if operation not in {"add", "delete"}:
        fail("operation은 add 또는 delete여야 합니다.")

    args = Namespace(
        operation=operation,
        title=str(request.get("title") or ""),
        time=str(request.get("time") or ""),
        message=str(request.get("message") or ""),
        days=",".join(str(day) for day in request.get("days", []))
        if isinstance(request.get("days"), list)
        else str(request.get("days") or ""),
        routine_id=str(request.get("routineId") or request.get("routine_id") or ""),
    )

    data = manager.load_data()
    commit_message = manager.add_item(data, args) if operation == "add" else manager.delete_item(data, args)
    data["schemaVersion"] = 1
    data["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    with manager.ROUTINES_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return commit_message


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", type=Path, required=True)
    args = parser.parse_args()
    request = parse_request(load_event(args.event))
    commit_message = apply_request(request)
    print(f"COMMIT_MESSAGE={commit_message}")


if __name__ == "__main__":
    main()
