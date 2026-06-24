/*
 * Cloudflare Worker를 배포한 뒤 apiUrl만 실제 주소로 변경합니다.
 * 관리자 비밀번호와 GitHub token은 이 파일에 넣지 않습니다.
 */
window.ROUTINE_PAGE_CONFIG = Object.freeze({
  apiUrl: "https://REPLACE-WITH-YOUR-WORKER.workers.dev",
  timezone: "Asia/Seoul",
  activeFrom: "2026-07-01",
  activeUntil: "2026-08-31"
});
