(() => {
  'use strict';

  const DB_NAME = 'myPortal.runningSessionLog.v2';
  const LEGACY_DB_NAME = 'myPortal.runningVault';
  const DB_VERSION = 1;
  const STORE_NAME = 'vault';
  const VAULT_RECORD_KEY = 'primary';
  const VAULT_FORMAT = 'MY_PORTAL_RUNNING_SESSION_LOG';
  const VAULT_VERSION = 1;
  const STATE_VERSION = 7;
  const KDF_ITERATIONS = 600000;
  const KDF_HASH = 'SHA-256';
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const MIN_PASSWORD_LENGTH = 12;

  const KST_DATE = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const KST_FULL = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const KST_TIME = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const KST_DAY = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short'
  });
  const KST_MONTH = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long'
  });

  const els = {};
  let dbPromise = null;
  let state = null;
  let vaultKey = null;
  let vaultMeta = null;
  let hasVault = false;
  let tickTimer = null;
  let holdTimer = null;
  let toastTimer = null;
  let saveTimer = null;
  let saveLoopPromise = null;
  let dirtyRevision = 0;
  let persistedRevision = 0;
  let lastActivityAt = Date.now();
  let passwordDialogContext = null;
  let pendingImportedEnvelope = null;
  let pendingGateAction = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();

    if (!window.crypto?.subtle || !window.indexedDB) {
      renderPublicState();
      els.startButton.disabled = true;
      els.recordAccessButton.disabled = true;
      showToast('이 브라우저는 암호화 저장에 필요한 Web Crypto 또는 IndexedDB를 지원하지 않습니다.');
      return;
    }

    await deleteLegacyTestDatabase();
    hasVault = Boolean(await getStoredEnvelope());
    showPublicApp();
    tickTimer = window.setInterval(tick, 250);
    window.addEventListener('resize', () => state ? renderDashboard() : drawLockedTrend());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) lastActivityAt = Date.now();
    });
    ['pointerdown', 'keydown', 'touchstart'].forEach(name => {
      document.addEventListener(name, registerActivity, { passive: true });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !els.vaultGate.hidden) closeAccessGate();
    });
  }

  function cacheElements() {
    const ids = [
      'vaultGate','vaultGateDescription','vaultForm','vaultPassword','vaultPasswordConfirm','confirmPasswordWrap','vaultError',
      'vaultSubmit','togglePassword','gateImportButton','gateImportInput','gateCloseButton','appRoot','storageChip','recordAccessButton','lockButton','settingsButton',
      'heroStatusTitle','heroStatusText','periodPrev','periodNext','periodLabel','periodSubLabel','participationLabel',
      'metricSessions','metricSessionsUnit','metricDuration','metricDistance','metricSpeed','metricIncline','averageLabel',
      'metricAverage','metricAverageUnit','trendSummary','trendCanvas','sessionHeading','sessionIdBadge','sessionClock',
      'sessionDate','speedValue','inclineValue','paceValue','stabilityPanel','stabilityTitle','stabilityText','stabilityProgress',
      'stabilitySeconds','startButton','stopButton','liveSegments','liveValidDuration','liveDistance','liveAverageSpeed',
      'liveAverageIncline','logElapsedTime','logAccumulatedDistance','logSubtitle','segmentTableBody','emptyLog','exportButton','backupButton',
      'previousComparisonSubtitle','previousSessionCount','previousTotalDuration','previousTotalDistance','previousAverageDuration',
      'previousAverageDistance','previousAverageSettings','settingsDialog',
      'stableSecondsInput','autoLockMinutesInput','exportVaultButton','mergeVaultButton','mergeVaultInput','changePasswordButton',
      'lockFromSettingsButton','deleteVaultButton','saveSettingsButton','passwordDialog','passwordDialogForm',
      'passwordDialogTitle','passwordDialogDescription','passwordDialogInput','newPasswordFields','newPasswordInput',
      'newPasswordConfirmInput','passwordDialogError','passwordDialogCancel','passwordDialogSubmit','toast'
    ];
    ids.forEach(id => { els[id] = document.getElementById(id); });
    els.periodTabs = [...document.querySelectorAll('.period-tab')];
    els.stepButtons = [...document.querySelectorAll('.step-button')];
  }

  function bindEvents() {
    els.vaultForm.addEventListener('submit', handleGateSubmit);
    els.togglePassword.addEventListener('click', toggleGatePassword);
    els.gateCloseButton.addEventListener('click', closeAccessGate);
    els.vaultGate.addEventListener('click', event => { if (event.target === els.vaultGate) closeAccessGate(); });
    els.gateImportButton.addEventListener('click', () => els.gateImportInput.click());
    els.gateImportInput.addEventListener('change', handleGateImport);
    els.recordAccessButton.addEventListener('click', () => openAccessGate('view'));

    els.periodTabs.forEach(button => button.addEventListener('click', () => {
      if (!state) return openAccessGate('view');
      setDashboardPeriod(button.dataset.period);
    }));
    els.periodPrev.addEventListener('click', () => state ? shiftDashboard(-1) : openAccessGate('view'));
    els.periodNext.addEventListener('click', () => state ? shiftDashboard(1) : openAccessGate('view'));
    els.startButton.addEventListener('click', () => state ? startSession() : openAccessGate('start'));
    els.stopButton.addEventListener('click', stopSession);
    els.settingsButton.addEventListener('click', () => state ? openSettings() : openAccessGate('settings'));
    els.lockButton.addEventListener('click', () => lockVault('기록 로그아웃'));
    els.exportButton.addEventListener('click', () => state ? exportDisplayedSessionCsv() : openAccessGate('view'));
    els.backupButton.addEventListener('click', () => state ? exportVaultBackup() : openAccessGate('backup'));

    els.saveSettingsButton.addEventListener('click', saveSettings);
    els.exportVaultButton.addEventListener('click', exportVaultBackup);
    els.mergeVaultButton.addEventListener('click', () => els.mergeVaultInput.click());
    els.mergeVaultInput.addEventListener('change', handleMergeFileSelected);
    els.changePasswordButton.addEventListener('click', () => openPasswordDialog('change'));
    els.lockFromSettingsButton.addEventListener('click', () => {
      els.settingsDialog.close();
      lockVault('기록 로그아웃');
    });
    els.deleteVaultButton.addEventListener('click', deleteLocalVault);

    els.passwordDialogForm.addEventListener('submit', handlePasswordDialogSubmit);
    els.passwordDialogCancel.addEventListener('click', closePasswordDialog);

    els.stepButtons.forEach(button => {
      const run = () => {
        if (!state) return openAccessGate('record');
        adjustValue(button.dataset.control, Number(button.dataset.delta));
      };
      button.addEventListener('click', event => {
        if (event.detail === 0) run();
      });
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        run();
        if (!state) return;
        clearHoldTimer();
        holdTimer = window.setTimeout(() => {
          holdTimer = window.setInterval(run, 90);
        }, 380);
      });
      ['pointerup','pointercancel','pointerleave'].forEach(name => button.addEventListener(name, clearHoldTimer));
    });
  }

  function registerActivity() {
    if (state) lastActivityAt = Date.now();
  }

  function clearHoldTimer() {
    if (!holdTimer) return;
    window.clearTimeout(holdTimer);
    window.clearInterval(holdTimer);
    holdTimer = null;
  }

  function createDefaultState() {
    const now = Date.now();
    return {
      version: STATE_VERSION,
      createdAt: now,
      updatedAt: now,
      deviceId: `WEB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      settings: {
        speed: 0.3,
        incline: 0.0,
        stableSeconds: 10,
        autoLockMinutes: 15
      },
      sessions: [],
      activeSessionId: null,
      displaySessionId: null,
      dashboard: { period: 'day', anchor: kstDateKey(now) }
    };
  }

  function openAccessGate(action = 'view') {
    pendingGateAction = action;
    els.vaultGate.hidden = false;
    document.body.classList.add('modal-open');
    els.vaultPassword.value = '';
    els.vaultPasswordConfirm.value = '';
    els.vaultError.textContent = '';
    els.vaultPassword.type = 'password';
    els.vaultPasswordConfirm.type = 'password';
    els.togglePassword.textContent = '보기';

    if (hasVault) {
      els.vaultGateDescription.textContent = action === 'start'
        ? '새 러닝 세션을 시작하려면 기록 비밀번호를 입력하세요.'
        : '암호화된 이전 기록을 확인하려면 기록 비밀번호를 입력하세요.';
      els.confirmPasswordWrap.hidden = true;
      els.vaultPasswordConfirm.required = false;
      els.vaultPassword.autocomplete = 'current-password';
      els.vaultSubmit.textContent = action === 'start' ? '로그인하고 START' : '기록 로그인';
    } else {
      els.vaultGateDescription.textContent = '첫 기록을 시작하기 전에 이 기기용 암호화 비밀번호를 설정하세요. 비밀번호는 코드와 GitHub에 저장되지 않습니다.';
      els.confirmPasswordWrap.hidden = false;
      els.vaultPasswordConfirm.required = true;
      els.vaultPassword.autocomplete = 'new-password';
      els.vaultSubmit.textContent = action === 'start' ? '암호화 기록 만들고 START' : '암호화 기록 시작';
    }
    window.setTimeout(() => els.vaultPassword.focus(), 60);
  }

  function closeAccessGate() {
    pendingGateAction = null;
    els.vaultGate.hidden = true;
    document.body.classList.remove('modal-open');
    els.vaultPassword.value = '';
    els.vaultPasswordConfirm.value = '';
    els.vaultError.textContent = '';
  }

  async function handleGateSubmit(event) {
    event.preventDefault();
    const password = els.vaultPassword.value;
    const requestedAction = pendingGateAction;
    els.vaultError.textContent = '';
    els.vaultSubmit.disabled = true;
    els.vaultSubmit.textContent = hasVault ? '로그인 중…' : '암호화 준비 중…';

    try {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      }
      if (hasVault) {
        await unlockVault(password);
      } else {
        if (password !== els.vaultPasswordConfirm.value) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        await createVault(password);
      }
      closeAccessGate();
      if (requestedAction === 'start' && !activeSession()) startSession();
      if (requestedAction === 'settings') openSettings();
      if (requestedAction === 'backup') exportVaultBackup();
      els.vaultPassword.value = '';
      els.vaultPasswordConfirm.value = '';
    } catch (error) {
      console.error(error);
      showGateError(hasVault ? '비밀번호가 올바르지 않거나 암호화 기록이 손상되었습니다.' : error.message);
    } finally {
      els.vaultSubmit.disabled = false;
      els.vaultSubmit.textContent = hasVault ? '기록 로그인' : '암호화 기록 시작';
    }
  }

  function toggleGatePassword() {
    const show = els.vaultPassword.type === 'password';
    els.vaultPassword.type = show ? 'text' : 'password';
    els.vaultPasswordConfirm.type = show ? 'text' : 'password';
    els.togglePassword.textContent = show ? '숨기기' : '보기';
  }

  function showGateError(message) {
    els.vaultError.textContent = message;
  }

  function showPublicApp() {
    els.vaultGate.hidden = true;
    document.body.classList.remove('modal-open');
    els.appRoot.hidden = false;
    els.appRoot.classList.add('is-locked');
    els.recordAccessButton.hidden = false;
    els.lockButton.hidden = true;
    renderPublicState();
  }

  function renderPublicState() {
    els.storageChip.textContent = 'PRIVATE RECORDS LOCKED';
    els.storageChip.classList.add('is-locked');
    els.storageChip.dataset.state = 'locked';
    els.heroStatusTitle.textContent = '사이트를 둘러볼 수 있습니다';
    els.heroStatusText.textContent = 'START 또는 기록 조회 기능을 누르면 비밀번호 입력 창이 열립니다.';
    els.periodLabel.textContent = '오늘';
    els.periodSubLabel.textContent = '기록 로그인 후 조회';
    els.periodTabs.forEach((button, index) => {
      button.classList.toggle('is-active', index === 0);
      button.setAttribute('aria-selected', String(index === 0));
    });
    els.participationLabel.textContent = '러닝 횟수';
    els.metricSessions.textContent = '—';
    els.metricSessionsUnit.textContent = '비공개';
    els.metricDuration.textContent = '—';
    els.metricDistance.textContent = '—';
    els.metricSpeed.textContent = '—';
    els.metricIncline.textContent = '—';
    els.averageLabel.textContent = '평균 거리';
    els.metricAverage.textContent = '—';
    els.metricAverageUnit.textContent = '비공개';
    els.trendSummary.textContent = '기록 로그인 후 암호화된 성장 추이를 확인할 수 있습니다.';
    drawLockedTrend();

    els.sessionHeading.textContent = '운동 준비';
    els.sessionIdBadge.textContent = '로그인 필요';
    els.sessionClock.textContent = '00:00:00';
    els.sessionDate.textContent = '한국시간';
    els.speedValue.textContent = '0.3';
    els.inclineValue.textContent = '0.0';
    els.paceValue.textContent = '200:00 /km';
    els.stabilityPanel.dataset.state = 'idle';
    els.stabilityTitle.textContent = '설정값 대기';
    els.stabilityText.textContent = 'START를 누르면 기록 로그인 후 새 세션을 시작합니다.';
    els.stabilityProgress.style.width = '0%';
    els.stabilitySeconds.textContent = '0 / 10초';
    els.startButton.disabled = false;
    els.stopButton.disabled = true;

    els.previousComparisonSubtitle.textContent = '기록 로그인 후 이번 세션 이전의 누적·평균을 확인할 수 있습니다.';
    els.previousSessionCount.textContent = '—';
    els.previousTotalDuration.textContent = '—';
    els.previousTotalDistance.textContent = '—';
    els.previousAverageDuration.textContent = '—';
    els.previousAverageDistance.textContent = '—';
    els.previousAverageSettings.textContent = '—';
    els.liveSegments.textContent = '—';
    els.liveValidDuration.textContent = '—';
    els.liveDistance.textContent = '—';
    els.liveAverageSpeed.textContent = '—';
    els.liveAverageIncline.textContent = '—';
    els.logElapsedTime.textContent = '00:00:00';
    els.logAccumulatedDistance.textContent = '—';
    els.segmentTableBody.replaceChildren();
    els.emptyLog.hidden = false;
    els.emptyLog.innerHTML = '<strong>현재 세션 기록은 잠겨 있습니다</strong><span>START를 누르면 로그인 후 현재 세션 구간별 로그가 표시됩니다.</span>';
    els.logSubtitle.textContent = '잠긴 상태에서는 이전 기록을 화면에 표시하지 않습니다.';
  }

  function drawLockedTrend() {
    const canvas = els.trendCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width || 600));
    const height = Math.max(110, Math.floor(rect.height || 132));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#e5dff0';
    ctx.lineWidth = 1;
    [0.2, 0.5, 0.8].forEach(ratio => {
      const y = height * ratio;
      ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(width - 12, y); ctx.stroke();
    });
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = '#aa9aca';
    ctx.beginPath();
    ctx.moveTo(16, height * .72);
    ctx.bezierCurveTo(width * .25, height * .56, width * .42, height * .62, width * .58, height * .4);
    ctx.bezierCurveTo(width * .72, height * .25, width * .84, height * .45, width - 16, height * .22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#786f8d';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRIVATE · LOGIN TO VIEW RECORDS', width / 2, height - 8);
  }

  async function deleteLegacyTestDatabase() {
    if (!window.indexedDB || LEGACY_DB_NAME === DB_NAME) return;
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }

  async function createVault(password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await deriveKey(password, salt, KDF_ITERATIONS);
    const initialState = createDefaultState();
    const envelope = await encryptState(initialState, key, salt, KDF_ITERATIONS);
    await putStoredEnvelope(envelope);
    vaultKey = key;
    vaultMeta = envelopeMeta(envelope);
    state = initialState;
    hasVault = true;
    dirtyRevision = 0;
    persistedRevision = 0;
    await requestPersistentStorage();
    showUnlockedApp();
    showToast('암호화된 러닝 기록 저장소를 만들었습니다.');
  }

  async function unlockVault(password) {
    const envelope = await getStoredEnvelope();
    if (!envelope) throw new Error('저장된 암호화 기록이 없습니다.');
    const result = await decryptEnvelope(envelope, password);
    state = normalizeState(result.state);
    vaultKey = result.key;
    vaultMeta = envelopeMeta(envelope);
    hasVault = true;
    dirtyRevision = 0;
    persistedRevision = 0;
    showUnlockedApp();
    showToast('암호화된 기록에 로그인했습니다.');
  }

  function showUnlockedApp() {
    els.vaultGate.hidden = true;
    document.body.classList.remove('modal-open');
    els.appRoot.hidden = false;
    els.appRoot.classList.remove('is-locked');
    els.recordAccessButton.hidden = true;
    els.lockButton.hidden = false;
    els.storageChip.classList.remove('is-locked');
    lastActivityAt = Date.now();
    renderAll();
  }

  async function lockVault(reason = '기록 로그아웃') {
    if (!state) return;
    clearHoldTimer();
    await flushSave();
    state = null;
    vaultKey = null;
    vaultMeta = null;
    dirtyRevision = 0;
    persistedRevision = 0;
    if (els.settingsDialog.open) els.settingsDialog.close();
    if (els.passwordDialog.open) els.passwordDialog.close();
    showPublicApp();
    showToast(`${reason}: 기록을 잠갔습니다.`);
  }

  function normalizeState(input) {
    const base = createDefaultState();
    const normalized = {
      ...base,
      ...input,
      settings: { ...base.settings, ...(input?.settings || {}) }
    };
    const sourceVersion = Number(input?.version) || 0;
    normalized.version = STATE_VERSION;
    normalized.sessions = Array.isArray(input?.sessions) ? input.sessions : [];
    normalized.dashboard = input?.dashboard || base.dashboard;
    normalized.deviceId = input?.deviceId || base.deviceId;
    normalized.settings.speed = clamp(round1(Number(normalized.settings.speed) || 0.3), 0.3, 20.0);
    normalized.settings.incline = clamp(round1(Number(normalized.settings.incline) || 0), 0, 16.0);
    // v7에서도 구간 확정 시간은 10초로 고정합니다. 기존 암호화 세션 데이터와 저장소는 그대로 유지합니다.
    normalized.settings.stableSeconds = 10;
    normalized.settings.autoLockMinutes = Math.max(1, Math.min(120, Number(normalized.settings.autoLockMinutes) || 15));
    if (!normalized.dashboard.anchor) normalized.dashboard.anchor = kstDateKey(Date.now());
    if (!['day','week','month'].includes(normalized.dashboard.period)) normalized.dashboard.period = 'day';
    if (normalized.activeSessionId && !normalized.sessions.some(session => session.id === normalized.activeSessionId)) {
      normalized.activeSessionId = null;
    }
    if (normalized.displaySessionId && !normalized.sessions.some(session => session.id === normalized.displaySessionId)) {
      normalized.displaySessionId = null;
    }
    return normalized;
  }

  function activeSession() {
    return state?.sessions.find(session => session.id === state.activeSessionId) || null;
  }

  function displayedSession() {
    return state?.sessions.find(session => session.id === state.displaySessionId) || null;
  }

  function startSession() {
    if (!state || activeSession()) return;
    const now = Date.now();
    const dateKey = kstDateKey(now);
    const sessionNo = state.sessions.filter(session => session.dateKst === dateKey).length + 1;
    const deviceSuffix = state.deviceId.replace(/[^A-Z0-9]/g, '').slice(-4);
    const session = {
      id: `RUN-${dateKey.replaceAll('-', '')}-${String(sessionNo).padStart(2, '0')}-${deviceSuffix}`,
      dateKst: dateKey,
      sessionNo,
      startAt: now,
      endAt: null,
      modifiedAt: now,
      status: 'active',
      deviceId: state.deviceId,
      events: [],
      segments: [],
      activeSegment: null,
      pending: {
        speed: state.settings.speed,
        incline: state.settings.incline,
        transitionStartedAt: now,
        candidateStartedAt: now
      }
    };
    state.sessions.push(session);
    state.activeSessionId = session.id;
    state.displaySessionId = session.id;
    addEvent(session, {
      type: 'START', button: 'START', beforeSpeed: null, afterSpeed: state.settings.speed,
      beforeIncline: null, afterIncline: state.settings.incline, candidateTimer: '시작',
      confirmed: '해당 없음', memo: '새 세션 시작'
    }, now);
    saveState();
    renderAll();
    showToast('새 세션을 시작했습니다. 최근 화면 로그가 새 세션으로 교체되었습니다.');
  }

  function stopSession() {
    const session = activeSession();
    if (!session) return;
    const now = Date.now();

    if (session.pending) {
      if (session.activeSegment) finalizeActiveSegment(session, session.pending.transitionStartedAt, 'transition-stop');
      session.pending = null;
    } else if (session.activeSegment) {
      finalizeActiveSegment(session, now, 'stop');
    }

    addEvent(session, {
      type: 'STOP', button: 'STOP', beforeSpeed: state.settings.speed, afterSpeed: state.settings.speed,
      beforeIncline: state.settings.incline, afterIncline: state.settings.incline,
      candidateTimer: '종료', confirmed: '해당 없음', memo: '세션 종료'
    }, now);
    session.endAt = now;
    session.modifiedAt = now;
    session.status = 'completed';
    session.activeSegment = null;
    session.pending = null;
    state.activeSessionId = null;
    saveState({ immediate: true });
    renderAll();
    showToast('세션을 종료했습니다. 최근 로그는 다음 START 전까지 유지됩니다.');
  }

  function adjustValue(control, delta) {
    if (!state) return;
    const key = control === 'speed' ? 'speed' : 'incline';
    const min = key === 'speed' ? 0.3 : 0.0;
    const max = key === 'speed' ? 20.0 : 16.0;
    const before = state.settings[key];
    const after = clamp(round1(before + delta), min, max);
    if (after === before) return;
    state.settings[key] = after;
    const session = activeSession();
    if (session) handleSettingChange(session, key, before, after);
    saveState();
    renderControls();
    renderStability();
  }

  function handleSettingChange(session, key, before, after) {
    const now = Date.now();
    const beforeSpeed = key === 'speed' ? before : state.settings.speed;
    const afterSpeed = state.settings.speed;
    const beforeIncline = key === 'incline' ? before : state.settings.incline;
    const afterIncline = state.settings.incline;

    addEvent(session, {
      type: 'VALUE_CHANGE',
      button: `${key === 'speed' ? '속도' : '경사'} ${after > before ? '+' : '-'}`,
      beforeSpeed, afterSpeed, beforeIncline, afterIncline,
      candidateTimer: '재시작', confirmed: '아니오', memo: '최종값 유지시간 재측정'
    }, now);

    if (session.activeSegment && sameSetting(session.activeSegment, state.settings)) {
      session.pending = null;
      session.modifiedAt = now;
      return;
    }

    const transitionStartedAt = session.pending
      ? session.pending.transitionStartedAt
      : (session.activeSegment ? now : session.startAt);

    session.pending = {
      speed: state.settings.speed,
      incline: state.settings.incline,
      transitionStartedAt,
      candidateStartedAt: now
    };
    session.modifiedAt = now;
  }

  function tick() {
    if (!state) return;
    const session = activeSession();
    if (session?.pending) {
      const stableMs = state.settings.stableSeconds * 1000;
      if (Date.now() - session.pending.candidateStartedAt >= stableMs) confirmPendingSegment(session);
    }
    if (!session) {
      const idleMs = Date.now() - lastActivityAt;
      if (idleMs >= state.settings.autoLockMinutes * 60000) {
        lockVault('자동 잠금');
        return;
      }
    }
    renderClock();
    renderStability();
    renderDisplayedLog();
    renderLiveSummary();
  }

  function confirmPendingSegment(session) {
    const pending = session.pending;
    if (!pending) return;
    const confirmedAt = pending.candidateStartedAt + state.settings.stableSeconds * 1000;

    if (session.activeSegment) finalizeActiveSegment(session, pending.transitionStartedAt, 'change');

    session.activeSegment = {
      speed: pending.speed,
      incline: pending.incline,
      startAt: pending.transitionStartedAt,
      confirmedAt
    };
    session.pending = null;
    session.modifiedAt = confirmedAt;
    addEvent(session, {
      type: 'SEGMENT_CONFIRMED', button: '자동 확정',
      beforeSpeed: pending.speed, afterSpeed: pending.speed,
      beforeIncline: pending.incline, afterIncline: pending.incline,
      candidateTimer: `${state.settings.stableSeconds}초 충족`, confirmed: '예', memo: '유효 구간 시작 확정'
    }, confirmedAt);
    saveState({ immediate: true });
    renderAll();
  }

  function finalizeActiveSegment(session, endAt, reason) {
    const active = session.activeSegment;
    if (!active) return;
    if (endAt <= active.startAt) {
      session.activeSegment = null;
      return;
    }
    const durationSec = (endAt - active.startAt) / 1000;
    if (durationSec < state.settings.stableSeconds) {
      session.activeSegment = null;
      return;
    }
    session.segments.push({
      id: `${session.id}-SEG-${String(session.segments.length + 1).padStart(2, '0')}`,
      number: session.segments.length + 1,
      startAt: active.startAt,
      endAt,
      confirmedAt: active.confirmedAt,
      speed: active.speed,
      incline: active.incline,
      reason,
      modifiedAt: Date.now()
    });
    session.activeSegment = null;
    session.modifiedAt = Date.now();
  }

  function addEvent(session, event, at) {
    session.events.push({
      id: `${session.id}-EVT-${String(session.events.length + 1).padStart(4, '0')}`,
      at,
      ...event
    });
    session.modifiedAt = Math.max(session.modifiedAt || 0, at);
  }

  function sessionMetrics(session, includeLive = true) {
    const rows = [...(session?.segments || [])];
    if (includeLive && session) {
      if (session.activeSegment) {
        // 새 설정을 확인하는 동안 기존 확정 구간은 첫 변경 입력 시각까지만 계산합니다.
        const endAt = session.pending ? session.pending.transitionStartedAt : Date.now();
        if (endAt > session.activeSegment.startAt) {
          rows.push({ ...session.activeSegment, endAt, number: rows.length + 1, live: !session.pending });
        }
      }
      if (session.pending) {
        // 첫 변경 입력부터 새 최종값 후보 구간으로 즉시 표시·누적합니다.
        // 마지막 입력값이 10초 유지되면, 여러 번 조절한 전환 시간까지 최종값 구간에 포함해 공백 없이 확정합니다.
        const endAt = Date.now();
        if (endAt > session.pending.transitionStartedAt) {
          rows.push({
            number: rows.length + 1,
            startAt: session.pending.transitionStartedAt,
            endAt,
            speed: session.pending.speed,
            incline: session.pending.incline,
            pending: true,
            live: false
          });
        }
      }
    }
    const validSeconds = rows.reduce((sum, segment) => sum + Math.max(0, segment.endAt - segment.startAt) / 1000, 0);
    const distance = rows.reduce((sum, segment) => sum + segment.speed * ((segment.endAt - segment.startAt) / 3600000), 0);
    const inclineWeighted = rows.reduce((sum, segment) => sum + segment.incline * ((segment.endAt - segment.startAt) / 1000), 0);
    return {
      rows,
      validSeconds,
      distance,
      averageSpeed: validSeconds > 0 ? distance / (validSeconds / 3600) : 0,
      averageIncline: validSeconds > 0 ? inclineWeighted / validSeconds : 0,
      maxSpeed: rows.length ? Math.max(...rows.map(row => row.speed)) : 0,
      maxIncline: rows.length ? Math.max(...rows.map(row => row.incline)) : 0,
      ascent: rows.reduce((sum, segment) => sum + segment.speed * ((segment.endAt - segment.startAt) / 3600000) * 1000 * segment.incline / 100, 0)
    };
  }

  function previousSessionMetrics(referenceSession = displayedSession()) {
    const cutoff = referenceSession?.startAt ?? Number.POSITIVE_INFINITY;
    const sessions = completedSessions()
      .filter(session => session.id !== referenceSession?.id && session.startAt < cutoff)
      .sort((a, b) => a.startAt - b.startAt);
    let totalSeconds = 0;
    let totalDistance = 0;
    let weightedIncline = 0;
    sessions.forEach(session => {
      const metrics = sessionMetrics(session, false);
      totalSeconds += metrics.validSeconds;
      totalDistance += metrics.distance;
      weightedIncline += metrics.averageIncline * metrics.validSeconds;
    });
    return {
      sessions,
      totalSeconds,
      totalDistance,
      averageDuration: sessions.length ? totalSeconds / sessions.length : 0,
      averageDistance: sessions.length ? totalDistance / sessions.length : 0,
      averageSpeed: totalSeconds > 0 ? totalDistance / (totalSeconds / 3600) : 0,
      averageIncline: totalSeconds > 0 ? weightedIncline / totalSeconds : 0
    };
  }

  function completedSessions() {
    return state.sessions.filter(session => session.status === 'completed' && session.endAt);
  }

  function dashboardMetrics(period, anchorKey) {
    const bounds = periodBounds(period, anchorKey);
    const sessions = completedSessions().filter(session => session.dateKst >= bounds.start && session.dateKst <= bounds.end);
    const dates = new Set(sessions.map(session => session.dateKst));
    let totalSeconds = 0;
    let totalDistance = 0;
    let weightedIncline = 0;
    sessions.forEach(session => {
      const metrics = sessionMetrics(session, false);
      totalSeconds += metrics.validSeconds;
      totalDistance += metrics.distance;
      weightedIncline += metrics.averageIncline * metrics.validSeconds;
    });
    return {
      bounds,
      sessions,
      participationDays: dates.size,
      totalSeconds,
      totalDistance,
      averageSpeed: totalSeconds > 0 ? totalDistance / (totalSeconds / 3600) : 0,
      averageIncline: totalSeconds > 0 ? weightedIncline / totalSeconds : 0,
      averageDistancePerDay: dates.size > 0 ? totalDistance / dates.size : 0
    };
  }

  function setDashboardPeriod(period) {
    state.dashboard.period = period;
    state.dashboard.anchor = kstDateKey(Date.now());
    saveState();
    renderDashboard();
  }

  function shiftDashboard(direction) {
    const date = dateFromKey(state.dashboard.anchor);
    if (state.dashboard.period === 'day') date.setUTCDate(date.getUTCDate() + direction);
    if (state.dashboard.period === 'week') date.setUTCDate(date.getUTCDate() + 7 * direction);
    if (state.dashboard.period === 'month') date.setUTCMonth(date.getUTCMonth() + direction);
    state.dashboard.anchor = keyFromDate(date);
    saveState();
    renderDashboard();
  }

  function periodBounds(period, anchorKey) {
    const anchor = dateFromKey(anchorKey);
    if (period === 'day') return { start: anchorKey, end: anchorKey };
    if (period === 'week') {
      const day = anchor.getUTCDay();
      const offset = day === 0 ? -6 : 1 - day;
      const start = new Date(anchor);
      start.setUTCDate(anchor.getUTCDate() + offset);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return { start: keyFromDate(start), end: keyFromDate(end) };
    }
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    return { start: keyFromDate(start), end: keyFromDate(end) };
  }

  function renderAll() {
    if (!state) return;
    renderControls();
    renderSessionState();
    renderClock();
    renderStability();
    renderDisplayedLog();
    renderPreviousComparison();
    renderLiveSummary();
    renderDashboard();
    renderStorageState('saved');
  }

  function renderControls() {
    els.speedValue.textContent = state.settings.speed.toFixed(1);
    els.inclineValue.textContent = state.settings.incline.toFixed(1);
    els.paceValue.textContent = `${formatPace(state.settings.speed)} /km`;
  }

  function renderSessionState() {
    const active = activeSession();
    const display = displayedSession();
    els.startButton.disabled = Boolean(active);
    els.stopButton.disabled = !active;
    els.sessionHeading.textContent = active ? '운동 진행 중' : (display?.status === 'completed' ? '현재 세션 완료' : '운동 준비');
    els.sessionIdBadge.textContent = active?.id || display?.id || '세션 없음';
    els.sessionDate.textContent = active
      ? `${formatKstDate(active.startAt)} 시작`
      : (display?.endAt ? `${formatKstDate(display.endAt)} 종료` : '한국시간');
    els.heroStatusTitle.textContent = active ? '현재 세션을 기록하고 있습니다' : (display ? '현재 세션 기록을 확인하고 있습니다' : '새 세션을 시작할 수 있습니다');
    els.heroStatusText.textContent = active
      ? `마지막 입력값을 ${state.settings.stableSeconds}초 유지하면 대기 시간과 거리부터 새 구간에 포함합니다.`
      : (display ? '다음 START를 누르면 화면이 새로운 현재 세션으로 교체됩니다.' : 'START를 누르면 새 현재 세션 기록을 시작합니다.');
  }

  function renderClock() {
    const active = activeSession();
    const display = displayedSession();
    let seconds = 0;
    if (active) seconds = (Date.now() - active.startAt) / 1000;
    else if (display?.endAt) seconds = (display.endAt - display.startAt) / 1000;
    els.sessionClock.textContent = formatDuration(seconds);
  }

  function renderStability() {
    const session = activeSession();
    const required = state.settings.stableSeconds;
    if (!session) {
      els.stabilityPanel.dataset.state = 'idle';
      els.stabilityTitle.textContent = '설정값 대기';
      els.stabilityText.textContent = `START 후 현재 값이 ${required}초 유지되면 첫 구간이 확정됩니다.`;
      els.stabilityProgress.style.width = '0%';
      els.stabilitySeconds.textContent = `0 / ${required}초`;
      return;
    }
    if (session.pending) {
      const elapsed = Math.max(0, (Date.now() - session.pending.candidateStartedAt) / 1000);
      const percent = Math.min(100, elapsed / required * 100);
      els.stabilityPanel.dataset.state = session.activeSegment ? 'transition' : 'idle';
      els.stabilityTitle.textContent = session.activeSegment ? '새 설정 확인 중' : '첫 구간 확인 중';
      els.stabilityText.textContent = `${session.pending.speed.toFixed(1)} km/h · 경사 ${session.pending.incline.toFixed(1)}% 확인 중 · 완료되면 대기 시간부터 누적합니다.`;
      els.stabilityProgress.style.width = `${percent}%`;
      els.stabilitySeconds.textContent = `${Math.min(required, Math.floor(elapsed))} / ${required}초`;
      return;
    }
    if (session.activeSegment) {
      els.stabilityPanel.dataset.state = 'confirmed';
      els.stabilityTitle.textContent = '현재 구간 확정';
      els.stabilityText.textContent = `${session.activeSegment.speed.toFixed(1)} km/h · 경사 ${session.activeSegment.incline.toFixed(1)}% 구간을 기록하고 있습니다.`;
      els.stabilityProgress.style.width = '100%';
      els.stabilitySeconds.textContent = '확정';
    }
  }

  function renderDisplayedLog() {
    const session = displayedSession();
    els.segmentTableBody.innerHTML = '';
    if (!session) {
      els.emptyLog.hidden = false;
      els.logSubtitle.textContent = '현재 세션을 시작하면 구간별 로그가 표시됩니다.';
      els.logElapsedTime.textContent = '00:00:00';
      els.logAccumulatedDistance.textContent = state ? '0.000 km' : '—';
      return;
    }

    const includeLive = session.status === 'active';
    const metrics = sessionMetrics(session, includeLive);
    els.logElapsedTime.textContent = formatDuration(metrics.validSeconds);
    els.logAccumulatedDistance.textContent = `${metrics.distance.toFixed(3)} km`;
    els.logSubtitle.textContent = `${session.id} · ${includeLive ? '진행 중' : `${formatKstTime(session.startAt)}–${formatKstTime(session.endAt)}`}`;

    const displayRows = [...metrics.rows];

    if (!displayRows.length) {
      els.emptyLog.hidden = false;
      return;
    }

    els.emptyLog.hidden = true;
    displayRows.forEach((segment, index) => {
      const durationSec = Math.max(0, (segment.endAt - segment.startAt) / 1000);
      const distance = segment.speed * durationSec / 3600;
      const pendingElapsed = Math.min(state.settings.stableSeconds, Math.floor(durationSec));
      const status = segment.pending
        ? `${pendingElapsed}/${state.settings.stableSeconds}초 확인 중`
        : (segment.live ? '기록 중' : '확정');
      const endLabel = segment.pending || segment.live ? '진행 중' : formatKstTime(segment.endAt);
      const row = document.createElement('tr');
      if (segment.pending) row.classList.add('is-pending');
      row.innerHTML = `
        <td data-label="구간">${index + 1}</td>
        <td data-label="지속시간"><strong>${formatDuration(durationSec)}</strong></td>
        <td data-label="속도"><strong>${segment.speed.toFixed(1)} km/h</strong></td>
        <td data-label="경사">${segment.incline.toFixed(1)}%</td>
        <td data-label="거리">${distance.toFixed(3)} km</td>
        <td data-label="시작">${formatKstTime(segment.startAt)}</td>
        <td data-label="종료">${endLabel}</td>
        <td data-label="페이스">${formatPace(segment.speed)}/km</td>
        <td data-label="상태">${status}</td>`;
      els.segmentTableBody.appendChild(row);
    });
  }

  function renderPreviousComparison() {
    if (!state) return;
    const referenceSession = displayedSession();
    const metrics = previousSessionMetrics(referenceSession);
    els.previousSessionCount.textContent = `${metrics.sessions.length}회`;
    els.previousTotalDuration.textContent = formatDuration(metrics.totalSeconds);
    els.previousTotalDistance.textContent = `${metrics.totalDistance.toFixed(3)} km`;
    els.previousAverageDuration.textContent = formatDuration(metrics.averageDuration);
    els.previousAverageDistance.textContent = `${metrics.averageDistance.toFixed(3)} km`;
    els.previousAverageSettings.textContent = `${metrics.averageSpeed.toFixed(1)} km/h · ${metrics.averageIncline.toFixed(1)}%`;
    els.previousComparisonSubtitle.textContent = metrics.sessions.length
      ? `${formatKstDate(metrics.sessions[0].startAt)}부터 이번 세션 직전까지의 완료 기록`
      : '이번 세션 전에 완료된 기록이 없습니다.';
  }

  function renderLiveSummary() {
    const session = displayedSession();
    const metrics = session ? sessionMetrics(session, session.status === 'active') : sessionMetrics(null, false);
    els.liveSegments.textContent = `${metrics.rows.filter(row => !row.pending).length}개`;
    els.liveValidDuration.textContent = `${formatDuration(metrics.validSeconds)} · ${(metrics.validSeconds / 60).toFixed(1)}분`;
    els.liveDistance.textContent = `${metrics.distance.toFixed(3)} km`;
    els.liveAverageSpeed.textContent = `${metrics.averageSpeed.toFixed(1)} km/h`;
    els.liveAverageIncline.textContent = `${metrics.averageIncline.toFixed(1)}%`;
  }

  function renderDashboard() {
    const period = state.dashboard.period;
    const anchor = state.dashboard.anchor;
    const metrics = dashboardMetrics(period, anchor);
    els.periodTabs.forEach(button => {
      const active = button.dataset.period === period;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });

    if (period === 'day') {
      els.periodLabel.textContent = KST_DAY.format(new Date(`${metrics.bounds.start}T12:00:00+09:00`));
      els.periodSubLabel.textContent = metrics.bounds.start;
      els.participationLabel.textContent = '러닝 횟수';
      els.metricSessions.textContent = metrics.sessions.length;
      els.metricSessionsUnit.textContent = '세션';
      els.averageLabel.textContent = '평균 거리';
      els.metricAverage.textContent = metrics.sessions.length ? (metrics.totalDistance / metrics.sessions.length).toFixed(2) : '0.00';
      els.metricAverageUnit.textContent = 'km / 세션';
    } else if (period === 'week') {
      els.periodLabel.textContent = `${metrics.bounds.start.slice(5)} – ${metrics.bounds.end.slice(5)}`;
      els.periodSubLabel.textContent = '월요일–일요일';
      els.participationLabel.textContent = '참여일 · 횟수';
      els.metricSessions.textContent = `${metrics.participationDays} · ${metrics.sessions.length}`;
      els.metricSessionsUnit.textContent = '일 · 세션';
      els.averageLabel.textContent = '참여일 평균거리';
      els.metricAverage.textContent = metrics.averageDistancePerDay.toFixed(2);
      els.metricAverageUnit.textContent = 'km / 참여일';
    } else {
      els.periodLabel.textContent = KST_MONTH.format(new Date(`${metrics.bounds.start}T12:00:00+09:00`));
      els.periodSubLabel.textContent = `${metrics.bounds.start} – ${metrics.bounds.end}`;
      els.participationLabel.textContent = '참여일 · 횟수';
      els.metricSessions.textContent = `${metrics.participationDays} · ${metrics.sessions.length}`;
      els.metricSessionsUnit.textContent = '일 · 세션';
      els.averageLabel.textContent = '참여일 평균거리';
      els.metricAverage.textContent = metrics.averageDistancePerDay.toFixed(2);
      els.metricAverageUnit.textContent = 'km / 참여일';
    }

    els.metricDuration.textContent = (metrics.totalSeconds / 60).toFixed(1);
    els.metricDistance.textContent = metrics.totalDistance.toFixed(2);
    els.metricSpeed.textContent = metrics.averageSpeed.toFixed(1);
    els.metricIncline.textContent = metrics.averageIncline.toFixed(1);
    drawTrend(period, anchor);
  }

  function drawTrend(period, anchor) {
    const canvas = els.trendCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width || 600));
    const height = Math.max(110, Math.floor(rect.height || 132));
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const points = trendPoints(period, anchor);
    const values = points.map(point => point.value);
    const max = Math.max(1, ...values);
    const pad = { left: 10, right: 10, top: 14, bottom: 23 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    ctx.strokeStyle = '#e5dff0';
    ctx.lineWidth = 1;
    [0, .5, 1].forEach(ratio => {
      const y = pad.top + innerH * ratio;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    });

    const coordinates = points.map((point, index) => ({
      x: pad.left + (points.length === 1 ? innerW / 2 : index * innerW / (points.length - 1)),
      y: pad.top + innerH - (point.value / max) * innerH,
      ...point
    }));

    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + innerH);
    gradient.addColorStop(0, 'rgba(255,143,199,.25)');
    gradient.addColorStop(1, 'rgba(139,215,255,0)');
    if (coordinates.length) {
      ctx.beginPath();
      ctx.moveTo(coordinates[0].x, pad.top + innerH);
      coordinates.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.lineTo(coordinates.at(-1).x, pad.top + innerH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      coordinates.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = '#8068ce';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      coordinates.forEach(point => {
        ctx.beginPath(); ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#8068ce'; ctx.lineWidth = 2; ctx.stroke();
      });
    }

    ctx.fillStyle = '#786f8d';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    coordinates.forEach((point, index) => {
      if (index === 0 || index === coordinates.length - 1 || index === Math.floor(coordinates.length / 2)) {
        ctx.fillText(point.label, point.x, height - 5);
      }
    });

    const nonZero = values.filter(value => value > 0);
    if (!nonZero.length) els.trendSummary.textContent = '기록이 쌓이면 변화가 표시됩니다.';
    else {
      const first = nonZero[0];
      const last = nonZero.at(-1);
      const diff = last - first;
      els.trendSummary.textContent = Math.abs(diff) < .005
        ? `현재 ${last.toFixed(2)} km 수준입니다.`
        : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} km 변화했습니다.`;
    }
  }

  function trendPoints(period, anchor) {
    const base = dateFromKey(anchor);
    const count = period === 'day' ? 10 : (period === 'week' ? 8 : 7);
    const points = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const date = new Date(base);
      if (period === 'day') date.setUTCDate(base.getUTCDate() - i);
      if (period === 'week') date.setUTCDate(base.getUTCDate() - i * 7);
      if (period === 'month') date.setUTCMonth(base.getUTCMonth() - i);
      const key = keyFromDate(date);
      const metrics = dashboardMetrics(period, key);
      points.push({
        label: period === 'month' ? key.slice(2, 7) : key.slice(5),
        value: period === 'day' ? metrics.totalDistance : metrics.averageDistancePerDay
      });
    }
    return points;
  }

  function openSettings() {
    if (!state) return openAccessGate('settings');
    els.stableSecondsInput.value = 10;
    els.autoLockMinutesInput.value = state.settings.autoLockMinutes;
    els.settingsDialog.showModal();
  }

  function saveSettings() {
    state.settings.stableSeconds = 10;
    state.settings.autoLockMinutes = Math.max(1, Math.min(120, Number(els.autoLockMinutesInput.value) || 15));
    saveState({ immediate: true });
    els.settingsDialog.close();
    renderStability();
    showToast('기록 정책과 자동 잠금 설정을 암호화해 저장했습니다.');
  }

  function renderStorageState(mode) {
    if (!els.storageChip) return;
    els.storageChip.dataset.state = mode;
    if (mode === 'saving') els.storageChip.textContent = '암호화 저장 중';
    else if (mode === 'error') els.storageChip.textContent = '저장 오류';
    else els.storageChip.textContent = 'PRIVATE RECORDS ENCRYPTED';
  }

  function saveState({ immediate = false } = {}) {
    if (!state || !vaultKey) return Promise.resolve();
    state.updatedAt = Date.now();
    dirtyRevision += 1;
    renderStorageState('saving');
    if (saveTimer) window.clearTimeout(saveTimer);
    if (immediate) return flushSave();
    saveTimer = window.setTimeout(() => flushSave(), 140);
    return Promise.resolve();
  }

  async function flushSave() {
    if (!state || !vaultKey || !vaultMeta) return;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (saveLoopPromise) {
      await saveLoopPromise;
      if (persistedRevision < dirtyRevision) return flushSave();
      return;
    }

    saveLoopPromise = (async () => {
      while (persistedRevision < dirtyRevision && state && vaultKey) {
        const targetRevision = dirtyRevision;
        const snapshot = structuredClone(state);
        try {
          const envelope = await encryptState(snapshot, vaultKey, vaultMeta.salt, vaultMeta.iterations);
          await putStoredEnvelope(envelope);
          vaultMeta = envelopeMeta(envelope);
          persistedRevision = targetRevision;
          renderStorageState('saved');
        } catch (error) {
          console.error('Encrypted save failed', error);
          renderStorageState('error');
          showToast('암호화 저장에 실패했습니다. 백업을 먼저 만들어 주세요.');
          throw error;
        }
      }
    })().finally(() => { saveLoopPromise = null; });

    return saveLoopPromise;
  }

  async function exportVaultBackup() {
    if (!state) return;
    await flushSave();
    const envelope = await getStoredEnvelope();
    if (!envelope) {
      showToast('내보낼 암호화 기록이 없습니다.');
      return;
    }
    const backup = { ...envelope };
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
      'running-session-log.runlog'
    );
    showToast('비밀번호로 암호화된 .runlog 백업을 만들었습니다.');
  }

  async function handleGateImport() {
    const file = els.gateImportInput.files?.[0];
    els.gateImportInput.value = '';
    if (!file) return;
    try {
      const envelope = await readEnvelopeFile(file);
      if (hasVault && !window.confirm('현재 기기의 암호화 기록을 이 백업으로 교체하시겠습니까? 기존 기록은 먼저 내보내는 것이 안전합니다.')) return;
      await putStoredEnvelope(envelope);
      hasVault = true;
      openAccessGate('view');
      showGateError('백업을 불러왔습니다. 해당 백업의 비밀번호로 기록에 로그인하세요.');
    } catch (error) {
      console.error(error);
      showGateError(error.message || '암호화 백업 파일을 읽지 못했습니다.');
    }
  }

  async function handleMergeFileSelected() {
    const file = els.mergeVaultInput.files?.[0];
    els.mergeVaultInput.value = '';
    if (!file) return;
    try {
      pendingImportedEnvelope = await readEnvelopeFile(file);
      openPasswordDialog('merge');
    } catch (error) {
      console.error(error);
      showToast(error.message || '백업 파일을 읽지 못했습니다.');
    }
  }

  function openPasswordDialog(mode) {
    passwordDialogContext = mode;
    els.passwordDialogError.textContent = '';
    els.passwordDialogInput.value = '';
    els.newPasswordInput.value = '';
    els.newPasswordConfirmInput.value = '';
    if (mode === 'merge') {
      els.passwordDialogTitle.textContent = '암호화 백업 병합';
      els.passwordDialogDescription.textContent = '선택한 백업을 열 수 있는 비밀번호를 입력하세요. 완료된 세션만 현재 암호화 기록에 병합합니다.';
      els.newPasswordFields.hidden = true;
      els.passwordDialogSubmit.textContent = '백업 병합';
    } else {
      els.passwordDialogTitle.textContent = '기록 비밀번호 변경';
      els.passwordDialogDescription.textContent = '현재 비밀번호를 확인한 뒤 새로운 비밀번호로 기록 전체를 다시 암호화합니다.';
      els.newPasswordFields.hidden = false;
      els.passwordDialogSubmit.textContent = '비밀번호 변경';
    }
    els.passwordDialog.showModal();
    window.setTimeout(() => els.passwordDialogInput.focus(), 50);
  }

  function closePasswordDialog() {
    pendingImportedEnvelope = null;
    passwordDialogContext = null;
    if (els.passwordDialog.open) els.passwordDialog.close();
  }

  async function handlePasswordDialogSubmit(event) {
    event.preventDefault();
    const password = els.passwordDialogInput.value;
    els.passwordDialogError.textContent = '';
    els.passwordDialogSubmit.disabled = true;
    try {
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error('비밀번호가 너무 짧습니다.');
      if (passwordDialogContext === 'merge') {
        if (!pendingImportedEnvelope) throw new Error('선택된 백업 파일이 없습니다.');
        const imported = await decryptEnvelope(pendingImportedEnvelope, password);
        const result = mergeImportedState(imported.state);
        saveState({ immediate: true });
        closePasswordDialog();
        renderAll();
        showToast(`${result.added}개 완료 세션을 병합했습니다${result.skipped ? ` · 진행 중 세션 ${result.skipped}개 제외` : ''}.`);
      } else if (passwordDialogContext === 'change') {
        const currentEnvelope = await getStoredEnvelope();
        if (!currentEnvelope) throw new Error('현재 암호화 기록을 찾지 못했습니다.');
        await decryptEnvelope(currentEnvelope, password);
        const nextPassword = els.newPasswordInput.value;
        if (nextPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
        if (nextPassword !== els.newPasswordConfirmInput.value) throw new Error('새 비밀번호 확인이 일치하지 않습니다.');
        await reencryptWithNewPassword(nextPassword);
        closePasswordDialog();
        showToast('새 비밀번호로 기록 전체를 다시 암호화했습니다.');
      }
    } catch (error) {
      console.error(error);
      els.passwordDialogError.textContent = error.message || '비밀번호 확인에 실패했습니다.';
    } finally {
      els.passwordDialogSubmit.disabled = false;
    }
  }

  function mergeImportedState(importedStateInput) {
    const importedState = normalizeState(importedStateInput);
    const completed = importedState.sessions.filter(session => session.status === 'completed' && session.endAt);
    const skipped = importedState.sessions.length - completed.length;
    const byId = new Map(state.sessions.map(session => [session.id, session]));
    let added = 0;
    completed.forEach(session => {
      const existing = byId.get(session.id);
      if (!existing) {
        byId.set(session.id, session);
        added += 1;
        return;
      }
      const existingTime = existing.modifiedAt || existing.endAt || existing.startAt || 0;
      const importedTime = session.modifiedAt || session.endAt || session.startAt || 0;
      if (importedTime > existingTime) byId.set(session.id, session);
    });
    state.sessions = [...byId.values()].sort((a, b) => a.startAt - b.startAt);
    if (!state.displaySessionId) {
      const latest = state.sessions.filter(session => session.status === 'completed').sort((a, b) => b.endAt - a.endAt)[0];
      state.displaySessionId = latest?.id || null;
    }
    state.updatedAt = Date.now();
    return { added, skipped };
  }

  async function reencryptWithNewPassword(newPassword) {
    await flushSave();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await deriveKey(newPassword, salt, KDF_ITERATIONS);
    const envelope = await encryptState(structuredClone(state), key, salt, KDF_ITERATIONS);
    await putStoredEnvelope(envelope);
    vaultKey = key;
    vaultMeta = envelopeMeta(envelope);
    dirtyRevision = 0;
    persistedRevision = 0;
  }

  async function deleteLocalVault() {
    const confirmation = window.prompt('완전히 삭제하려면 DELETE를 입력하세요. 암호화 백업이 없으면 복구할 수 없습니다.');
    if (confirmation !== 'DELETE') return;
    await deleteStoredEnvelope();
    state = null;
    vaultKey = null;
    vaultMeta = null;
    hasVault = false;
    dirtyRevision = 0;
    persistedRevision = 0;
    els.settingsDialog.close();
    showPublicApp();
    showToast('이 기기의 암호화 기록을 완전히 삭제했습니다.');
  }

  function exportDisplayedSessionCsv() {
    const session = displayedSession();
    if (!session) {
      showToast('내보낼 세션이 없습니다.');
      return;
    }
    const metrics = sessionMetrics(session, session.status === 'active');
    const headers = ['세션 ID','구간','시작(KST)','종료(KST)','지속시간','지속시간(분)','속도(km/h)','페이스','경사(%)','거리(km)','상태'];
    const rows = metrics.rows.map((segment, index) => {
      const seconds = (segment.endAt - segment.startAt) / 1000;
      return [
        session.id, index + 1, formatKstFull(segment.startAt), segment.live ? '진행 중' : formatKstFull(segment.endAt),
        formatDuration(seconds), (seconds / 60).toFixed(3), segment.speed.toFixed(1), `${formatPace(segment.speed)}/km`,
        segment.incline.toFixed(1), (segment.speed * seconds / 3600).toFixed(5), segment.live ? '기록 중' : '확정'
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), `${session.id}.csv`);
    showToast('CSV는 평문 파일입니다. 공유 위치에 주의해 주세요.');
  }

  async function deriveKey(password, salt, iterations) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: KDF_HASH },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptState(stateSnapshot, key, salt, iterations) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const payload = {
      magic: VAULT_FORMAT,
      version: VAULT_VERSION,
      savedAt: Date.now(),
      state: stateSnapshot
    };
    const additionalData = new TextEncoder().encode(`${VAULT_FORMAT}:${VAULT_VERSION}`);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    );
    return {
      key: VAULT_RECORD_KEY,
      format: VAULT_FORMAT,
      version: VAULT_VERSION,
      kdf: { name: 'PBKDF2', hash: KDF_HASH, iterations, salt: bytesToBase64(salt) },
      cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    };
  }

  async function decryptEnvelope(envelope, password) {
    validateEnvelope(envelope);
    const salt = base64ToBytes(envelope.kdf.salt);
    const iv = base64ToBytes(envelope.cipher.iv);
    const key = await deriveKey(password, salt, envelope.kdf.iterations);
    const additionalData = new TextEncoder().encode(`${VAULT_FORMAT}:${VAULT_VERSION}`);
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData },
        key,
        base64ToBytes(envelope.ciphertext)
      );
    } catch (error) {
      throw new Error('비밀번호가 올바르지 않거나 백업 파일이 손상되었습니다.');
    }
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    if (payload.magic !== VAULT_FORMAT || payload.version !== VAULT_VERSION || !payload.state) {
      throw new Error('지원하지 않는 암호화 기록 형식입니다.');
    }
    return { key, state: payload.state };
  }

  function validateEnvelope(envelope) {
    const valid = envelope && envelope.format === VAULT_FORMAT && envelope.version === VAULT_VERSION
      && envelope.kdf?.name === 'PBKDF2' && envelope.kdf?.hash === KDF_HASH
      && Number.isInteger(envelope.kdf?.iterations) && envelope.kdf.iterations >= 100000
      && typeof envelope.kdf?.salt === 'string'
      && envelope.cipher?.name === 'AES-GCM' && typeof envelope.cipher?.iv === 'string'
      && typeof envelope.ciphertext === 'string';
    if (!valid) throw new Error('올바른 .runlog 암호화 백업 파일이 아닙니다.');
  }

  function envelopeMeta(envelope) {
    return {
      salt: base64ToBytes(envelope.kdf.salt),
      iterations: envelope.kdf.iterations
    };
  }

  async function readEnvelopeFile(file) {
    if (file.size > 50 * 1024 * 1024) throw new Error('백업 파일이 너무 큽니다.');
    const envelope = JSON.parse(await file.text());
    validateEnvelope(envelope);
    return envelope;
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB를 열지 못했습니다.'));
    });
    return dbPromise;
  }

  async function getStoredEnvelope() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(VAULT_RECORD_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('암호화 기록을 읽지 못했습니다.'));
    });
  }

  async function putStoredEnvelope(envelope) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ ...envelope, key: VAULT_RECORD_KEY });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('암호화 기록을 저장하지 못했습니다.'));
      transaction.onabort = () => reject(transaction.error || new Error('암호화 기록 저장이 중단되었습니다.'));
    });
  }

  async function deleteStoredEnvelope() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(VAULT_RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('암호화 기록을 삭제하지 못했습니다.'));
    });
  }

  async function requestPersistentStorage() {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch (error) {
      console.warn('Persistent storage request failed', error);
    }
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 3000);
  }

  function sameSetting(segment, settings) {
    return segment.speed === settings.speed && segment.incline === settings.incline;
  }

  function round1(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function kstDateKey(timestamp) { return KST_DATE.format(new Date(timestamp)); }
  function formatKstDate(timestamp) { return KST_DAY.format(new Date(timestamp)); }
  function formatKstTime(timestamp) { return KST_TIME.format(new Date(timestamp)).replace('24:', '00:'); }
  function formatKstFull(timestamp) { return KST_FULL.format(new Date(timestamp)).replace('24:', '00:'); }
  function dateFromKey(key) { return new Date(`${key}T00:00:00Z`); }
  function keyFromDate(date) { return date.toISOString().slice(0, 10); }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
  }

  function formatPace(speed) {
    if (!speed || speed <= 0) return '--:--';
    const totalSeconds = Math.round(3600 / speed);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function compactKstTimestamp(timestamp) {
    return formatKstFull(timestamp).replace(/[^0-9]/g, '').slice(0, 14);
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }
})();
