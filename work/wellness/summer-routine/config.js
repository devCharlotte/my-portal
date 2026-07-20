/*
 * GitHub Issue + Actions 전용 구성입니다.
 * 페이지의 입력값은 새 Issue 화면에 자동으로 채워지고,
 * 저장소 소유자가 Issue를 제출하면 Actions가 routines.json을 커밋합니다.
 */
window.ROUTINE_PAGE_CONFIG = Object.freeze({
  githubNewIssueUrl: "https://github.com/devcharlotte/my-portal/issues/new",
  timezone: "Asia/Seoul",
  activeFrom: "2026-07-01",
  activeUntil: "2026-08-31"
});
