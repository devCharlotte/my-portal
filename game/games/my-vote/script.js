'use strict';

const STORAGE_KEY = 'classElectionMiniGame.v1';

const $ = (id) => document.getElementById(id);

const els = {
  todayLabel: $('todayLabel'),
  startBtn: $('startBtn'),
  restoreBtn: $('restoreBtn'),
  startActions: $('startActions'),
  setupSection: $('setupSection'),
  lobbySection: $('lobbySection'),
  boothSection: $('boothSection'),
  countSection: $('countSection'),
  electionTitleInput: $('electionTitleInput'),
  adminCodeInput: $('adminCodeInput'),
  candidateNameInput: $('candidateNameInput'),
  addCandidateBtn: $('addCandidateBtn'),
  candidateSetupList: $('candidateSetupList'),
  beginElectionBtn: $('beginElectionBtn'),
  sampleCandidateBtn: $('sampleCandidateBtn'),
  lobbyTitle: $('lobbyTitle'),
  lobbySubtitle: $('lobbySubtitle'),
  issuedCount: $('issuedCount'),
  castCount: $('castCount'),
  candidateCount: $('candidateCount'),
  issueBallotBtn: $('issueBallotBtn'),
  enterBoothBtn: $('enterBoothBtn'),
  openCountBtn: $('openCountBtn'),
  printedPaper: $('printedPaper'),
  printMessage: $('printMessage'),
  ballotNoLabel: $('ballotNoLabel'),
  ballotSheet: $('ballotSheet'),
  castVoteBtn: $('castVoteBtn'),
  cancelVoteBtn: $('cancelVoteBtn'),
  adminModal: $('adminModal'),
  adminCodeCheckInput: $('adminCodeCheckInput'),
  confirmAdminBtn: $('confirmAdminBtn'),
  closeAdminModalBtn: $('closeAdminModalBtn'),
  backToLobbyBtn: $('backToLobbyBtn'),
  resetElectionBtn: $('resetElectionBtn'),
  openedBallot: $('openedBallot'),
  openOneBtn: $('openOneBtn'),
  showFinalBtn: $('showFinalBtn'),
  resetRevealBtn: $('resetRevealBtn'),
  downloadCsvBtn: $('downloadCsvBtn'),
  resultBoard: $('resultBoard'),
  toast: $('toast'),
};

let setupCandidates = [];
let selectedCandidateId = null;
let toastTimer = null;

let state = loadState() || createEmptyState();

