# major total

다른 instructor 카드(major1-exam, major4-exam)와 **똑같은 방식**으로 잠겨 있습니다.

- 저장소에는 `majortotal.enc` (AES-256-GCM 암호문)만 올라갑니다.
- 비밀번호는 어떤 파일에도 적혀 있지 않습니다. 열쇠는 여러분 머릿속에만 있습니다.
- GitHub에서 코드를 다 뒤져도 문제·개념·정답 어느 것도 읽을 수 없습니다.

## 현재 상태

`majortotal.enc` — 2,710,269 bytes (원본 6,739,497 bytes 를 gzip 후 암호화)
문항 1,305 · 개념 96 · 용어 574 · 암기표/계산훈련 전부 포함.

## 자료 바꾸기

원본 파일(예: `major-total.html`)을 준비한 뒤, **이 폴더에서**:

```bash
python3 manage.py update majortotal ~/major-total.html
```

실행하면 비밀번호를 물어봅니다. 화면에 보이지 않고, 명령줄에 쓰지 않으므로
셸 기록에도 남지 않습니다. 끝나면 `majortotal.enc` 와 날짜가 자동으로 갱신됩니다.

처음 준비물이 없다면:

```bash
pip install cryptography
```

## 확인

```bash
python3 manage.py list      # 등록된 자료 목록
python3 manage.py verify    # 비밀번호로 실제로 열리는지 검사
```

## 비밀번호 바꾸기

```bash
python3 manage.py rekey
```

## 주의

- 원본 `.html` 은 커밋하지 마세요. `.gitignore` 가 막아두긴 했습니다.
- 실수로 평문을 한 번이라도 커밋했다면 git 히스토리에 영원히 남습니다.
  그때는 히스토리를 정리하고 비밀번호를 새로 바꿔야 합니다.
