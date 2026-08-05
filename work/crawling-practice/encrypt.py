#!/usr/bin/env python3
"""
HTML(또는 임의 파일)을 비밀번호로 암호화하여 .enc 파일을 만듭니다.
브라우저(index.html)의 Web Crypto API와 100% 호환되는 형식입니다.

파일 형식 (JHE1)
    offset  size   내용
    0       4      매직 "JHE1"
    4       1      flags   (bit0 = 1 이면 본문이 gzip 압축됨)
    5       4      iterations (uint32, big-endian)  ← 파일에 같이 저장하므로
                                                      나중에 값을 올려도 안 깨짐
    9       16     salt
    25      12     iv (nonce)
    37      ...    ciphertext || 16-byte GCM tag

KDF : PBKDF2-HMAC-SHA256 (기본 600,000회 — OWASP 권장치)
AEAD: AES-256-GCM

사용법
    python3 encrypt.py <입력파일> <비밀번호> [출력파일] [--iters N] [--no-gzip]
예
    python3 encrypt.py exam.html "K7QM4XR9TWDH2NBF3VYC" bank.enc
"""
import argparse
import gzip
import os
import struct
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

MAGIC = b"JHE1"
DEFAULT_ITERATIONS = 600_000
FLAG_GZIP = 0x01


def normalize(password: str) -> str:
    """
    index.html 의 normalize() 와 반드시 동일하게 유지할 것.
    - 앞뒤 공백 제거
    - 모든 공백/하이픈/언더스코어 제거  (K7QM-4XR9 처럼 끊어 적어도 통과)
    - 대문자로 통일            (대소문자 구분 안 함)
    """
    out = []
    for ch in password.strip():
        if ch.isspace() or ch in "-_":
            continue
        out.append(ch)
    return "".join(out).upper()


def encrypt(in_path: str, password: str, out_path: str,
            iterations: int = DEFAULT_ITERATIONS, use_gzip: bool = True) -> None:
    with open(in_path, "rb") as f:
        plaintext = f.read()
    original_size = len(plaintext)

    flags = 0
    if use_gzip:
        # mtime=0 으로 고정 → 같은 입력이면 항상 같은 압축 결과 (재현 가능)
        plaintext = gzip.compress(plaintext, compresslevel=9, mtime=0)
        flags |= FLAG_GZIP

    salt = os.urandom(16)
    iv = os.urandom(12)

    key = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,                      # AES-256
        salt=salt,
        iterations=iterations,
    ).derive(normalize(password).encode("utf-8"))

    # AES-GCM 출력 = ciphertext || 16-byte tag (Web Crypto와 동일한 순서)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)

    header = MAGIC + bytes([flags]) + struct.pack(">I", iterations)
    with open(out_path, "wb") as f:
        f.write(header + salt + iv + ciphertext)

    total = len(header) + len(salt) + len(iv) + len(ciphertext)
    print(f"[OK] 암호화 완료 -> {out_path}")
    print(f"     원본        {original_size:,} bytes")
    print(f"     gzip 압축   {'예' if use_gzip else '아니오'}"
          f"{f' ({len(plaintext):,} bytes)' if use_gzip else ''}")
    print(f"     PBKDF2      {iterations:,} 회")
    print(f"     출력        {total:,} bytes")


def main() -> None:
    p = argparse.ArgumentParser(description="파일을 AES-256-GCM으로 암호화합니다.")
    p.add_argument("input", help="암호화할 파일 (예: exam.html)")
    p.add_argument("password", help="비밀번호")
    p.add_argument("output", nargs="?", default=None, help="출력 파일 (기본: <입력>.enc)")
    p.add_argument("--iters", type=int, default=DEFAULT_ITERATIONS,
                   help=f"PBKDF2 반복 횟수 (기본 {DEFAULT_ITERATIONS:,})")
    p.add_argument("--no-gzip", action="store_true", help="gzip 압축을 건너뜁니다")
    a = p.parse_args()

    out = a.output or (os.path.splitext(a.input)[0] + ".enc")
    if len(normalize(a.password)) < 12:
        print("[경고] 비밀번호가 12자 미만입니다. 오프라인 무차별 대입에 취약할 수 있습니다.",
              file=sys.stderr)
    encrypt(a.input, a.password, out, a.iters, not a.no_gzip)


if __name__ == "__main__":
    main()