function createEmptyState() {
  return {
    version: 1,
    electionTitle: '우리 반 반장선거',
    adminCode: '0000',
    candidates: [],
    ballots: [],
    nextBallotNo: 1,
    currentBallot: null,
    revealIndex: 0,
    startedAt: null,
    updatedAt: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function showOnly(section) {
  [els.setupSection, els.lobbySection, els.boothSection, els.countSection].forEach((el) => el.classList.add('hidden'));
  if (section) section.classList.remove('hidden');
}

function setDateLabel() {
  els.todayLabel.textContent = 'Created Jun 3, 2026';
}

function renderSetupCandidates() {
  els.candidateSetupList.innerHTML = '';

  if (setupCandidates.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'candidate-chip';
    empty.textContent = '아직 등록된 후보가 없습니다.';
    els.candidateSetupList.appendChild(empty);
    return;
  }

  setupCandidates.forEach((name, index) => {
    const chip = document.createElement('div');
    chip.className = 'candidate-chip';

    const text = document.createElement('span');
    text.textContent = `${index + 1}. ${name}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `${name} 후보 삭제`);
    removeBtn.addEventListener('click', () => {
      setupCandidates.splice(index, 1);
      renderSetupCandidates();
    });

    chip.append(text, removeBtn);
    els.candidateSetupList.appendChild(chip);
  });
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function addCandidateFromInput() {
  const name = normalizeName(els.candidateNameInput.value);
  if (!name) {
    showToast('후보자 이름을 입력해주세요.');
    return;
  }
  const duplicated = setupCandidates.some((item) => item.toLowerCase() === name.toLowerCase());
  if (duplicated) {
    showToast('이미 등록된 후보입니다.');
    return;
  }
  setupCandidates.push(name);
  els.candidateNameInput.value = '';
  els.candidateNameInput.focus();
  renderSetupCandidates();
}

function beginElection() {
  const title = normalizeName(els.electionTitleInput.value) || '우리 반 반장선거';
  const code = els.adminCodeInput.value.trim() || '0000';

  if (setupCandidates.length < 2) {
    showToast('후보자는 최소 2명 이상 필요합니다.');
    return;
  }

  state = createEmptyState();
  state.electionTitle = title;
  state.adminCode = code;
  state.candidates = setupCandidates.map((name, index) => ({
    id: `cand-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    name,
  }));
  state.startedAt = new Date().toISOString();
  saveState();
  els.startActions.classList.add('hidden');
  renderLobby();
  showOnly(els.lobbySection);
  showToast('선거가 시작되었습니다. 투표용지를 발급해주세요.');
}

function renderLobby() {
  els.lobbyTitle.textContent = state.electionTitle;
  els.lobbySubtitle.textContent = state.currentBallot
    ? `투표용지 #${state.currentBallot.number}가 발급되었습니다. 투표소로 들어가 주세요.`
    : '투표용지를 발급한 뒤 투표하기 버튼을 눌러주세요.';
  els.issuedCount.textContent = String(Math.max(state.nextBallotNo - 1, state.ballots.length));
  els.castCount.textContent = String(state.ballots.length);
  els.candidateCount.textContent = String(state.candidates.length);
  els.enterBoothBtn.disabled = !state.currentBallot;
  els.issueBallotBtn.disabled = Boolean(state.currentBallot);

  if (state.currentBallot) {
    els.printedPaper.classList.add('show');
    els.printMessage.textContent = `투표용지 #${state.currentBallot.number} 발급 완료`;
  } else {
    els.printedPaper.classList.remove('show');
    els.printMessage.textContent = '아직 발급된 투표용지가 없습니다.';
  }
}

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function issueBallot() {
  if (state.currentBallot) {
    showToast('이미 발급된 투표용지가 있습니다. 먼저 투표를 완료해주세요.');
    return;
  }

  const candidateOrder = shuffle(state.candidates.map((candidate) => candidate.id));
  state.currentBallot = {
    number: state.nextBallotNo,
    candidateOrder,
    issuedAt: new Date().toISOString(),
  };
  state.nextBallotNo += 1;
  saveState();

  const printer = document.querySelector('.printer');
  printer.classList.add('printing');
  els.printedPaper.classList.remove('show');
  void els.printedPaper.offsetWidth;
  els.printedPaper.classList.add('show');
  setTimeout(() => printer.classList.remove('printing'), 900);

  renderLobby();
  showToast(`투표용지 #${state.currentBallot.number}가 출력되었습니다.`);
}

function getCandidateById(id) {
  return state.candidates.find((candidate) => candidate.id === id);
}

function enterBooth() {
  if (!state.currentBallot) {
    showToast('먼저 투표용지를 발급해주세요.');
    return;
  }
  selectedCandidateId = null;
  els.castVoteBtn.disabled = true;
  els.ballotNoLabel.textContent = `투표용지 #${state.currentBallot.number}`;
  renderBallot();
  showOnly(els.boothSection);
}

function renderBallot() {
  els.ballotSheet.innerHTML = '';
  state.currentBallot.candidateOrder.forEach((candidateId, index) => {
    const candidate = getCandidateById(candidateId);
    if (!candidate) return;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = `ballot-row${selectedCandidateId === candidateId ? ' selected' : ''}`;
    row.addEventListener('click', () => selectCandidate(candidateId));

    const num = document.createElement('div');
    num.className = 'ballot-num';
    num.textContent = String(index + 1);

    const name = document.createElement('div');
    name.className = 'ballot-name';
    name.textContent = candidate.name;

    const stamp = document.createElement('div');
    stamp.className = `stamp-zone${selectedCandidateId === candidateId ? ' has-stamp' : ''}`;
    stamp.textContent = selectedCandidateId === candidateId ? '' : '도장 칸';

    row.append(num, name, stamp);
    els.ballotSheet.appendChild(row);
  });
}

function selectCandidate(candidateId) {
  selectedCandidateId = candidateId;
  els.castVoteBtn.disabled = false;
  renderBallot();
}

function castVote() {
  if (!state.currentBallot || !selectedCandidateId) {
    showToast('후보 칸에 도장을 찍어주세요.');
    return;
  }

  const ballot = {
    number: state.currentBallot.number,
    candidateId: selectedCandidateId,
    castAt: new Date().toISOString(),
  };
  state.ballots.push(ballot);
  state.currentBallot = null;
  selectedCandidateId = null;
  saveState();
  renderLobby();
  showOnly(els.lobbySection);
  showToast('투표함에 넣었습니다. 다음 학생은 새 투표용지를 발급해주세요.');
}

function openAdminModal() {
  els.adminCodeCheckInput.value = '';
  els.adminModal.classList.remove('hidden');
  setTimeout(() => els.adminCodeCheckInput.focus(), 0);
}

function closeAdminModal() {
  els.adminModal.classList.add('hidden');
}

function confirmAdmin() {
  if (els.adminCodeCheckInput.value.trim() !== state.adminCode) {
    showToast('비밀번호가 맞지 않습니다.');
    return;
  }
  closeAdminModal();
  renderCountRoom();
  showOnly(els.countSection);
}

function getTallies(limit = state.ballots.length) {
  const tallies = new Map(state.candidates.map((candidate) => [candidate.id, 0]));
  state.ballots.slice(0, limit).forEach((ballot) => {
    tallies.set(ballot.candidateId, (tallies.get(ballot.candidateId) || 0) + 1);
  });
  return tallies;
}

function getSortedResults(limit = state.ballots.length) {
  const tallies = getTallies(limit);
  return state.candidates
    .map((candidate) => ({ ...candidate, votes: tallies.get(candidate.id) || 0 }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ko-KR'));
}

function renderResultBoard(limit = state.revealIndex) {
  const total = Math.min(limit, state.ballots.length);
  const results = getSortedResults(total);
  const maxVotes = Math.max(1, ...results.map((item) => item.votes));
  els.resultBoard.innerHTML = '';

  results.forEach((candidate, index) => {
    const row = document.createElement('div');
    row.className = 'result-row';

    const rank = document.createElement('div');
    rank.className = 'rank';
    rank.textContent = String(index + 1);

    const nameBox = document.createElement('div');
    nameBox.className = 'result-name';

    const name = document.createElement('strong');
    name.textContent = candidate.name;

    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${(candidate.votes / maxVotes) * 100}%`;
    track.appendChild(bar);

    nameBox.append(name, track);

    const votes = document.createElement('div');
    votes.className = 'vote-num';
    votes.textContent = `${candidate.votes}표`;

    row.append(rank, nameBox, votes);
    els.resultBoard.appendChild(row);
  });

  if (total === state.ballots.length && state.ballots.length > 0) {
    const topVotes = results[0].votes;
    const winners = results.filter((item) => item.votes === topVotes);
    const note = document.createElement('div');
    note.className = 'winner-note';
    note.textContent = winners.length === 1
      ? `최종 결과: ${winners[0].name} 후보가 ${topVotes}표로 가장 많은 표를 받았습니다.`
      : `최종 결과: ${winners.map((item) => item.name).join(', ')} 후보가 ${topVotes}표로 공동 1위입니다.`;
    els.resultBoard.appendChild(note);
  }

  if (state.ballots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'opened-empty';
    empty.textContent = '아직 투표된 용지가 없습니다.';
    els.resultBoard.appendChild(empty);
  }
}

function renderOpenedBallot() {
  els.openedBallot.innerHTML = '';

  if (state.revealIndex === 0) {
    const empty = document.createElement('div');
    empty.className = 'opened-empty';
    empty.textContent = '아직 개표한 투표용지가 없습니다.';
    els.openedBallot.appendChild(empty);
    return;
  }

  const ballot = state.ballots[state.revealIndex - 1];
  const candidate = getCandidateById(ballot.candidateId);
  const paper = document.createElement('div');
  paper.className = 'opened-paper';
  paper.innerHTML = `
    <div class="paper-head">개표된 투표용지 #${ballot.number}</div>
    <div class="choice">${escapeHtml(candidate ? candidate.name : '알 수 없는 후보')}</div>
    <div class="stamp">투표</div>
  `;
  els.openedBallot.appendChild(paper);
}

function renderCountRoom() {
  if (state.revealIndex > state.ballots.length) state.revealIndex = state.ballots.length;
  renderOpenedBallot();
  renderResultBoard(state.revealIndex);
  els.openOneBtn.disabled = state.revealIndex >= state.ballots.length;
  els.showFinalBtn.disabled = state.ballots.length === 0;
  els.resetRevealBtn.disabled = state.revealIndex === 0;
}

function openOneBallot() {
  if (state.revealIndex >= state.ballots.length) {
    showToast('모든 투표용지를 개표했습니다.');
    return;
  }
  state.revealIndex += 1;
  saveState();
  renderCountRoom();
}

function showFinalResult() {
  state.revealIndex = state.ballots.length;
  saveState();
  renderCountRoom();
  showToast('최종 개표 결과를 표시했습니다.');
}

function resetReveal() {
  state.revealIndex = 0;
  saveState();
  renderCountRoom();
  showToast('개표 보기를 처음으로 되돌렸습니다.');
}

function resetElection() {
  const ok = window.confirm('정말 선거를 완전히 초기화할까요? 후보와 투표 기록이 모두 삭제됩니다.');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createEmptyState();
  setupCandidates = [];
  selectedCandidateId = null;
  renderSetupCandidates();
  els.startActions.classList.remove('hidden');
  showOnly(null);
  showToast('선거 데이터가 초기화되었습니다.');
}

function downloadCsv() {
  const rows = [['ballot_number', 'candidate', 'cast_at']];
  state.ballots.forEach((ballot) => {
    const candidate = getCandidateById(ballot.candidateId);
    rows.push([ballot.number, candidate ? candidate.name : 'unknown', ballot.castAt]);
  });
  rows.push([]);
  rows.push(['candidate', 'votes']);
  getSortedResults(state.ballots.length).forEach((candidate) => rows.push([candidate.name, candidate.votes]));

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.electionTitle.replace(/[\\/:*?"<>|]/g, '_')}_result.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function restoreOrWarn() {
  if (state.candidates.length === 0) {
    showToast('이어갈 선거가 없습니다. 시작하기를 눌러 후보를 등록해주세요.');
    return;
  }
  els.startActions.classList.add('hidden');
  renderLobby();
  showOnly(els.lobbySection);
}

function init() {
  setDateLabel();
  renderSetupCandidates();

  if (state.candidates.length > 0) {
    els.restoreBtn.disabled = false;
  } else {
    els.restoreBtn.disabled = true;
  }

  els.startBtn.addEventListener('click', () => {
    els.startActions.classList.add('hidden');
    setupCandidates = [];
    renderSetupCandidates();
    showOnly(els.setupSection);
  });

  els.restoreBtn.addEventListener('click', restoreOrWarn);
  els.addCandidateBtn.addEventListener('click', addCandidateFromInput);
  els.candidateNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCandidateFromInput();
  });
  els.sampleCandidateBtn.addEventListener('click', () => {
    setupCandidates = ['기호 1번 후보', '기호 2번 후보', '기호 3번 후보'];
    renderSetupCandidates();
  });
  els.beginElectionBtn.addEventListener('click', beginElection);

  els.issueBallotBtn.addEventListener('click', issueBallot);
  els.enterBoothBtn.addEventListener('click', enterBooth);
  els.cancelVoteBtn.addEventListener('click', () => {
    selectedCandidateId = null;
    renderLobby();
    showOnly(els.lobbySection);
  });
  els.castVoteBtn.addEventListener('click', castVote);

  els.openCountBtn.addEventListener('click', openAdminModal);
  els.closeAdminModalBtn.addEventListener('click', closeAdminModal);
  els.confirmAdminBtn.addEventListener('click', confirmAdmin);
  els.adminCodeCheckInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') confirmAdmin();
  });
  els.adminModal.addEventListener('click', (event) => {
    if (event.target === els.adminModal) closeAdminModal();
  });

  els.backToLobbyBtn.addEventListener('click', () => {
    renderLobby();
    showOnly(els.lobbySection);
  });
  els.resetElectionBtn.addEventListener('click', resetElection);
  els.openOneBtn.addEventListener('click', openOneBallot);
  els.showFinalBtn.addEventListener('click', showFinalResult);
  els.resetRevealBtn.addEventListener('click', resetReveal);
  els.downloadCsvBtn.addEventListener('click', downloadCsv);
}

init();
