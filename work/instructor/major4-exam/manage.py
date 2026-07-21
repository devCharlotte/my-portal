#!/usr/bin/env python3
"""
자료를 추가·교체·삭제하고, 비밀번호를 바꾸는 도구.
암호화와 index.html 목록 등록을 한 번에 처리합니다.

    python3 manage.py list
    python3 manage.py add    <파일> --title "제목" [--id 아이디]
    python3 manage.py update <아이디> <파일>
    python3 manage.py remove <아이디>
    python3 manage.py verify
    python3 manage.py rekey

비밀번호는 물어보는 창에 입력합니다(화면에 안 보임).
명령줄에 비밀번호를 쓰지 않으므로 쉘 기록에도 남지 않습니다.

예)
    python3 manage.py add ~/2026-중간고사.pdf --title "2026 중간고사"
    python3 manage.py update major1 ~/문제집_최신.html
    python3 manage.py rekey
"""
import argparse
import datetime
import getpass
import gzip
import os
import re
import struct
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "index.html")

MAGIC = b"JHE1"
FLAG_GZIP = 0x01
ITERATIONS = 600_000

MIME = {
    ".html": "text/html", ".htm": "text/html",
    ".pdf": "application/pdf",
    ".txt": "text/plain", ".md": "text/plain",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
}

# ── 암호화 ────────────────────────────────────────────────────────────────

def normalize(password: str) -> str:
    """index.html 의 normalize() 와 반드시 동일하게 유지할 것."""
    return "".join(c for c in password.strip()
                   if not c.isspace() and c not in "-_").upper()


def _key(password: str, salt: bytes, iterations: int) -> bytes:
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                      salt=salt, iterations=iterations).derive(
                          normalize(password).encode("utf-8"))


def encrypt(data: bytes, password: str) -> bytes:
    body = gzip.compress(data, compresslevel=9, mtime=0)
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(_key(password, salt, ITERATIONS)).encrypt(iv, body, None)
    return MAGIC + bytes([FLAG_GZIP]) + struct.pack(">I", ITERATIONS) + salt + iv + ct


def decrypt(blob: bytes, password: str) -> bytes:
    if blob[:4] != MAGIC:
        raise ValueError("JHE1 형식이 아닙니다")
    flags = blob[4]
    iterations = struct.unpack(">I", blob[5:9])[0]
    plain = AESGCM(_key(password, blob[9:25], iterations)).decrypt(
        blob[25:37], blob[37:], None)
    return gzip.decompress(plain) if flags & FLAG_GZIP else plain


# ── index.html 의 DOCS 목록 읽기/쓰기 ─────────────────────────────────────

ENTRY = re.compile(
    r'\{\s*id:\s*"(?P<id>[^"]*)",\s*title:\s*"(?P<title>[^"]*)",\s*'
    r'file:\s*"(?P<file>[^"]*)",\s*type:\s*"(?P<type>[^"]*)"\s*\},?')


def read_docs() -> list:
    src = open(PAGE, encoding="utf-8").read()
    block = re.search(r"/\* DOCS:BEGIN.*?\*/(.*?)/\* DOCS:END \*/", src, re.S)
    if not block:
        sys.exit("[중단] index.html 에서 DOCS:BEGIN/END 마커를 찾지 못했습니다.")
    return [m.groupdict() for m in ENTRY.finditer(block.group(1))]


def write_docs(docs: list) -> None:
    lines = "\n".join(
        f'    {{ id: "{d["id"]}", title: "{d["title"]}", '
        f'file: "{d["file"]}", type: "{d["type"]}" }},' for d in docs)
    body = f"\n  const DOCS = [\n{lines}\n  ];\n  "
    src = open(PAGE, encoding="utf-8").read()
    new = re.sub(r"(/\* DOCS:BEGIN.*?\*/).*?(/\* DOCS:END \*/)",
                 lambda m: m.group(1) + body + m.group(2), src, flags=re.S)
    open(PAGE, "w", encoding="utf-8").write(new)


def ask(prompt="비밀번호: ") -> str:
    pw = getpass.getpass(prompt)
    if not pw.strip():
        sys.exit("[중단] 비밀번호가 비어 있습니다.")
    return pw


