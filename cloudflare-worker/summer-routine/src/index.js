const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const failedAttempts = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/routines") {
      return json({ error: "Not found" }, 404, cors);
    }

    try {
      if (request.method === "GET") {
        const { data } = await readRoutines(env);
        return json({ data }, 200, cors, { "Cache-Control": "no-store" });
      }

      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405, cors, { Allow: "GET, POST, OPTIONS" });
      }

      if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) {
        return json({ error: "허용되지 않은 Origin입니다." }, 403, cors);
      }

      const clientId = request.headers.get("CF-Connecting-IP") || "unknown";
      enforceRateLimit(clientId);

      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > MAX_BODY_BYTES) {
        return json({ error: "요청 본문이 너무 큽니다." }, 413, cors);
      }

      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
        return json({ error: "요청 본문이 너무 큽니다." }, 413, cors);
      }

      const body = safeJsonParse(bodyText);
      if (!body || typeof body !== "object") {
        return json({ error: "JSON 요청 형식이 올바르지 않습니다." }, 400, cors);
      }

      if (!constantTimeEqual(String(body.password || ""), String(env.ADMIN_PASSWORD || ""))) {
        recordFailedAttempt(clientId);
        return json({ error: "관리자 비밀번호가 올바르지 않습니다." }, 401, cors);
      }
      failedAttempts.delete(clientId);

      const result = await updateWithRetry(env, body);
      return json({ data: result }, 200, cors, { "Cache-Control": "no-store" });
    } catch (error) {
      console.error(error);
      const status = Number.isInteger(error.status) ? error.status : 500;
      const message = status >= 500 ? "서버에서 저장소 반영 중 오류가 발생했습니다." : error.message;
      return json({ error: message }, status, cors);
    }
  }
};

function isAllowedOrigin(origin, configuredOrigin) {
  if (!configuredOrigin) return false;
  return origin === configuredOrigin;
}

function corsHeaders(origin, configuredOrigin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  };
  if (isAllowedOrigin(origin, configuredOrigin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(value, status, baseHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...baseHeaders, ...extraHeaders }
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  const length = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < length; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

function enforceRateLimit(clientId) {
  const record = failedAttempts.get(clientId);
  if (!record) return;
  if (Date.now() - record.windowStart > RATE_WINDOW_MS) {
    failedAttempts.delete(clientId);
    return;
  }
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const error = new Error("비밀번호 오류가 반복되어 잠시 차단되었습니다.");
    error.status = 429;
    throw error;
  }
}

function recordFailedAttempt(clientId) {
  const now = Date.now();
  const current = failedAttempts.get(clientId);
  if (!current || now - current.windowStart > RATE_WINDOW_MS) {
    failedAttempts.set(clientId, { count: 1, windowStart: now });
    return;
  }
  current.count += 1;
  failedAttempts.set(clientId, current);
}

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    const error = new Error(`Worker 환경 변수 ${key}가 설정되지 않았습니다.`);
    error.status = 500;
    throw error;
  }
  return value;
}

