# Summer Routine

`my-portal/work/wellness/` 하위의 2026년 여름 루틴 페이지입니다.

## 동작

- `routines.json`의 요일·시간 기반 루틴을 Weekly Timetable로 표시합니다.
- Desktop에서는 브라우저 권한을 받은 뒤 페이지가 실행 중일 때 시스템 알림을 표시합니다.
- Android Galaxy에서는 버튼을 누른 당일의 요일에 해당하며 현재 시각 이후인 루틴만 목록에 표시합니다.
- 각 `Galaxy 시계에 추가` 버튼은 Samsung Clock의 `SET_ALARM` Intent를 호출합니다.
- Android 알람 Intent에는 시각과 이름만 전달하며 반복 요일 값은 전달하지 않습니다.
- 관리자 추가·삭제는 Cloudflare Worker에서 비밀번호를 검증한 후 GitHub의 `routines.json`을 실제 커밋합니다.

## Worker 연결

1. 저장소 루트의 `cloudflare-worker/summer-routine/`으로 이동합니다.
2. `wrangler.toml.example`을 `wrangler.toml`로 복사합니다.
3. 아래 secret을 등록합니다.

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put GITHUB_TOKEN
```

`ADMIN_PASSWORD` 입력값:

```text
220254007
```

4. Worker를 배포합니다.

```bash
npm install
npm run deploy
```

5. 배포 URL을 `config.js`의 `apiUrl`에 입력합니다.

비밀번호와 GitHub token을 HTML, JavaScript 또는 Git 저장소에 직접 기록하지 마십시오.
