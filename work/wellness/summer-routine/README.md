# Summer Routine

Routine Alarm 전용 페이지입니다. Pilates & Yoga Sequence Studio와 분리되어 있습니다.

- Desktop browser notification
- Android Galaxy Clock one-time alarm intent
- 오늘 요일 + 현재 시각 이후 루틴만 Galaxy 목록에 표시하며, 별도의 적용 기간 조건을 추가하지 않음
- Android Intent에 반복 요일(`EXTRA_DAYS`)을 전달하지 않음
- 루틴 추가·삭제는 미리 채워진 GitHub **Issue 작성 화면**을 통해 요청
- Issue 생성 후 GitHub Actions가 `routines.json`을 자동 commit
- 알림 내용은 선택 입력