def check_password(docs: list, password: str) -> None:
    """기존 자료 하나로 비밀번호가 맞는지 먼저 확인 (오타로 목록이 깨지는 것 방지)."""
    for d in docs:
        p = os.path.join(HERE, d["file"])
        if os.path.exists(p):
            try:
                decrypt(open(p, "rb").read(), password)
                return
            except Exception:
                sys.exit("[중단] 비밀번호가 기존 자료와 맞지 않습니다. "
                         "아무것도 바꾸지 않았습니다.")


def stamp_date() -> None:
    """자료를 바꿀 때마다 'Last updated' 날짜를 오늘로 갱신한다.
    (잠금화면 상단 + 상위 목록의 카드 두 곳)"""
    today = datetime.date.today().strftime("%b ") + str(datetime.date.today().day) \
            + datetime.date.today().strftime(", %Y")
    label = f"Last updated {today}"

    # 1) 이 폴더의 index.html 상단
    s = open(PAGE, encoding="utf-8").read()
    s2 = re.sub(r'(<span class="myworkspace-date">)[^<]*(</span>)',
                lambda m: m.group(1) + label + m.group(2), s, count=1)
    if s2 != s:
        open(PAGE, "w", encoding="utf-8").write(s2)

    # 2) 상위 목록에서 이 폴더를 가리키는 카드
    parent = os.path.join(os.path.dirname(HERE), "index.html")
    folder = os.path.basename(HERE)
    if os.path.exists(parent):
        s = open(parent, encoding="utf-8").read()
        pat = re.compile(r'(href="' + re.escape(folder) + r'/"[\s\S]*?<div class="created">)[^<]*(</div>)')
        s2 = pat.sub(lambda m: m.group(1) + label + m.group(2), s, count=1)
        if s2 != s:
            open(parent, "w", encoding="utf-8").write(s2)
    print(f"     날짜 갱신: {label}")


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "doc"


# ── 명령 ──────────────────────────────────────────────────────────────────

def cmd_list(a):
    docs = read_docs()
    if not docs:
        print("등록된 자료가 없습니다.")
        return
    print(f"{'아이디':<14} {'종류':<18} {'크기':>10}  제목")
    print("─" * 78)
    for d in docs:
        p = os.path.join(HERE, d["file"])
        size = f"{os.path.getsize(p):,}" if os.path.exists(p) else "없음!"
        print(f'{d["id"]:<14} {d["type"]:<18} {size:>10}  {d["title"]}')


def cmd_add(a):
    if not os.path.exists(a.file):
        sys.exit(f"[중단] 파일 없음: {a.file}")
    docs = read_docs()
    doc_id = a.id or slug(a.title)
    if any(d["id"] == doc_id for d in docs):
        sys.exit(f"[중단] 아이디 '{doc_id}' 가 이미 있습니다. "
                 f"교체하려면 update 를 쓰세요.")
    ext = os.path.splitext(a.file)[1].lower()
    mime = a.type or MIME.get(ext, "application/octet-stream")

    pw = ask()
    check_password(docs, pw)          # 기존 자료가 있으면 같은 비번인지 확인

    raw = open(a.file, "rb").read()
    out = f"{doc_id}.enc"
    open(os.path.join(HERE, out), "wb").write(encrypt(raw, pw))
    docs.append({"id": doc_id, "title": a.title, "file": out, "type": mime})
    write_docs(docs)
    print(f"[OK] 추가됨  {doc_id}  ({mime})")
    print(f"     {len(raw):,} bytes → {os.path.getsize(os.path.join(HERE, out)):,} bytes")
    print(f"     index.html 목록에 등록 완료. 커밋하면 바로 보입니다.")
    stamp_date()


def cmd_update(a):
    if not os.path.exists(a.file):
        sys.exit(f"[중단] 파일 없음: {a.file}")
    docs = read_docs()
    target = next((d for d in docs if d["id"] == a.id), None)
    if not target:
        sys.exit(f"[중단] 아이디 '{a.id}' 를 찾을 수 없습니다. list 로 확인하세요.")

    pw = ask()
    check_password(docs, pw)

    raw = open(a.file, "rb").read()
    path = os.path.join(HERE, target["file"])
    old_size = os.path.getsize(path) if os.path.exists(path) else 0
    open(path, "wb").write(encrypt(raw, pw))

    ext = os.path.splitext(a.file)[1].lower()
    target["type"] = a.type or MIME.get(ext, target["type"])
    if a.title:
        target["title"] = a.title
    write_docs(docs)
    print(f"[OK] 교체됨  {a.id}  ({target['type']})")
    print(f"     {old_size:,} → {os.path.getsize(path):,} bytes")
    stamp_date()


