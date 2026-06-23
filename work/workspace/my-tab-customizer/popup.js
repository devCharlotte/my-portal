'use strict';

const STORAGE_KEYS = {
  categories: 'tabCategories',
  categoryGroupMap: 'categoryGroupMap'
};

const elements = {
  iconUrl: document.querySelector('#iconUrl'),
  iconFile: document.querySelector('#iconFile'),
  urlArea: document.querySelector('#urlArea'),
  uploadArea: document.querySelector('#uploadArea'),
  uploadPreview: document.querySelector('#uploadPreview'),
  previewImage: document.querySelector('#previewImage'),
  previewName: document.querySelector('#previewName'),
  existingIconPreview: document.querySelector('#existingIconPreview'),
  existingIconBox: document.querySelector('.existing-icon-box'),
  aliasTitle: document.querySelector('#aliasTitle'),
  categorySelect: document.querySelector('#categorySelect'),
  deleteCategoryButton: document.querySelector('#deleteCategoryButton'),
  newCategoryName: document.querySelector('#newCategoryName'),
  newCategoryColor: document.querySelector('#newCategoryColor'),
  addCategoryButton: document.querySelector('#addCategoryButton'),
  applyButton: document.querySelector('#applyButton'),
  resetButton: document.querySelector('#resetButton'),
  status: document.querySelector('#status')
};

let activeTab = null;
let uploadedIconData = '';
let pageDefaults = {
  title: '',
  favicon: ''
};
let categories = [];

function setStatus(message, type = '') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`.trim();
}

function setBusy(isBusy) {
  elements.applyButton.disabled = isBusy;
  elements.resetButton.disabled = isBusy;
  elements.addCategoryButton.disabled = isBusy;
  elements.deleteCategoryButton.disabled = isBusy || !elements.categorySelect.value;
}

function selectedIconMode() {
  return document.querySelector('input[name="iconMode"]:checked')?.value || 'existing';
}

function showIconMode(mode) {
  elements.urlArea.classList.toggle('hidden', mode !== 'url');
  elements.uploadArea.classList.toggle('hidden', mode !== 'upload');
}

function chooseIconMode(mode) {
  const radio = document.querySelector(`input[name="iconMode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  showIconMode(mode);
}

function isScriptableUrl(url = '') {
  return /^https?:\/\//i.test(url) || /^file:\/\//i.test(url);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') {
    throw new Error('현재 활성 탭을 찾을 수 없습니다.');
  }
  return tab;
}

