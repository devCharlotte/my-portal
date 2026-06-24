# Summer Routine Cloudflare Worker

이 Worker는 관리자 비밀번호를 서버에서 검증한 뒤 GitHub Contents API로
`work/wellness/summer-routine/routines.json`을 읽고 커밋합니다.

## 1. 설정

```bash
cd cloudflare-worker/summer-routine
cp wrangler.toml.example wrangler.toml
npm install
```

`wrangler.toml`의 `ALLOWED_ORIGIN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`를
실제 저장소 값에 맞춥니다.

## 2. Secret 등록

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put GITHUB_TOKEN
```

관리자 비밀번호는 `220254007`입니다. GitHub token에는 대상 저장소 Contents read/write 권한이 필요합니다.

## 3. 배포

```bash
npm run deploy
```

배포 후 출력된 URL을 다음 파일에 입력합니다.

```text
work/wellness/summer-routine/config.js
```
