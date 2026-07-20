#!/usr/bin/env python3
"""
이미 암호화된 코스웍 .enc 의 비밀번호(및 PBKDF2 반복횟수)를 교체합니다.
원본 PDF 없이 기존 비밀번호만 알면 됩니다.

형식은 그대로 유지:  salt(16) || iv(12) || ciphertext+tag

  · 기존 비밀번호 : 예전 페이지 방식대로 '입력 그대로' 사용
  · 새 비밀번호   : normalize() 적용 (공백/하이픈 제거 + 대문자)
                    → 새 index.html 의 normalize() 와 짝을 이룸

사용법
    python3 rekey.py <기존비번> <새비번> <파일...> [--old-iters N] [--new-iters N]

예 (computer-graphics 안에서)
    python3 ../rekey.py '옛날비번' '새비번' voca.enc codetalker.enc

⚠️ 반복횟수를 바꾸면 해당 폴더의 index.html · encrypt.py 도 같은 값으로
   반드시 함께 교체해야 합니다. 아니면 페이지가 열리지 않습니다.
"""
import argparse
import os
import shutil
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

OLD_ITERATIONS = 250_000
NEW_ITERATIONS = 600_000


def normalize(password: str) -> str:
    """index.html 의 normalize() 와 반드시 동일하게 유지할 것."""
    return "".join(c for c in password.strip()
                   if not c.isspace() and c not in "-_").upper()


def derive(password: str, salt: bytes, iterations: int) -> bytes:
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                      salt=salt, iterations=iterations).derive(password.encode("utf-8"))


def decrypt(blob: bytes, password: str, iterations: int) -> bytes:
    """
    기존 비밀번호로 복호화.
    normalize() 적용본과 입력 그대로 둘 다 시도한다.
      · 정규화본  = 지금 페이지들이 쓰는 방식
      · 원본 그대로 = normalize() 도입 이전의 옛 페이지 방식
    덕분에 옛 파일이든 이미 한 번 교체한 파일이든 그대로 열린다.
    """
    last = None
    for candidate in (normalize(password), password):
        try:
            return AESGCM(derive(candidate, blob[:16], iterations)).decrypt(
                blob[16:28], blob[28:], None)
        except Exception as e:
            last = e
    raise last


def main() -> None:
    p = argparse.ArgumentParser(description="코스웍 .enc 비밀번호 교체")
    p.add_argument("old_password")
    p.add_argument("new_password")
    p.add_argument("files", nargs="+")
    p.add_argument("--old-iters", type=int, default=OLD_ITERATIONS)
    p.add_argument("--new-iters", type=int, default=NEW_ITERATIONS)
    a = p.parse_args()

    new_pw = normalize(a.new_password)
    if len(new_pw) < 16:
        print(f"[경고] 새 비밀번호가 {len(new_pw)}자입니다. "
              f"오프라인 대입 공격에 견디려면 20자 이상을 권합니다.", file=sys.stderr)

    # 1단계: 전부 열리는지 먼저 확인 (일부만 바뀌는 사고 방지)
    plains = {}
    for f in a.files:
        if not os.path.exists(f):
            sys.exit(f"[중단] 파일 없음: {f}")
        try:
            plains[f] = decrypt(open(f, "rb").read(), a.old_password, a.old_iters)
        except Exception:
            sys.exit(f"[중단] 기존 비밀번호로 {f} 를 열 수 없습니다.\n"
                     f"        아무 파일도 건드리지 않았습니다.")
    print(f"기존 비밀번호 확인 완료 ({len(a.files)}개). "
          f"PBKDF2 {a.old_iters:,} → {a.new_iters:,} 회로 재암호화합니다.")

    # 2단계: 새 salt/iv 로 재암호화 (salt·iv 재사용 금지)
    for f in a.files:
        salt, iv = os.urandom(16), os.urandom(12)
        ct = AESGCM(derive(new_pw, salt, a.new_iters)).encrypt(iv, plains[f], None)
        shutil.copy2(f, f + ".bak")
        with open(f, "wb") as fh:
            fh.write(salt + iv + ct)
        print(f"  ✅ {f}  ({len(plains[f]):,} bytes)  백업: {f}.bak")

    print("\n끝났습니다. 이제 같은 폴더의 index.html · encrypt.py 를 새 버전으로 바꾸고,")
    print("페이지에서 새 비밀번호로 열리는지 확인한 뒤 .bak 을 지우세요.")


if __name__ == "__main__":
    main()
