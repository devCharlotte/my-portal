const $ = (id) => document.getElementById(id);
const clean = (v) => String(v || '').trim();

const defaultCandidates = ['hello','hi','admin','password','qwerty','123456','junhee','joonhee','dongguk','security','cipher','game','test','love','hyeonseok1234567'];
const morseMap = {'.-':'A','-...':'B','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G','....':'H','..':'I','.---':'J','-.-':'K','.-..':'L','--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R','...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y','--..':'Z','-----':'0','.----':'1','..---':'2','...--':'3','....-':'4','.....':'5','-....':'6','--...':'7','---..':'8','----.':'9'};

function showError(el, err) { el.textContent = '오류: ' + (err?.message || err); }
function safe(fn) { try { return fn(); } catch { return ''; } }
function isReadable(s) {
  if (!s) return false;
  const printable = [...s].filter(ch => ch === '\n' || ch === '\t' || ch.charCodeAt(0) >= 32).length / Math.max(1, [...s].length);
  return printable > 0.85 && s.replace(/\s/g,'').length > 0;
}
function addResult(container, title, body, note='') {
  if (!isReadable(body)) return;
  const div = document.createElement('div');
  div.className = 'result-item';
  div.innerHTML = `<div class="result-title">${escapeHtml(title)}</div><div>${escapeHtml(body)}</div>${note ? `<div class="small-note">${escapeHtml(note)}</div>` : ''}`;
  container.appendChild(div);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function wordArrayFromInput(text, type) {
  if (type === 'Hex') return CryptoJS.enc.Hex.parse(text.replace(/\s/g, ''));
  if (type === 'Base64') return CryptoJS.enc.Base64.parse(text.replace(/\s/g, ''));
  return CryptoJS.enc.Utf8.parse(text);
}
function formatWordArray(wa, type) {
  if (type === 'Hex') return CryptoJS.enc.Hex.stringify(wa);
  if (type === 'Base64') return CryptoJS.enc.Base64.stringify(wa);
  return CryptoJS.enc.Utf8.stringify(wa);
}
function getAesMode(mode) {
  return { CBC: CryptoJS.mode.CBC, ECB: CryptoJS.mode.ECB, CTR: CryptoJS.mode.CTR }[mode] || CryptoJS.mode.CBC;
}
function caesar(text, shift) {
  return text.replace(/[a-z]/gi, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode((ch.charCodeAt(0) - base + shift + 2600) % 26 + base);
  });
}
function atbash(text) {
  return text.replace(/[a-z]/gi, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(25 - (ch.charCodeAt(0) - base) + base);
  });
}
function vigenere(text, key, decrypt=false) {
  key = (key || 'KEY').replace(/[^a-z]/gi,'').toUpperCase();
  if (!key) key = 'KEY';
  let i = 0;
  return text.replace(/[a-z]/gi, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    const k = key.charCodeAt(i++ % key.length) - 65;
    const delta = decrypt ? -k : k;
    return String.fromCharCode((ch.charCodeAt(0) - base + delta + 2600) % 26 + base);
  });
}
function railFenceEncrypt(text, rails=2) {
  rails = Math.max(2, parseInt(rails) || 2);
  const rows = Array.from({length: rails}, () => []);
  let r = 0, dir = 1;
  for (const ch of text) {
    rows[r].push(ch);
    if (r === 0) dir = 1;
    if (r === rails - 1) dir = -1;
    r += dir;
  }
  return rows.map(a => a.join('')).join('');
}
function railFenceDecrypt(cipher, rails=2) {
  rails = Math.max(2, parseInt(rails) || 2);
  const pattern = [];
  let r = 0, dir = 1;
  for (let i=0;i<cipher.length;i++) {
    pattern.push(r);
    if (r === 0) dir = 1;
    if (r === rails - 1) dir = -1;
    r += dir;
  }
  const counts = Array(rails).fill(0);
  pattern.forEach(x => counts[x]++);
  const rows = [];
  let pos = 0;
  for (let i=0;i<rails;i++) { rows[i] = cipher.slice(pos, pos + counts[i]).split(''); pos += counts[i]; }
  return pattern.map(x => rows[x].shift()).join('');
}
function encode(text, algo) {
  if (algo === 'Base64') return btoa(unescape(encodeURIComponent(text)));
  if (algo === 'Hex') return [...new TextEncoder().encode(text)].map(b => b.toString(16).padStart(2,'0')).join('');
  if (algo === 'Binary') return [...new TextEncoder().encode(text)].map(b => b.toString(2).padStart(8,'0')).join(' ');
  if (algo === 'URL') return encodeURIComponent(text);
  if (algo === 'ASCII') return [...text].map(c => c.charCodeAt(0)).join(' ');
  if (algo === 'Unicode Escape') return [...text].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
}
function decode(text, algo) {
  if (algo === 'Base64') return decodeURIComponent(escape(atob(text.replace(/\s/g,''))));
  if (algo === 'Hex') return new TextDecoder().decode(Uint8Array.from((text.replace(/\s/g,'').match(/.{1,2}/g) || []).map(x => parseInt(x,16))));
  if (algo === 'Binary') return new TextDecoder().decode(Uint8Array.from(text.trim().split(/\s+/).map(x => parseInt(x,2))));
  if (algo === 'URL') return decodeURIComponent(text);
  if (algo === 'ASCII') return text.trim().split(/\s+/).map(n => String.fromCharCode(parseInt(n,10))).join('');
  if (algo === 'Unicode Escape') return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h,16)));
}
function hashText(text, algo) {
  return {MD5: CryptoJS.MD5, SHA1: CryptoJS.SHA1, SHA256: CryptoJS.SHA256, SHA512: CryptoJS.SHA512}[algo](text).toString();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tool-panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.tab).classList.add('active');
  });
}

