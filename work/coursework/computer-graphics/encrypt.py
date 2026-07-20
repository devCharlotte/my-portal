#!/usr/bin/env python3
"""
PDF를 비밀번호로 암호화하여 paper.enc 파일을 생성합니다.
브라우저(index.html)의 Web Crypto API와 호환되는 형식으로 출력합니다.

형식:  salt(16 bytes) || iv(12 bytes) || ciphertext+tag
KDF :  PBKDF2-HMAC-SHA256, 250,000 iterations
AEAD:  AES-256-GCM

사용법:
    python3 encrypt.py <입력 PDF 경로> <비밀번호> [출력 경로]
예:
    python3 encrypt.py cg-codetalker-pdf.pdf "나의비밀번호" paper.enc
"""
import os
import sys
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 600_000  # index.html과 반드시 동일해야 함


def normalize(password: str) -> str:
    """index.html 의 normalize() 와 반드시 동일하게 유지할 것."""
    return "".join(c for c in password.strip()
                   if not c.isspace() and c not in "-_").upper()


def encrypt(pdf_path: str, password: str, out_path: str = "paper.enc") -> None:
    with open(pdf_path, "rb") as f:
        plaintext = f.read()

    salt = os.urandom(16)
    iv = os.urandom(12)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,            # AES-256
        salt=salt,
        iterations=ITERATIONS,
    )
    key = kdf.derive(normalize(password).encode("utf-8"))

    aesgcm = AESGCM(key)
    # AES-GCM 출력 = ciphertext || 16-byte tag  (Web Crypto와 동일한 순서)
    ciphertext = aesgcm.encrypt(iv, plaintext, None)

    with open(out_path, "wb") as f:
        f.write(salt + iv + ciphertext)

    print(f"[OK] 암호화 완료 -> {out_path}")
    print(f"     원본 {len(plaintext):,} bytes / 출력 {16 + 12 + len(ciphertext):,} bytes")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python3 encrypt.py <입력 PDF> <비밀번호> [출력 경로]")
        sys.exit(1)
    pdf = sys.argv[1]
    pw = sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else "paper.enc"
    encrypt(pdf, pw, out)