async function readCurrentPage() {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => {
      const root = document.documentElement;
      const currentFavicons = Array.from(document.querySelectorAll('link[rel*="icon"]'));
      let originalFavicon = '';

      if (Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalFavicons')) {
        try {
          const saved = JSON.parse(root.dataset.jhTabOriginalFavicons || '[]');
          const first = saved.find((item) => item && item.href);
          if (first?.href) {
            originalFavicon = new URL(first.href, document.baseURI).href;
          }
        } catch (_error) {
          originalFavicon = '';
        }
      }

      return {
        currentTitle: document.title,
        originalTitle: Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalTitle')
          ? root.dataset.jhTabOriginalTitle
          : document.title,
        currentFavicon: currentFavicons[0]?.href || '',
        originalFavicon
      };
    }
  });
  return result;
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('지원되지 않거나 손상된 이미지입니다.'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);

        const scale = Math.min(128 / image.width, 128 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (128 - width) / 2;
        const y = (128 - height) / 2;
        ctx.drawImage(image, x, y, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function applyPageCustomization(title, iconSpec) {
  const root = document.documentElement;
  const head = document.head || document.documentElement;
  const hasOriginalTitle = Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalTitle');
  const hasOriginalFavicons = Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalFavicons');

  if (!hasOriginalTitle) {
    root.dataset.jhTabOriginalTitle = document.title;
  }

  if (window.__jhTabTitleObserver) {
    window.__jhTabTitleObserver.disconnect();
  }

  let titleNode = document.querySelector('title');
  if (!titleNode) {
    titleNode = document.createElement('title');
    head.appendChild(titleNode);
  }
  titleNode.textContent = title;
  document.title = title;

  const observer = new MutationObserver(() => {
    if (document.title !== title) {
      document.title = title;
    }
  });
  observer.observe(titleNode, { childList: true, subtree: true, characterData: true });
  window.__jhTabTitleObserver = observer;

  function restoreOriginalFavicons() {
    if (!Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalFavicons')) return;

    document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
    try {
      const originalFavicons = JSON.parse(root.dataset.jhTabOriginalFavicons || '[]');
      for (const item of originalFavicons) {
        const link = document.createElement('link');
        link.rel = item.rel || 'icon';
        if (item.href) link.setAttribute('href', item.href);
        if (item.type) link.type = item.type;
        if (item.sizes) link.setAttribute('sizes', item.sizes);
        head.appendChild(link);
      }
    } catch (_error) {
      // Keep the page usable even if a previously saved value is malformed.
    }
    delete root.dataset.jhTabOriginalFavicons;
  }

  if (iconSpec?.mode === 'existing') {
    restoreOriginalFavicons();
  } else if (iconSpec?.mode) {
    if (!hasOriginalFavicons) {
      const originalFavicons = Array.from(document.querySelectorAll('link[rel*="icon"]')).map((link) => ({
        rel: link.getAttribute('rel') || 'icon',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }));
      root.dataset.jhTabOriginalFavicons = JSON.stringify(originalFavicons);
    }

    let iconHref = iconSpec.value || '';
    if (iconSpec.mode === 'jh') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 128, 128);
      gradient.addColorStop(0, '#5f82ef');
      gradient.addColorStop(1, '#2448ae');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 58px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('JH', 64, 67);
      iconHref = canvas.toDataURL('image/png');
    }

    document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = iconHref;
    head.appendChild(icon);
  }

  return { title: document.title };
}

function resetPageCustomization() {
  const root = document.documentElement;
  const head = document.head || document.documentElement;

  if (window.__jhTabTitleObserver) {
    window.__jhTabTitleObserver.disconnect();
    delete window.__jhTabTitleObserver;
  }

  if (Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalTitle')) {
    document.title = root.dataset.jhTabOriginalTitle;
    delete root.dataset.jhTabOriginalTitle;
  }

  if (Object.prototype.hasOwnProperty.call(root.dataset, 'jhTabOriginalFavicons')) {
    document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
    try {
      const originalFavicons = JSON.parse(root.dataset.jhTabOriginalFavicons || '[]');
      for (const item of originalFavicons) {
        const link = document.createElement('link');
        link.rel = item.rel || 'icon';
        if (item.href) link.setAttribute('href', item.href);
        if (item.type) link.type = item.type;
        if (item.sizes) link.setAttribute('sizes', item.sizes);
        head.appendChild(link);
      }
    } catch (_error) {
      // A malformed saved value should not prevent title restoration.
    }
    delete root.dataset.jhTabOriginalFavicons;
  }

  return { title: document.title };
}

async function saveOriginalGroupState(tab) {
  const key = `groupState:${tab.id}`;
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) return stored[key];

  let state;
  if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE || tab.groupId === -1) {
    state = { createdByExtension: true, currentGroupId: null };
  } else {
    const group = await chrome.tabGroups.get(tab.groupId);
    state = {
      createdByExtension: false,
      currentGroupId: tab.groupId,
      originalGroupId: tab.groupId,
      originalTitle: group.title || '',
      originalColor: group.color,
      originalCollapsed: group.collapsed
    };
  }

  await chrome.storage.local.set({ [key]: state });
  return state;
}

async function updateSavedGroupState(tabId, groupId, mode, categoryId = '') {
  const key = `groupState:${tabId}`;
  const stored = await chrome.storage.local.get(key);
  const state = stored[key] || { createdByExtension: true };
  state.currentGroupId = groupId;
  state.appliedMode = mode;
  state.categoryId = categoryId;
  await chrome.storage.local.set({ [key]: state });
}

