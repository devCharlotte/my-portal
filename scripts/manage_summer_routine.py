#!/usr/bin/env python3
"""Safely add or delete Summer Routine entries in routines.json."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROUTINES_PATH = Path("work/wellness/summer-routine/routines.json")
VALID_DAY_MAP = {
    "0": 0, "SUN": 0, "SUNDAY": 0, "일": 0, "일요일": 0,
    "1": 1, "MON": 1, "MONDAY": 1, "월": 1, "월요일": 1,
    "2": 2, "TUE": 2, "TUESDAY": 2, "화": 2, "화요일": 2,
    "3": 3, "WED": 3, "WEDNESDAY": 3, "수": 3, "수요일": 3,
    "4": 4, "THU": 4, "THURSDAY": 4, "목": 4, "목요일": 4,
    "5": 5, "FRI": 5, "FRIDAY": 5, "금": 5, "금요일": 5,
    "6": 6, "SAT": 6, "SATURDAY": 6, "토": 6, "토요일": 6,
}


def fail(message: str) -> "NoReturn":
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_data() -> dict:
    if not ROUTINES_PATH.is_file():
        fail(f"파일을 찾을 수 없습니다: {ROUTINES_PATH}")
    with ROUTINES_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        fail("routines.json 구조가 올바르지 않습니다.")
    return data


def parse_days(raw: str) -> list[int]:
    tokens = [token.strip() for token in re.split(r"[,/\s]+", raw) if token.strip()]
    if not tokens:
        fail("추가 작업에는 요일이 필요합니다. 예: MON,WED,FRI 또는 월,수,금")
    days: list[int] = []
    for token in tokens:
        key = token.upper() if token.isascii() else token
        if key not in VALID_DAY_MAP:
            fail(f"지원하지 않는 요일 값입니다: {token}")
        value = VALID_DAY_MAP[key]
        if value not in days:
            days.append(value)
    return sorted(days)


def validate_time(value: str) -> str:
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
        fail("시간은 HH:MM 형식이어야 합니다. 예: 07:30")
    return value


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    return slug[:32] or "routine"


def add_item(data: dict, args: argparse.Namespace) -> str:
    title = args.title.strip()
    message = args.message.strip()
    if not title:
        fail("추가 작업에는 루틴 이름이 필요합니다.")
    if len(title) > 80:
        fail("루틴 이름은 80자 이하여야 합니다.")
    if len(message) > 240:
        fail("알림 내용은 240자 이하여야 합니다.")

    time_value = validate_time(args.time.strip())
    days = parse_days(args.days)
    now = datetime.now(timezone.utc)
    routine_id = f"{slugify(title)}-{now.strftime('%Y%m%d%H%M%S')}"

    item = {
        "id": routine_id,
        "title": title,
        "message": message,
        "time": time_value,
        "days": days,
        "enabled": True,
        "createdAt": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    data["items"].append(item)
    data["items"].sort(key=lambda entry: (entry.get("time", "99:99"), entry.get("title", "")))
    return f"Add Summer Routine: {title}"


def delete_item(data: dict, args: argparse.Namespace) -> str:
    key = (args.routine_id or args.title).strip()
    if not key:
        fail("삭제 작업에는 routine_id 또는 정확한 루틴 이름이 필요합니다.")

    items = data["items"]
    id_matches = [entry for entry in items if str(entry.get("id", "")) == key]
    title_matches = [entry for entry in items if str(entry.get("title", "")) == key]
    matches = id_matches or title_matches

    if not matches:
        available = "\n".join(
            f"- {entry.get('id', '?')} | {entry.get('title', '?')} | {entry.get('time', '?')}"
            for entry in items
        ) or "- 등록된 루틴 없음"
        fail(f"삭제 대상을 찾지 못했습니다: {key}\n현재 루틴:\n{available}")
    if len(matches) > 1:
        match_ids = ", ".join(str(entry.get("id")) for entry in matches)
        fail(f"같은 이름의 루틴이 여러 개입니다. routine_id를 입력하세요: {match_ids}")

    target = matches[0]
    data["items"] = [entry for entry in items if entry is not target]
    return f"Delete Summer Routine: {target.get('title', key)}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--operation", required=True, choices=("add", "delete"))
    parser.add_argument("--title", default="")
    parser.add_argument("--time", default="")
    parser.add_argument("--message", default="")
    parser.add_argument("--days", default="")
    parser.add_argument("--routine-id", default="")
    args = parser.parse_args()

    data = load_data()
    if args.operation == "add":
        commit_message = add_item(data, args)
    else:
        commit_message = delete_item(data, args)

    data["schemaVersion"] = 1
    data["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    with ROUTINES_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"COMMIT_MESSAGE={commit_message}")
    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