def cmd_remove(a):
    docs = read_docs()
    target = next((d for d in docs if d["id"] == a.id), None)
    if not target:
        sys.exit(f"[중단] 아이디 '{a.id}' 없음")
    path = os.path.join(HERE, target["file"])
    if os.path.exists(path):
        os.remove(path)
    write_docs([d for d in docs if d["id"] != a.id])
    print(f"[OK] 삭제됨  {a.id}  ({target['file']})")
    stamp_date()
    print("     주의: 이미 커밋한 적이 있다면 git 히스토리에는 남아 있습니다.")


def cmd_verify(a):
    docs = read_docs()
    if not docs:
        print("등록된 자료가 없습니다.")
        return
    pw = ask()
    bad = 0
    for d in docs:
        path = os.path.join(HERE, d["file"])
        if not os.path.exists(path):
            print(f"  ❌ {d['id']:<14} 파일 없음: {d['file']}"); bad += 1; continue
        try:
            n = len(decrypt(open(path, "rb").read(), pw))
            print(f"  ✅ {d['id']:<14} {n:>12,} bytes  {d['title']}")
        except Exception:
            print(f"  ❌ {d['id']:<14} 이 비밀번호로 열리지 않음"); bad += 1
    print("\n모두 정상입니다." if not bad else f"\n{bad}개에 문제가 있습니다.")
    sys.exit(1 if bad else 0)


def cmd_rekey(a):
    docs = read_docs()
    if not docs:
        sys.exit("등록된 자료가 없습니다.")
    old = ask("기존 비밀번호: ")
    new = ask("새 비밀번호: ")
    if normalize(new) != normalize(ask("새 비밀번호 확인: ")):
        sys.exit("[중단] 새 비밀번호가 서로 다릅니다.")
    if len(normalize(new)) < 12:
        print("[경고] 비밀번호가 12자 미만입니다.", file=sys.stderr)

    # 먼저 전부 열리는지 확인한 뒤에만 덮어쓴다
    plains = {}
    for d in docs:
        path = os.path.join(HERE, d["file"])
        if not os.path.exists(path):
            sys.exit(f"[중단] 파일 없음: {d['file']}")
        try:
            plains[d["id"]] = decrypt(open(path, "rb").read(), old)
        except Exception:
            sys.exit(f"[중단] 기존 비밀번호로 {d['file']} 를 열 수 없습니다. "
                     f"아무것도 바꾸지 않았습니다.")

    for d in docs:
        open(os.path.join(HERE, d["file"]), "wb").write(encrypt(plains[d["id"]], new))
        print(f"  ✅ {d['id']:<14} 재암호화 완료")
    print(f"\n{len(docs)}개 자료의 비밀번호를 바꿨습니다.")


def main():
    p = argparse.ArgumentParser(
        description="암호화 자료 관리 (추가·교체·삭제·검증·비밀번호 변경)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="등록된 자료 보기").set_defaults(fn=cmd_list)

    s = sub.add_parser("add", help="새 자료 추가")
    s.add_argument("file"); s.add_argument("--title", required=True)
    s.add_argument("--id"); s.add_argument("--type")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("update", help="기존 자료를 새 파일로 교체")
    s.add_argument("id"); s.add_argument("file")
    s.add_argument("--title"); s.add_argument("--type")
    s.set_defaults(fn=cmd_update)

    s = sub.add_parser("remove", help="자료 삭제")
    s.add_argument("id"); s.set_defaults(fn=cmd_remove)

    sub.add_parser("verify", help="모든 자료가 열리는지 확인").set_defaults(fn=cmd_verify)
    sub.add_parser("rekey", help="전체 비밀번호 변경").set_defaults(fn=cmd_rekey)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