async function getCategoryGroupMap() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.categoryGroupMap);
  return stored[STORAGE_KEYS.categoryGroupMap] || {};
}

async function saveCategoryGroupMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEYS.categoryGroupMap]: map });
}

async function findExistingCategoryGroup(tab, category) {
  const map = await getCategoryGroupMap();
  const mapKey = `${tab.windowId}:${category.id}`;
  const mappedGroupId = map[mapKey];

  if (typeof mappedGroupId === 'number') {
    try {
      const mappedGroup = await chrome.tabGroups.get(mappedGroupId);
      if (mappedGroup.windowId === tab.windowId) {
        return { groupId: mappedGroupId, map, mapKey };
      }
    } catch (_error) {
      delete map[mapKey];
    }
  }

  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const matched = groups.find((group) => group.title === category.name && group.color === category.color);
  if (matched) {
    map[mapKey] = matched.id;
    await saveCategoryGroupMap(map);
    return { groupId: matched.id, map, mapKey };
  }

  return { groupId: null, map, mapKey };
}

async function customizeCategory(tab, category) {
  await saveOriginalGroupState(tab);
  const found = await findExistingCategoryGroup(tab, category);
  let groupId = found.groupId;

  if (typeof groupId === 'number') {
    const latestTab = await chrome.tabs.get(tab.id);
    if (latestTab.groupId !== groupId) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId });
    }
  } else {
    groupId = await chrome.tabs.group({
      tabIds: [tab.id],
      createProperties: { windowId: tab.windowId }
    });
  }

  await chrome.tabGroups.update(groupId, {
    title: category.name,
    color: category.color,
    collapsed: false
  });

  found.map[found.mapKey] = groupId;
  await saveCategoryGroupMap(found.map);
  await updateSavedGroupState(tab.id, groupId, 'category', category.id);
  return groupId;
}

async function restoreGroup(tab) {
  const key = `groupState:${tab.id}`;
  const stored = await chrome.storage.local.get(key);
  const state = stored[key];
  if (!state) return;

  if (state.createdByExtension) {
    const latestTab = await chrome.tabs.get(tab.id);
    const isStillInExtensionGroup = typeof state.currentGroupId !== 'number'
      || latestTab.groupId === state.currentGroupId;
    if (
      isStillInExtensionGroup
      && latestTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
      && latestTab.groupId !== -1
    ) {
      await chrome.tabs.ungroup(tab.id);
    }
  } else if (typeof state.originalGroupId === 'number') {
    try {
      const latestTab = await chrome.tabs.get(tab.id);
      if (latestTab.groupId !== state.originalGroupId) {
        await chrome.tabs.group({ tabIds: [tab.id], groupId: state.originalGroupId });
      }
      await chrome.tabGroups.update(state.originalGroupId, {
        title: state.originalTitle,
        color: state.originalColor,
        collapsed: state.originalCollapsed
      });
    } catch (_error) {
      // The original group may have been removed manually.
    }
  }

  await chrome.storage.local.remove(key);
}

async function buildIconSpec() {
  const mode = selectedIconMode();
  if (mode === 'existing') return { mode: 'existing', value: '' };
  if (mode === 'jh') return { mode: 'jh', value: '' };

  if (mode === 'url') {
    const value = elements.iconUrl.value.trim();
    if (!value) throw new Error('아이콘 이미지 URL을 입력해 주세요.');
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch (_error) {
      throw new Error('올바른 http(s) 이미지 URL을 입력해 주세요.');
    }
    return { mode: 'url', value };
  }

  if (!uploadedIconData) throw new Error('사용할 아이콘 이미지 파일을 선택해 주세요.');
  return { mode: 'upload', value: uploadedIconData };
}

