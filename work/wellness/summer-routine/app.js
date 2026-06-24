"use strict";

(() => {
  const CONFIG = window.ROUTINE_PAGE_CONFIG || {};
  const TIMEZONE = CONFIG.timezone || "Asia/Seoul";
  const ACTIVE_FROM = CONFIG.activeFrom || "2026-07-01";
  const ACTIVE_UNTIL = CONFIG.activeUntil || "2026-08-31";
  const NEW_ISSUE_URL = String(CONFIG.githubNewIssueUrl || "https://github.com/devcharlotte/my-portal/issues/new");
  const PENDING_REQUEST_KEY = "summer-routine-pending-github-request";
  const SAMSUNG_CLOCK_PACKAGE = "com.sec.android.app.clockpackage";
  const DESKTOP_ENABLED_KEY = "summer-routine-desktop-notification-enabled";
  const FIRED_KEY_PREFIX = "summer-routine-fired:";
  const DISPLAY_DAYS = [
    { value: 1, ko: "월", en: "MON" },
    { value: 2, ko: "화", en: "TUE" },
    { value: 3, ko: "수", en: "WED" },
    { value: 4, ko: "목", en: "THU" },
    { value: 5, ko: "금", en: "FRI" },
    { value: 6, ko: "토", en: "SAT" },
    { value: 0, ko: "일", en: "SUN" }
  ];
  const WEEKDAY_MAP = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

  const state = {
    data: null,
    serviceWorkerRegistration: null,
    audioContext: null,
    checking: false,
    lastRenderedMinute: "",
    pendingRefreshTimer: null
  };

  const els = {
    portalClock: document.getElementById("portalClock"),
    nextRoutineValue: document.getElementById("nextRoutineValue"),
    nextRoutineMeta: document.getElementById("nextRoutineMeta"),
    dataStatus: document.getElementById("dataStatus"),
    timetableArea: document.getElementById("timetableArea"),
    listMessage: document.getElementById("listMessage"),
    refreshBtn: document.getElementById("refreshBtn"),
    desktopNotificationBtn: document.getElementById("desktopNotificationBtn"),
    androidAlarmBtn: document.getElementById("androidAlarmBtn"),
    desktopControlBtn: document.getElementById("desktopControlBtn"),
    androidControlBtn: document.getElementById("androidControlBtn"),
    testNotificationBtn: document.getElementById("testNotificationBtn"),
    turnOffDesktopBtn: document.getElementById("turnOffDesktopBtn"),
    desktopNotificationStatus: document.getElementById("desktopNotificationStatus"),
    androidAlarmStatus: document.getElementById("androidAlarmStatus"),
    routineForm: document.getElementById("routineForm"),
    routineTitle: document.getElementById("routineTitle"),
    routineTime: document.getElementById("routineTime"),
    routineMessage: document.getElementById("routineMessage"),
    saveRoutineBtn: document.getElementById("saveRoutineBtn"),
    adminMessage: document.getElementById("adminMessage"),
    androidAlarmDialog: document.getElementById("androidAlarmDialog"),
    androidAlarmSummary: document.getElementById("androidAlarmSummary"),
    androidAlarmList: document.getElementById("androidAlarmList"),
    closeAndroidAlarmBtn: document.getElementById("closeAndroidAlarmBtn"),
  };

  function buildIssueRequestUrl(request) {
    const operationLabel = request.operation === "add" ? "ADD" : "DELETE";
    const subject = request.operation === "add"
      ? `${request.time} · ${request.title}`
      : request.title;
    const visibleLines = request.operation === "add"
      ? [
          "Summer Routine 페이지에서 자동 전달된 루틴 추가 요청입니다.",
          "",
          `- 작업: 추가`,
          `- 루틴: ${request.title}`,
          `- 시간: ${request.time}`,
          `- 요일: ${request.days.join(",")}`,
          `- 알림 내용: ${request.message || "(비워 둠)"}`,
          "",
          "아래 자동 요청 데이터는 수정하지 마세요."
        ]
      : [
          "Summer Routine 페이지에서 자동 전달된 루틴 삭제 요청입니다.",
          "",
          `- 작업: 삭제`,
          `- 루틴: ${request.title}`,
          `- Routine ID: ${request.routineId}`,
          "",
          "아래 자동 요청 데이터는 수정하지 마세요."
        ];
    const payload = request.operation === "add"
      ? {
          version: 1,
          operation: "add",
          title: request.title,
          time: request.time,
          message: request.message,
          days: request.days
        }
      : {
          version: 1,
          operation: "delete",
          title: request.title,
          routineId: request.routineId
        };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    let payloadBinary = "";
    payloadBytes.forEach((byte) => { payloadBinary += String.fromCharCode(byte); });
    const payloadBase64 = btoa(payloadBinary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const body = [
      ...visibleLines,
      "",
      `<!-- SUMMER_ROUTINE_REQUEST_BASE64 ${payloadBase64} -->`
    ].join("\n");
    const params = new URLSearchParams({
      title: `[Summer Routine] ${operationLabel} · ${subject}`,
      body
    });
    return `${NEW_ISSUE_URL}?${params.toString()}`;
  }

  function rememberPendingRequest(operation) {
    try {
      localStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify({
        operation,
        baselineUpdatedAt: state.data?.updatedAt || "",
        createdAt: Date.now()
      }));
    } catch {
      // Storage access can be blocked; the request itself still works.
    }
  }

  function openPrefilledIssue(request) {
    rememberPendingRequest(request.operation);
    const anchor = document.createElement("a");
    anchor.href = buildIssueRequestUrl(request);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function readPendingRequest() {
    try {
      const raw = localStorage.getItem(PENDING_REQUEST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Date.now() - Number(parsed.createdAt || 0) > 10 * 60 * 1000) {
        localStorage.removeItem(PENDING_REQUEST_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function clearPendingRequest() {
    try { localStorage.removeItem(PENDING_REQUEST_KEY); } catch { /* noop */ }
    if (state.pendingRefreshTimer) {
      window.clearInterval(state.pendingRefreshTimer);
      state.pendingRefreshTimer = null;
    }
  }

  function startPendingRefresh() {
    const pending = readPendingRequest();
    if (!pending || state.pendingRefreshTimer) return;
    let attempts = 0;
    const refresh = async () => {
      attempts += 1;
      try {
        await loadRoutines();
        const changed = Boolean(state.data?.updatedAt) && state.data.updatedAt !== pending.baselineUpdatedAt;
        if (changed) {
          clearPendingRequest();
          showMessage(els.adminMessage, "GitHub Action 반영이 확인되었습니다. 최신 루틴 목록을 불러왔습니다.");
          return;
        }
      } catch {
        // Keep polling while GitHub Pages deployment is in progress.
      }
      if (attempts >= 24) {
        clearPendingRequest();
        showMessage(els.adminMessage, "GitHub 요청을 제출했다면 Actions 처리 후 ‘목록 새로고침’을 눌러 확인해 주세요.");
      }
    };
    refresh();
    state.pendingRefreshTimer = window.setInterval(refresh, 5000);
  }

  function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent);
  }

  function isWithinActivePeriod(dateString) {
    return dateString >= ACTIVE_FROM && dateString <= ACTIVE_UNTIL;
  }

  function getSeoulParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    const weekday = WEEKDAY_MAP[parts.weekday];
    const dateString = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      weekday,
      dateString,
      timeString,
      minuteKey: `${dateString}T${timeString}`,
      currentMinutes: hour * 60 + minute,
      dateTimeLabel: `${year}. ${month}. ${day}. ${["일", "월", "화", "수", "목", "금", "토"][weekday]}요일 ${timeString}`
    };
  }

  function normalizeItem(raw) {
    const days = Array.from(new Set((Array.isArray(raw?.days) ? raw.days : []).map(Number)))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    const time = String(raw?.time || "");
    if (!String(raw?.id || "") || !String(raw?.title || "").trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || days.length === 0) {
      return null;
    }
    return {
      id: String(raw.id),
      title: String(raw.title).trim(),
      message: String(raw.message || "").trim(),
      time,
      days,
      enabled: raw.enabled !== false,
      createdAt: String(raw.createdAt || "")
    };
  }

  function normalizeData(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
      throw new Error("routines.json 구조가 올바르지 않습니다.");
    }
    const items = raw.items.map(normalizeItem).filter(Boolean);
    return {
      schemaVersion: 1,
      timezone: String(raw.timezone || TIMEZONE),
      activeFrom: String(raw.activeFrom || ACTIVE_FROM),
      activeUntil: String(raw.activeUntil || ACTIVE_UNTIL),
      updatedAt: String(raw.updatedAt || ""),
      items
    };
  }

  function setStatus(element, text, variant = "") {
    if (!element) return;
    element.textContent = text;
    element.classList.remove("active", "warning", "error");
    if (variant) element.classList.add(variant);
  }

  function showMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
    element.classList.add("show");
  }

  function clearMessage(element) {
    element.textContent = "";
    element.classList.remove("show", "error");
  }

  function setBusy(button, busy, busyText, idleText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : idleText;
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    try {
      state.serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (error) {
      console.warn("Service Worker registration failed:", error);
    }
  }

  async function fetchRoutineData() {
    const response = await fetch(`./routines.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`routines.json을 읽지 못했습니다. (${response.status})`);
    return normalizeData(await response.json());
  }

  async function loadRoutines({ announce = false } = {}) {
    setBusy(els.refreshBtn, true, "불러오는 중", "목록 새로고침");
    clearMessage(els.listMessage);
    try {
      state.data = await fetchRoutineData();
      renderAll();
      setStatus(els.dataStatus, "GitHub Pages JSON 연결됨", "active");
      if (announce) showMessage(els.listMessage, "루틴 목록을 새로 불러왔습니다.");
    } catch (error) {
      setStatus(els.dataStatus, "루틴 목록 오류", "error");
      showMessage(els.listMessage, error.message, true);
      throw error;
    } finally {
      setBusy(els.refreshBtn, false, "불러오는 중", "목록 새로고침");
    }
  }

  function enabledItems() {
    return (state.data?.items || []).filter((item) => item.enabled);
  }

  function createRoutineCard(item) {
    const card = document.createElement("article");
    card.className = "routine-card";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const message = item.message ? document.createElement("p") : null;
    if (message) message.textContent = item.message;

    const actions = document.createElement("div");
    actions.className = "routine-card-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "small-btn";
    deleteButton.textContent = "삭제 요청";
    deleteButton.title = `Routine ID: ${item.id}`;
    deleteButton.addEventListener("click", () => openDeleteIssue(item));

    actions.append(deleteButton);
    card.append(title);
    if (message) card.append(message);
    card.append(actions);
    return card;
  }

  function renderTimetable() {
    els.timetableArea.replaceChildren();
    const items = enabledItems();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "아직 등록된 루틴이 없습니다. 아래의 루틴 추가 영역에서 첫 루틴을 등록해 주세요.";
      els.timetableArea.append(empty);
      return;
    }

    const times = Array.from(new Set(items.map((item) => item.time))).sort();
    const shell = document.createElement("div");
    shell.className = "timetable-shell";
    const grid = document.createElement("div");
    grid.className = "timetable";

    const corner = document.createElement("div");
    corner.className = "timetable-cell timetable-corner";
    corner.textContent = "TIME";
    grid.append(corner);

    DISPLAY_DAYS.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "timetable-cell timetable-day";
      const content = document.createElement("div");
      content.textContent = day.ko;
      const sub = document.createElement("span");
      sub.textContent = day.en;
      content.append(sub);
      cell.append(content);
      grid.append(cell);
    });

    times.forEach((time, rowIndex) => {
      const isLastRow = rowIndex === times.length - 1;
      const timeCell = document.createElement("div");
      timeCell.className = `timetable-cell timetable-time${isLastRow ? " last-row" : ""}`;
      timeCell.textContent = time;
      grid.append(timeCell);

      DISPLAY_DAYS.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = `timetable-cell routine-cell${isLastRow ? " last-row" : ""}`;
        items
          .filter((item) => item.time === time && item.days.includes(day.value))
          .sort((a, b) => a.title.localeCompare(b.title, "ko"))
          .forEach((item) => cell.append(createRoutineCard(item)));
        grid.append(cell);
      });
    });

    shell.append(grid);
    els.timetableArea.append(shell);
  }

  function getTodayRemainingRoutines(now = getSeoulParts()) {
    if (!isWithinActivePeriod(now.dateString)) return [];
    return enabledItems()
      .filter((item) => {
        if (!item.days.includes(now.weekday)) return false;
        const [hour, minute] = item.time.split(":").map(Number);
        return hour * 60 + minute > now.currentMinutes;
      })
      .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "ko"));
  }

  function renderTodaySummary() {
    if (!els.nextRoutineValue || !els.nextRoutineMeta) return;
    const now = getSeoulParts();
    const remaining = getTodayRemainingRoutines();
    if (remaining.length === 0) {
      els.nextRoutineValue.textContent = "오늘 남은 루틴 없음";
      els.nextRoutineMeta.textContent = `${now.dateTimeLabel} 기준`;
      return;
    }
    const next = remaining[0];
    els.nextRoutineValue.textContent = `${next.time} · ${next.title}`;
    els.nextRoutineMeta.textContent = `${now.dateTimeLabel} 기준 · 오늘 남은 루틴 ${remaining.length}개`;
  }

  function renderAll() {
    renderTimetable();
    renderTodaySummary();
    updatePlatformStatus();
  }

  function desktopEnabled() {
    return localStorage.getItem(DESKTOP_ENABLED_KEY) === "1";
  }

  function setDesktopEnabled(enabled) {
    if (enabled) localStorage.setItem(DESKTOP_ENABLED_KEY, "1");
    else localStorage.removeItem(DESKTOP_ENABLED_KEY);
    updatePlatformStatus();
  }

  function updatePlatformStatus() {
    const desktopSupported = "Notification" in window;
    if (!desktopSupported) {
      setStatus(els.desktopNotificationStatus, "이 브라우저는 지원하지 않음", "error");
      els.desktopNotificationBtn.disabled = true;
      els.desktopControlBtn.disabled = true;
    } else if (desktopEnabled() && Notification.permission === "granted") {
      setStatus(els.desktopNotificationStatus, "Desktop 알림 켜짐", "active");
      els.desktopNotificationBtn.textContent = "Desktop Notification On";
      els.desktopControlBtn.textContent = "Desktop Notification On";
    } else if (Notification.permission === "denied") {
      setStatus(els.desktopNotificationStatus, "브라우저 설정에서 알림 차단됨", "error");
      els.desktopNotificationBtn.textContent = "Desktop Notification Turn On";
      els.desktopControlBtn.textContent = "Desktop Notification Turn On";
    } else {
      setStatus(els.desktopNotificationStatus, "Desktop 알림 꺼짐", "warning");
      els.desktopNotificationBtn.textContent = "Desktop Notification Turn On";
      els.desktopControlBtn.textContent = "Desktop Notification Turn On";
    }

    const android = isAndroidDevice();
    els.androidAlarmBtn.disabled = !android;
    els.androidControlBtn.disabled = !android;
    if (android) {
      setStatus(els.androidAlarmStatus, "Galaxy 시계 연결 가능", "active");
    } else {
      setStatus(els.androidAlarmStatus, "Android Galaxy에서 사용", "warning");
    }
  }

  async function prepareAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!state.audioContext) state.audioContext = new AudioContextClass();
    if (state.audioContext.state === "suspended") await state.audioContext.resume();
  }

  async function playNotificationSound() {
    try {
      await prepareAudio();
      if (!state.audioContext) return;
      const oscillator = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, state.audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(state.audioContext.destination);
      oscillator.start();
      oscillator.stop(state.audioContext.currentTime + 0.45);
    } catch (error) {
      console.warn("Notification sound failed:", error);
    }
  }

  async function showDesktopNotification(item, test = false) {
    const title = test ? "Summer Routine Test" : item.title;
    const options = {
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag: test ? "summer-routine-test" : `summer-routine-${item.id}`,
      renotify: true
    };
    const body = test ? "Desktop 알림이 정상적으로 동작합니다." : String(item.message || "").trim();
    if (body) options.body = body;

    if (state.serviceWorkerRegistration) {
      await state.serviceWorkerRegistration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    await playNotificationSound();
  }

  async function turnOnDesktopNotifications() {
    clearMessage(els.listMessage);
    if (!("Notification" in window)) {
      showMessage(els.listMessage, "이 브라우저는 Desktop Notification을 지원하지 않습니다.", true);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDesktopEnabled(false);
        showMessage(els.listMessage, "브라우저에서 알림 권한이 허용되지 않았습니다.", true);
        return;
      }
      await prepareAudio();
      setDesktopEnabled(true);
      showMessage(els.listMessage, "Desktop Notification을 켰습니다. 페이지가 실행 중일 때 루틴 시각을 확인합니다.");
      await checkDueRoutines();
    } catch (error) {
      showMessage(els.listMessage, error.message, true);
    }
  }

  function turnOffDesktopNotifications() {
    setDesktopEnabled(false);
    showMessage(els.listMessage, "이 브라우저에서 Desktop Notification을 껐습니다.");
  }

  async function testDesktopNotification() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      showMessage(els.listMessage, "먼저 Desktop Notification Turn On을 눌러 알림 권한을 허용해 주세요.", true);
      return;
    }
    await showDesktopNotification({ id: "test", title: "Summer Routine", message: "" }, true);
  }

  async function checkDueRoutines() {
    if (state.checking || !state.data || !desktopEnabled() || !("Notification" in window) || Notification.permission !== "granted") return;
    state.checking = true;
    try {
      const now = getSeoulParts();
      if (!isWithinActivePeriod(now.dateString)) return;
      const dueItems = enabledItems().filter((item) => item.days.includes(now.weekday) && item.time === now.timeString);
      for (const item of dueItems) {
        const firedKey = `${FIRED_KEY_PREFIX}${now.dateString}:${item.id}:${item.time}`;
        if (localStorage.getItem(firedKey) === "1") continue;
        localStorage.setItem(firedKey, "1");
        await showDesktopNotification(item);
      }
      pruneFiredKeys(now.dateString);
    } finally {
      state.checking = false;
    }
  }

  function pruneFiredKeys(todayString) {
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(FIRED_KEY_PREFIX)) return;
      const datePart = key.slice(FIRED_KEY_PREFIX.length, FIRED_KEY_PREFIX.length + 10);
      if (datePart < todayString) localStorage.removeItem(key);
    });
  }

  function encodeIntentString(value) {
    return encodeURIComponent(value).replace(/'/g, "%27");
  }

  function buildSamsungAlarmIntent(item) {
    const [hour, minute] = item.time.split(":").map(Number);
    const label = encodeIntentString(`Summer Routine · ${item.title}`);
    return [
      "intent:#Intent",
      "action=android.intent.action.SET_ALARM",
      `package=${SAMSUNG_CLOCK_PACKAGE}`,
      `i.android.intent.extra.alarm.HOUR=${hour}`,
      `i.android.intent.extra.alarm.MINUTES=${minute}`,
      `S.android.intent.extra.alarm.MESSAGE=${label}`,
      "B.android.intent.extra.alarm.SKIP_UI=true",
      "end"
    ].join(";");
  }

  function isStillFutureToday(item, now = getSeoulParts()) {
    if (!isWithinActivePeriod(now.dateString) || !item.days.includes(now.weekday)) return false;
    const [hour, minute] = item.time.split(":").map(Number);
    return hour * 60 + minute > now.currentMinutes;
  }

  function openSamsungAlarm(item, button) {
    if (!isAndroidDevice()) {
      showMessage(els.listMessage, "Android Galaxy 기기에서만 Galaxy 시계를 열 수 있습니다.", true);
      return;
    }
    if (!isStillFutureToday(item)) {
      renderAndroidAlarmList();
      showMessage(els.listMessage, "해당 루틴 시간이 이미 지났거나 오늘 요일의 루틴이 아닙니다.", true);
      return;
    }

    button.textContent = "Galaxy 시계 요청 완료";
    button.disabled = true;
    window.location.assign(buildSamsungAlarmIntent(item));
  }

  function renderAndroidAlarmList() {
    const now = getSeoulParts();
    const items = getTodayRemainingRoutines();
    els.androidAlarmList.replaceChildren();

    if (items.length === 0) {
      els.androidAlarmSummary.textContent = `${now.dateTimeLabel} 기준으로 Galaxy 시계에 추가할 오늘의 남은 루틴이 없습니다.`;
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "오늘 요일에 해당하는 루틴이 없거나 모든 루틴 시간이 이미 지났습니다.";
      els.androidAlarmList.append(empty);
      return;
    }

    els.androidAlarmSummary.textContent = `${now.dateTimeLabel} 기준 · 오늘 요일의 현재 시각 이후 루틴 ${items.length}개입니다. 각 알람은 반복 없이 한 번만 생성됩니다.`;

    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "android-alarm-item";

      const time = document.createElement("div");
      time.className = "android-alarm-time";
      time.textContent = item.time;

      const copy = document.createElement("div");
      copy.className = "android-alarm-copy";
      const title = document.createElement("strong");
      title.textContent = item.title;
      copy.append(title);
      if (item.message) {
        const message = document.createElement("span");
        message.textContent = item.message;
        copy.append(message);
      }

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "primary-btn";
      addButton.textContent = "Galaxy 시계에 추가";
      addButton.addEventListener("click", () => openSamsungAlarm(item, addButton));

      row.append(time, copy, addButton);
      els.androidAlarmList.append(row);
    });
  }

  function openAndroidAlarmDialog() {
    clearMessage(els.listMessage);
    if (!isAndroidDevice()) {
      showMessage(els.listMessage, "Android Alarm은 Galaxy 기기에서 접속했을 때 사용할 수 있습니다.", true);
      return;
    }
    if (!state.data) {
      showMessage(els.listMessage, "루틴 목록을 먼저 불러와 주세요.", true);
      return;
    }
    renderAndroidAlarmList();
    if (typeof els.androidAlarmDialog.showModal === "function") {
      els.androidAlarmDialog.showModal();
    } else {
      showMessage(els.listMessage, "현재 브라우저가 알람 목록 대화상자를 지원하지 않습니다.", true);
    }
  }

  function selectedDays() {
    return Array.from(document.querySelectorAll('input[name="days"]:checked')).map((input) => Number(input.value));
  }

  function validateRoutineForm() {
    const title = els.routineTitle.value.trim();
    const message = els.routineMessage.value.trim();
    const time = els.routineTime.value;
    const days = selectedDays();
    if (!title || !time) throw new Error("루틴 이름과 시간을 입력해 주세요.");
    if (days.length === 0) throw new Error("요일을 하나 이상 선택해 주세요.");
    return { title, message, time, days };
  }

  function handleRoutineSubmit(event) {
    event.preventDefault();
    clearMessage(els.adminMessage);
    try {
      const values = validateRoutineForm();
      openPrefilledIssue({
        version: 1,
        operation: "add",
        title: values.title,
        time: values.time,
        message: values.message,
        days: values.days
      });
      showMessage(
        els.adminMessage,
        "현재 입력값이 자동으로 채워진 GitHub Issue 화면을 열었습니다. Submit new issue를 한 번 누르면 JSON 커밋과 포털 재배포가 자동 실행됩니다."
      );
    } catch (error) {
      showMessage(els.adminMessage, error.message, true);
    }
  }

  function openDeleteIssue(item) {
    openPrefilledIssue({
      version: 1,
      operation: "delete",
      routineId: item.id,
      title: item.title
    });
    showMessage(
      els.listMessage,
      `“${item.title}”의 삭제 정보가 모두 채워진 GitHub Issue 화면을 열었습니다. Submit new issue를 누르면 자동 삭제됩니다.`
    );
  }

  function updateClock() {
    const now = getSeoulParts();
    els.portalClock.textContent = now.dateTimeLabel;
    if (state.lastRenderedMinute !== now.minuteKey) {
      state.lastRenderedMinute = now.minuteKey;
      renderTodaySummary();
      if (els.androidAlarmDialog.open) renderAndroidAlarmList();
      checkDueRoutines();
    }
  }

  function wireEvents() {
    [els.desktopNotificationBtn, els.desktopControlBtn].forEach((button) => button.addEventListener("click", turnOnDesktopNotifications));
    [els.androidAlarmBtn, els.androidControlBtn].forEach((button) => button.addEventListener("click", openAndroidAlarmDialog));
    els.testNotificationBtn.addEventListener("click", testDesktopNotification);
    els.turnOffDesktopBtn.addEventListener("click", turnOffDesktopNotifications);
    els.refreshBtn.addEventListener("click", () => loadRoutines({ announce: true }).catch(() => {}));
    els.routineForm.addEventListener("submit", handleRoutineSubmit);
    els.closeAndroidAlarmBtn.addEventListener("click", () => els.androidAlarmDialog.close());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        updateClock();
        checkDueRoutines();
      }
    });
    window.addEventListener("focus", () => {
      checkDueRoutines();
      startPendingRefresh();
    });
  }

  async function init() {
    wireEvents();
    await registerServiceWorker();
    updateClock();
    updatePlatformStatus();
    try {
      await loadRoutines();
    } catch {
      // Error is already shown in the page.
    }
    await checkDueRoutines();
    startPendingRefresh();
    window.setInterval(updateClock, 1000);
    window.setInterval(checkDueRoutines, 15000);
  }

  init().catch((error) => showMessage(els.listMessage, error.message, true));
})();
