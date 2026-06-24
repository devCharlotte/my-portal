/*
 * GitHub Actions 전용 구성입니다.
 * Cloudflare Worker, npm, Wrangler, GitHub PAT가 필요하지 않습니다.
 */
window.ROUTINE_PAGE_CONFIG = Object.freeze({
  githubActionsUrl: "https://github.com/devcharlotte/my-portal/actions/workflows/manage-summer-routine.yml",
  timezone: "Asia/Seoul",
  activeFrom: "2026-07-01",
  activeUntil: "2026-08-31"
});