function normalizeCategoryName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function createCategoryId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `category-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadCategories() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.categories);
  categories = Array.isArray(stored[STORAGE_KEYS.categories])
    ? stored[STORAGE_KEYS.categories]
    : [];
  renderCategories();
}

function renderCategories(selectedId = '') {
  elements.categorySelect.replaceChildren();

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '카테고리 사용 안 함';
  elements.categorySelect.appendChild(emptyOption);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = `${category.name} · ${colorLabel(category.color)}`;
    elements.categorySelect.appendChild(option);
  }

  if (selectedId && categories.some((category) => category.id === selectedId)) {
    elements.categorySelect.value = selectedId;
  } else {
    elements.categorySelect.value = '';
  }
  elements.deleteCategoryButton.disabled = !elements.categorySelect.value;
}

function colorLabel(color) {
  const labels = {
    grey: '회색',
    blue: '파랑',
    red: '빨강',
    yellow: '노랑',
    green: '초록',
    pink: '분홍',
    purple: '보라',
    cyan: '청록',
    orange: '주황'
  };
  return labels[color] || color;
}

async function addCategory() {
  const name = normalizeCategoryName(elements.newCategoryName.value);
  if (!name) {
    setStatus('추가할 카테고리 이름을 입력해 주세요.', 'error');
    elements.newCategoryName.focus();
    return;
  }

  const duplicate = categories.find((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (duplicate) {
    renderCategories(duplicate.id);
    setStatus(`이미 저장된 “${duplicate.name}” 카테고리를 선택했습니다.`);
    return;
  }

  const category = {
    id: createCategoryId(),
    name,
    color: elements.newCategoryColor.value
  };
  categories.push(category);
  await chrome.storage.local.set({ [STORAGE_KEYS.categories]: categories });
  renderCategories(category.id);
  elements.newCategoryName.value = '';
  setStatus(`“${category.name}” 카테고리를 저장하고 선택했습니다.`, 'success');
}

async function deleteSelectedCategory() {
  const selectedId = elements.categorySelect.value;
  if (!selectedId) return;

  const category = categories.find((item) => item.id === selectedId);
  categories = categories.filter((item) => item.id !== selectedId);
  await chrome.storage.local.set({ [STORAGE_KEYS.categories]: categories });

  const map = await getCategoryGroupMap();
  for (const key of Object.keys(map)) {
    if (key.endsWith(`:${selectedId}`)) delete map[key];
  }
  await saveCategoryGroupMap(map);

  renderCategories();
  setStatus(`“${category?.name || '선택한'}” 카테고리를 목록에서 삭제했습니다. 기존 Chrome 그룹은 그대로 유지됩니다.`, 'success');
}

async function applyCustomization() {
  setBusy(true);
  setStatus('현재 탭에 적용하는 중입니다…');

  try {
    activeTab = await getActiveTab();
    if (!isScriptableUrl(activeTab.url)) {
      throw new Error('chrome:// 페이지, 새 탭, Chrome 웹 스토어 등 보호된 페이지에는 적용할 수 없습니다. 일반 웹사이트에서 실행해 주세요.');
    }

    const alias = elements.aliasTitle.value.trim() || pageDefaults.title || activeTab.title || '새 탭';
    const iconSpec = await buildIconSpec();

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: applyPageCustomization,
      args: [alias, iconSpec]
    });

    const selectedCategoryId = elements.categorySelect.value;
    const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

    if (selectedCategory) {
      await customizeCategory(activeTab, selectedCategory);
      setStatus(`별칭 “${alias}”을 적용하고 “${selectedCategory.name}” 카테고리에 합쳤습니다.`, 'success');
    } else {
      await restoreGroup(activeTab);
      setStatus(`탭 별칭 “${alias}”과 아이콘 설정을 적용했습니다.`, 'success');
    }
  } catch (error) {
    setStatus(error?.message || '적용 중 알 수 없는 오류가 발생했습니다.', 'error');
  } finally {
    setBusy(false);
  }
}

async function resetCustomization() {
  setBusy(true);
  setStatus('원래 상태로 복원하는 중입니다…');

  try {
    activeTab = await getActiveTab();
    if (!isScriptableUrl(activeTab.url)) {
      throw new Error('이 페이지에서는 탭 내용을 복원할 수 없습니다.');
    }

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: resetPageCustomization
    });
    await restoreGroup(activeTab);

    const page = await readCurrentPage();
    pageDefaults.title = page.originalTitle || page.currentTitle || activeTab.title || '';
    pageDefaults.favicon = page.originalFavicon || page.currentFavicon || activeTab.favIconUrl || '';
    elements.aliasTitle.value = '';
    elements.aliasTitle.placeholder = pageDefaults.title || '현재 탭 이름';
    chooseIconMode('existing');
    updateExistingIconPreview(pageDefaults.favicon);
    elements.categorySelect.value = '';
    elements.deleteCategoryButton.disabled = true;
    setStatus('이 확장 프로그램이 변경한 내용을 원래대로 복원했습니다.', 'success');
  } catch (error) {
    setStatus(error?.message || '복원 중 알 수 없는 오류가 발생했습니다.', 'error');
  } finally {
    setBusy(false);
  }
}

function updateExistingIconPreview(iconUrl) {
  if (iconUrl) {
    elements.existingIconPreview.src = iconUrl;
    elements.existingIconBox.classList.remove('no-image');
  } else {
    elements.existingIconPreview.removeAttribute('src');
    elements.existingIconBox.classList.add('no-image');
  }
}

async function initialize() {
  document.querySelectorAll('input[name="iconMode"]').forEach((radio) => {
    radio.addEventListener('change', () => showIconMode(selectedIconMode()));
  });

  elements.iconFile.addEventListener('change', async () => {
    const file = elements.iconFile.files?.[0];
    if (!file) return;
    try {
      uploadedIconData = await resizeImageFile(file);
      elements.previewImage.src = uploadedIconData;
      elements.previewName.textContent = file.name;
      elements.uploadPreview.classList.remove('hidden');
      setStatus('아이콘 파일을 준비했습니다.');
    } catch (error) {
      uploadedIconData = '';
      elements.uploadPreview.classList.add('hidden');
      setStatus(error?.message || '아이콘 파일을 처리하지 못했습니다.', 'error');
    }
  });

  elements.categorySelect.addEventListener('change', () => {
    elements.deleteCategoryButton.disabled = !elements.categorySelect.value;
    const category = categories.find((item) => item.id === elements.categorySelect.value);
    if (category) {
      setStatus(`별칭은 그대로 적용되고, 현재 탭이 “${category.name}” 카테고리 그룹에 합쳐집니다.`);
    } else {
      setStatus('별칭만 적용되며 카테고리 그룹은 사용하지 않습니다.');
    }
  });

  elements.newCategoryName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory();
    }
  });

  elements.addCategoryButton.addEventListener('click', addCategory);
  elements.deleteCategoryButton.addEventListener('click', deleteSelectedCategory);
  elements.applyButton.addEventListener('click', applyCustomization);
  elements.resetButton.addEventListener('click', resetCustomization);

  try {
    await loadCategories();
    activeTab = await getActiveTab();

    if (isScriptableUrl(activeTab.url)) {
      const page = await readCurrentPage();
      pageDefaults.title = page.originalTitle || page.currentTitle || activeTab.title || '';
      pageDefaults.favicon = page.originalFavicon || page.currentFavicon || activeTab.favIconUrl || '';
      elements.aliasTitle.placeholder = pageDefaults.title || '현재 탭 이름';
      updateExistingIconPreview(pageDefaults.favicon);
    } else {
      elements.aliasTitle.placeholder = activeTab.title || '현재 탭 이름';
      updateExistingIconPreview(activeTab.favIconUrl || '');
      setStatus('일반 웹사이트 탭에서 확장 프로그램을 열어 주세요.', 'error');
    }

    chooseIconMode('existing');
  } catch (error) {
    setStatus(error?.message || '현재 탭 정보를 읽지 못했습니다.', 'error');
  }
}

initialize();