function githubApiUrl(env) {
  const owner = requiredEnv(env, "GITHUB_OWNER");
  const repo = requiredEnv(env, "GITHUB_REPO");
  const path = requiredEnv(env, "ROUTINES_PATH").split("/").map(encodeURIComponent).join("/");
  const branch = encodeURIComponent(requiredEnv(env, "GITHUB_BRANCH"));
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${branch}`;
}

function githubHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${requiredEnv(env, "GITHUB_TOKEN")}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "summer-routine-cloudflare-worker"
  };
}

async function readRoutines(env) {
  const response = await fetch(githubApiUrl(env), { headers: githubHeaders(env) });
  if (!response.ok) {
    const details = await response.text();
    console.error("GitHub read failed:", response.status, details);
    const error = new Error("GitHub에서 routines.json을 읽지 못했습니다.");
    error.status = response.status === 404 ? 500 : 502;
    throw error;
  }

  const file = await response.json();
  const data = validateDocument(JSON.parse(decodeBase64Utf8(file.content)));
  return { data, sha: file.sha };
}

async function updateWithRetry(env, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, sha } = await readRoutines(env);
      const updated = applyMutation(data, body);
      return await writeRoutines(env, updated, sha, body.action);
    } catch (error) {
      lastError = error;
      if (error.status !== 409) throw error;
    }
  }
  throw lastError || new Error("동시 수정 충돌을 해결하지 못했습니다.");
}

function applyMutation(document, body) {
  const items = [...document.items];
  if (body.action === "add") {
    const item = validateNewItem(body.item);
    items.push({
      id: crypto.randomUUID(),
      ...item,
      enabled: true,
      createdAt: new Date().toISOString()
    });
  } else if (body.action === "delete") {
    const id = String(body.id || "");
    if (!id) throw clientError("삭제할 알림 ID가 없습니다.");
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw clientError("삭제할 알림을 찾지 못했습니다.", 404);
    items.splice(index, 1);
  } else {
    throw clientError("지원하지 않는 수정 작업입니다.");
  }

  return validateDocument({
    ...document,
    updatedAt: new Date().toISOString(),
    items
  });
}

function validateNewItem(raw) {
  if (!raw || typeof raw !== "object") throw clientError("추가할 알림 데이터가 없습니다.");
  const title = cleanText(raw.title, 80, "알림 제목");
  const message = cleanText(raw.message, 240, "알림 내용");
  const time = String(raw.time || "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw clientError("시간 형식이 올바르지 않습니다.");

  const days = Array.from(new Set((Array.isArray(raw.days) ? raw.days : []).map(Number))).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (days.length === 0) throw clientError("요일을 하나 이상 선택해야 합니다.");
  days.sort((a, b) => a - b);

  return { title, message, time, days };
}

function cleanText(value, maxLength, label) {
  const text = String(value || "").trim().replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ");
  if (!text) throw clientError(`${label}을 입력해야 합니다.`);
  if (text.length > maxLength) throw clientError(`${label}은 ${maxLength}자 이하여야 합니다.`);
  return text;
}

function validateDocument(document) {
  if (!document || typeof document !== "object" || !Array.isArray(document.items)) {
    throw clientError("routines.json 구조가 올바르지 않습니다.", 500);
  }
  if (document.activeFrom !== "2026-07-01" || document.activeUntil !== "2026-08-31" || document.timezone !== "Asia/Seoul") {
    throw clientError("routines.json의 적용 기간 또는 시간대가 고정 설정과 다릅니다.", 500);
  }

  const ids = new Set();
  const items = document.items.map((item) => {
    const id = String(item.id || "");
    if (!id || ids.has(id)) throw clientError("알림 ID가 없거나 중복되었습니다.", 500);
    ids.add(id);
    return {
      id,
      title: cleanText(item.title, 80, "알림 제목"),
      message: cleanText(item.message, 240, "알림 내용"),
      days: validateNewItem(item).days,
      time: validateNewItem(item).time,
      enabled: item.enabled !== false,
      createdAt: String(item.createdAt || "")
    };
  });

  return {
    schemaVersion: 1,
    timezone: "Asia/Seoul",
    activeFrom: "2026-07-01",
    activeUntil: "2026-08-31",
    updatedAt: String(document.updatedAt || new Date().toISOString()),
    items
  };
}

async function writeRoutines(env, document, sha, action) {
  const owner = requiredEnv(env, "GITHUB_OWNER");
  const repo = requiredEnv(env, "GITHUB_REPO");
  const path = requiredEnv(env, "ROUTINES_PATH").split("/").map(encodeURIComponent).join("/");
  const branch = requiredEnv(env, "GITHUB_BRANCH");
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const content = `${JSON.stringify(document, null, 2)}\n`;

  const response = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: action === "add" ? "Add summer routine" : "Delete summer routine",
      content: encodeBase64Utf8(content),
      sha,
      branch
    })
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("GitHub write failed:", response.status, details);
    const error = new Error(response.status === 409 ? "저장소 동시 수정 충돌이 발생했습니다." : "GitHub에 routines.json을 커밋하지 못했습니다.");
    error.status = response.status === 409 ? 409 : 502;
    throw error;
  }
  return document;
}

function decodeBase64Utf8(base64) {
  const clean = base64.replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function clientError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