$('autoRun').onclick = () => {
  const input = clean($('autoInput').value);
  const out = $('autoResult'); out.innerHTML = '';
  if (!input) return;
  addResult(out, 'URL Decode', safe(() => decode(input, 'URL')));
  addResult(out, 'Base64 Decode', safe(() => decode(input, 'Base64')));
  addResult(out, 'Hex Decode', safe(() => decode(input, 'Hex')));
  addResult(out, 'Binary Decode', safe(() => decode(input, 'Binary')));
  addResult(out, 'ROT13', caesar(input, 13));
  addResult(out, 'Atbash', atbash(input));
  if (/^[.\-\s/]+$/.test(input)) addResult(out, 'Morse Decode', input.split(/\s+|\//).map(x => morseMap[x] || '').join(''));
  for (let s=1; s<26; s++) addResult(out, `Caesar Shift ${s}`, caesar(input, -s));
  if (!out.children.length) out.textContent = '가능한 후보가 없습니다.';
};

$('aesRun').onclick = () => {
  const res = $('aesResult');
  try {
    const action = $('aesAction').value;
    const modeName = $('aesMode').value;
    const inputType = $('aesInputType').value;
    const outputType = $('aesOutputType').value;
    const key = CryptoJS.enc.Utf8.parse($('aesKey').value);
    const ivText = $('aesIv').value;
    const cfg = { mode: getAesMode(modeName), padding: CryptoJS.pad.Pkcs7 };
    if (modeName !== 'ECB') cfg.iv = CryptoJS.enc.Utf8.parse(ivText.padEnd(16, '\0').slice(0,16));
    if (action === 'encrypt') {
      const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse($('aesInput').value), key, cfg);
      const wa = encrypted.ciphertext;
      res.textContent = formatWordArray(wa, outputType === 'Text' ? 'Base64' : outputType);
    } else {
      const ciphertext = wordArrayFromInput(clean($('aesInput').value), inputType);
      const decrypted = CryptoJS.AES.decrypt({ ciphertext }, key, cfg);
      res.textContent = formatWordArray(decrypted, outputType);
    }
  } catch (e) { showError(res, e); }
};

$('modernRun').onclick = () => {
  const res = $('modernResult');
  try {
    const algo = $('modernAlgo').value;
    const action = $('modernAction').value;
    const inputType = $('modernInputType').value;
    const outputType = $('modernOutputType').value;
    const key = $('modernKey').value;
    const lib = {DES: CryptoJS.DES, TripleDES: CryptoJS.TripleDES, RC4: CryptoJS.RC4}[algo];
    if (action === 'encrypt') {
      const encrypted = lib.encrypt($('modernInput').value, key).ciphertext;
      res.textContent = formatWordArray(encrypted, outputType === 'Text' ? 'Base64' : outputType);
    } else {
      const ciphertext = wordArrayFromInput(clean($('modernInput').value), inputType);
      const decrypted = lib.decrypt({ ciphertext, salt: undefined }, key);
      res.textContent = formatWordArray(decrypted, outputType);
    }
  } catch (e) { showError(res, e); }
};

$('classicRun').onclick = () => {
  const text = $('classicInput').value;
  const algo = $('classicAlgo').value;
  const action = $('classicAction').value;
  const key = $('classicKey').value;
  const decrypt = action === 'decrypt';
  let out = '';
  if (algo === 'Caesar') out = caesar(text, decrypt ? -(parseInt(key)||0) : (parseInt(key)||0));
  if (algo === 'Vigenere') out = vigenere(text, key, decrypt);
  if (algo === 'Atbash') out = atbash(text);
  if (algo === 'RailFence') out = decrypt ? railFenceDecrypt(text, key) : railFenceEncrypt(text, key);
  $('classicResult').textContent = out;
};

$('encRun').onclick = () => {
  const res = $('encResult');
  try { res.textContent = $('encAction').value === 'encode' ? encode($('encInput').value, $('encAlgo').value) : decode(clean($('encInput').value), $('encAlgo').value); }
  catch (e) { showError(res, e); }
};

$('hashRun').onclick = () => {
  const algo = $('hashAlgo').value;
  const input = clean($('hashInput').value).toLowerCase();
  if ($('hashMode').value === 'generate') {
    $('hashResult').textContent = hashText($('hashInput').value, algo);
  } else {
    const candidates = ($('hashCandidates').value.trim() ? $('hashCandidates').value.split(/\r?\n/) : defaultCandidates).map(x => x.trim()).filter(Boolean);
    const hits = candidates.filter(c => hashText(c, algo).toLowerCase() === input);
    $('hashResult').textContent = hits.length ? 'Possible plaintext:\n' + hits.join('\n') : '일치하는 후보가 없습니다.';
  }
};

$('idRun').onclick = () => {
  const input = clean($('idInput').value);
  const out = $('idResult'); out.innerHTML = '';
  if (!input) return;
  if (/^[A-Za-z0-9+/=\s]+$/.test(input) && input.replace(/\s/g,'').length % 4 === 0) addResult(out, 'Base64 가능성', '문자 집합과 길이가 Base64 패턴과 비슷합니다.');
  if (/^[0-9a-fA-F\s]+$/.test(input) && input.replace(/\s/g,'').length % 2 === 0) addResult(out, 'Hex 가능성', '0-9, a-f 문자만 사용합니다.');
  if (/^[01\s]+$/.test(input)) addResult(out, 'Binary 가능성', '0과 1 중심의 비트열입니다.');
  if (/^[.\-\s/]+$/.test(input)) addResult(out, 'Morse 가능성', '점과 선 패턴입니다.');
  if (/^[a-zA-Z\s.,!?]+$/.test(input)) addResult(out, 'Classical Cipher 가능성', '영문 문자 중심이라 Caesar, Atbash, Vigenere를 먼저 확인해볼 수 있습니다.');
  if (/^[0-9a-fA-F]{32}$/.test(input)) addResult(out, 'MD5 Hash 가능성', '32자리 hex 해시입니다.');
  if (/^[0-9a-fA-F]{40}$/.test(input)) addResult(out, 'SHA1 Hash 가능성', '40자리 hex 해시입니다.');
  if (/^[0-9a-fA-F]{64}$/.test(input)) addResult(out, 'SHA256 Hash 가능성', '64자리 hex 해시입니다.');
  if (!out.children.length) out.textContent = '뚜렷한 후보가 없습니다.';
};

$('challengeRun').onclick = () => {
  const text = $('challengeInput').value;
  const types = ['Base64','Hex','Caesar','Atbash','Vigenere','AES-CBC'];
  let type = $('challengeType').value;
  if (type === 'Random') type = types[Math.floor(Math.random() * types.length)];
  let key = $('challengeKey').value;
  let result = '';
  if (type === 'Base64') result = encode(text, 'Base64');
  if (type === 'Hex') result = encode(text, 'Hex');
  if (type === 'Caesar') { key = key || String(Math.floor(Math.random()*25)+1); result = caesar(text, parseInt(key)); }
  if (type === 'Atbash') result = atbash(text);
  if (type === 'Vigenere') { key = key || 'GAME'; result = vigenere(text, key, false); }
  if (type === 'AES-CBC') {
    key = (key || 'hyeonseok1234567').padEnd(16, '0').slice(0,16);
    const iv = '1234567890abcdef';
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(text), CryptoJS.enc.Utf8.parse(key), {iv: CryptoJS.enc.Utf8.parse(iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7});
    result = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
    $('challengeResult').textContent = `Type: ${type}\nKey: ${key}\nIV: ${iv}\nCiphertext:\n${result}`;
    return;
  }
  $('challengeResult').textContent = `Type: ${type}${key ? `\nKey: ${key}` : ''}\nCiphertext:\n${result}`;
};
