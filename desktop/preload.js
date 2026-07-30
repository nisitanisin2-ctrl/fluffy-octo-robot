/* パソコン用アプリだけの追加機能

   index.html には手を加えず、開いたあとから
   「🗺 地図を開く」ボタンと、地図の画面（範囲を選んで切り取る所）を足します。
   ブラウザで index.html を開いたときは、この中身は動かないので今までどおりです。

   流れ
     ① 「🗺 地図を開く」…アプリの中に地図が出ます（本物の Google マップです）
     ② 地図を動かして、載せたい範囲を画面に出す
     ③ 「⬛ 範囲を選ぶ」→ 地図の上をドラッグして四角で囲む（囲まなければ画面全体）
     ④ 「📌 この範囲を貼り付ける」→ 用紙に地図として入り、矢印の道具に切り替わります  */
'use strict';

const STORE_PLACES = 'genba.desktop.places';   // 登録した場所
const STORE_LAST   = 'genba.desktop.last';     // 前回開いていた場所
const STORE_SHORTS = 'genba.desktop.shortcuts';// よく使う地図（ボタン3つ）
const HOME = 'https://www.google.com/maps';

/* ボタン3つの、はじめの中身。右クリックでいつでも入れ替えられます */
const DEFAULT_SHORTS = [
  { name: 'Google マップ', url: HOME },
  { name: '地理院地図',    url: 'https://maps.gsi.go.jp/' },
  null
];

window.addEventListener('DOMContentLoaded', () => {
  try { setupMapPanel(); }
  catch (err) { console.error('地図の画面を作れませんでした', err); }
});

function setupMapPanel() {
  const bar = document.querySelector('#toolbar .bar');
  if (!bar) return;                              // 想定と違う画面なら何もしません

  addStyle();

  /* ---------- ツールバーのボタン ---------- */
  const openBtn = document.createElement('button');
  openBtn.id = 'btnMapBrowser';
  openBtn.className = 'primary';
  openBtn.textContent = '🗺 地図を開く';
  openBtn.title = 'アプリの中に地図を開いて、載せたい範囲をそのまま貼り付けます';
  const pasteBtn = document.getElementById('btnPasteMap');
  if (pasteBtn && pasteBtn.parentNode) pasteBtn.parentNode.insertBefore(openBtn, pasteBtn);
  else bar.appendChild(openBtn);

  /* ---------- 地図の画面 ---------- */
  const panel = document.createElement('div');
  panel.id = 'mapPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div id="mapPanelBar">
      <button id="mpBack" title="前に見ていた場所へ戻る">◀</button>
      <button id="mpFwd" title="進む">▶</button>
      <button id="mpReload" title="読み込み直す">↻</button>
      <input id="mpAddr" placeholder="住所・現場名・Googleマップのアドレスを入れて Enter">
      <button id="mpGo">表示</button>
      <span class="mpShortWrap">
        <span class="mpLbl">よく使う地図</span>
        <button class="mpShort" data-i="0"></button>
        <button class="mpShort" data-i="1"></button>
        <button class="mpShort" data-i="2"></button>
      </span>
      <select id="mpPlaces" title="登録した場所"><option value="">登録した場所…</option></select>
      <button id="mpSave" title="今開いている場所に名前を付けて登録します">★ 登録</button>
      <button id="mpDelPlace" title="選んでいる登録を消します">登録を消す</button>
      <span class="mpGap"></span>
      <button id="mpPick" title="地図の上をドラッグして、用紙に載せる範囲を四角で囲みます">⬛ 範囲を選ぶ</button>
      <button id="mpPaste" class="primary" title="選んだ範囲を、用紙に地図として貼り付けます">📌 この範囲を貼り付ける</button>
      <button id="mpClose" title="地図の画面を閉じます（Esc）">✕ 閉じる</button>
    </div>
    <div id="mapPanelBody">
      <webview id="mpView" partition="persist:maps"></webview>
      <div id="mpOverlay"><div id="mpRect" hidden></div></div>
    </div>
    <div id="mapPanelHint"></div>`;
  document.body.appendChild(panel);

  /* 窓が狭いときも段を増やさず、横へすべらせて見せます（アプリ本体と同じ動き） */
  if (typeof window.makeBarSlidable === 'function') {
    window.makeBarSlidable(panel.querySelector('#mapPanelBar'));
  }

  const $ = id => panel.querySelector('#' + id);
  const view = $('mpView'), overlay = $('mpOverlay'), rectEl = $('mpRect'), hint = $('mapPanelHint');
  const addr = $('mpAddr'), places = $('mpPlaces');

  /* 地図の側からは、ふつうの Chrome として見えるようにします
     （Electron のままだと、うまく表示されないことがあるため） */
  view.setAttribute('useragent',
    navigator.userAgent.replace(/ Electron\/[\d.]+/, '').replace(/ genba-keiro-desktop\/[\d.]+/i, ''));

  let picking = false, sel = null, dragStart = null;

  function setHint(msg) { hint.textContent = msg; }
  function toURL(text) {
    const t = (text || '').trim();
    if (!t) return HOME;
    if (/^https?:\/\//i.test(t)) return t;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t);
  }
  function go(text) {
    const url = toURL(text);
    view.src = url;
    try { localStorage.setItem(STORE_LAST, url); } catch (e) {}
  }

  /* ---------- 登録した場所 ---------- */
  function loadPlaces() {
    try { return JSON.parse(localStorage.getItem(STORE_PLACES) || '[]'); }
    catch (e) { return []; }
  }
  function savePlaces(list) {
    try { localStorage.setItem(STORE_PLACES, JSON.stringify(list)); } catch (e) {}
  }
  function renderPlaces() {
    const list = loadPlaces();
    places.innerHTML = '<option value="">登録した場所…</option>';
    list.forEach((p, i) => {
      const op = document.createElement('option');
      op.value = String(i); op.textContent = p.name;
      places.appendChild(op);
    });
  }
  renderPlaces();

  places.onchange = () => {
    const p = loadPlaces()[Number(places.value)];
    if (p) { addr.value = p.url; go(p.url); setHint('「' + p.name + '」を開きました。'); }
  };
  $('mpSave').onclick = async () => {
    const url = currentURL() || toURL(addr.value);
    const name = await askText('この場所に名前を付けてください（例：○○工業 本社）', guessName());
    if (!name) return;
    const list = loadPlaces();
    list.push({ name: name, url: url });
    savePlaces(list); renderPlaces();
    setHint('「' + name + '」を登録しました。次からは左の一覧で選べます。');
  };
  /* 今ひらいている地図のアドレス。
     地図がまだ出そろっていないと getURL は使えないので、そのときは空を返します */
  function currentURL() {
    try { return view.getURL() || ''; } catch (e) { return ''; }
  }
  /* 名前のたたき台。地図の見出しから「- Google マップ」などを取り除きます */
  function guessName() {
    let t = '';
    try { t = view.getTitle() || ''; } catch (e) {}
    t = t.replace(/\s*[-–|]\s*Google\s*(マップ|Maps).*$/i, '').trim();
    return /^google\s*(マップ|maps)$/i.test(t) ? '' : t;
  }
  $('mpDelPlace').onclick = () => {
    const i = Number(places.value);
    const list = loadPlaces();
    if (!places.value || !list[i]) { alert('消したい登録を、左の一覧で選んでください'); return; }
    if (!confirm('「' + list[i].name + '」の登録を消しますか？')) return;
    list.splice(i, 1); savePlaces(list); renderPlaces();
    setHint('登録を消しました。');
  };

  /* ---------- よく使う地図（ショートカットボタン3つ） ----------
     Google マップ以外の地図（自治体の地図、地理院地図、社内の地図など）を
     3つまで入れておけます。押すとその地図がすぐ出ます。 */
  const shortBtns = Array.from(panel.querySelectorAll('.mpShort'));

  function loadShorts() {
    let list = null;
    try { list = JSON.parse(localStorage.getItem(STORE_SHORTS)); } catch (e) {}
    if (!Array.isArray(list)) list = DEFAULT_SHORTS.slice();
    list.length = 3;
    return list;
  }
  function saveShorts(list) {
    try { localStorage.setItem(STORE_SHORTS, JSON.stringify(list)); } catch (e) {}
  }
  function renderShorts() {
    const list = loadShorts();
    shortBtns.forEach((b, i) => {
      const s = list[i];
      if (s && s.url) {
        b.textContent = s.name || s.url;
        b.classList.remove('empty');
        b.title = s.name + '\n' + s.url
                + '\n\nクリック：この地図を出します／右クリック：入れ直す・消す';
      } else {
        b.textContent = '＋ 空き' + (i + 1);
        b.classList.add('empty');
        b.title = 'よく使う地図を入れておけます。クリックすると入れられます';
      }
    });
  }
  /* この番号に地図を入れる（アドレス → 名前 の順に聞きます） */
  async function setShort(i) {
    const list = loadShorts();
    const cur = list[i] || {};
    const url0 = await askText(
      'ボタン' + (i + 1) + 'に入れる地図のアドレス（URL）を入れてください。\n'
      + '今ひらいている地図でよければ、そのまま OK を押してください。',
      cur.url || currentURL() || addr.value || '');
    if (!url0) return false;
    const url = /^https?:\/\//i.test(url0.trim()) ? url0.trim() : toURL(url0);
    const name = await askText(
      'ボタンに出す名前を入れてください（例：地理院地図）',
      cur.name || guessName() || hostOf(url));
    list[i] = { name: (name || hostOf(url)), url: url };
    saveShorts(list); renderShorts();
    setHint('ボタン' + (i + 1) + 'に「' + list[i].name + '」を入れました。次からは押すだけで出せます。');
    return true;
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return '地図'; }
  }

  shortBtns.forEach(b => {
    const i = Number(b.dataset.i);
    b.onclick = async () => {
      const s = loadShorts()[i];
      if (!s || !s.url) { await setShort(i); return; }   // 空きなら、まず入れてもらいます
      addr.value = s.url; go(s.url);
      setHint('「' + s.name + '」を出しています。');
    };
    b.oncontextmenu = async e => {
      e.preventDefault();
      const s = loadShorts()[i];
      if (!s || !s.url) { await setShort(i); return; }
      const ans = await askChoice('「' + s.name + '」をどうしますか？',
        [{ value: 'edit', label: '入れ直す' }, { value: 'del', label: '消す' },
         { value: '', label: 'やめる' }]);
      if (ans === 'edit') await setShort(i);
      else if (ans === 'del') {
        const list = loadShorts();
        list[i] = null; saveShorts(list); renderShorts();
        setHint('ボタン' + (i + 1) + 'を空きに戻しました。');
      }
    };
  });
  renderShorts();

  /* ---------- 画面を開く・閉じる ---------- */
  function open() {
    panel.hidden = false;
    if (!view.getAttribute('src')) {
      let last = HOME;
      try { last = localStorage.getItem(STORE_LAST) || HOME; } catch (e) {}
      view.src = last; addr.value = last;
    }
    stopPick(); clearSel();
    setHint('地図を動かして、用紙に載せたい範囲を画面に出してください。囲む範囲を決めるときは「⬛ 範囲を選ぶ」を押します。');
  }
  function close() { stopPick(); panel.hidden = true; }
  openBtn.onclick = open;
  $('mpClose').onclick = close;

  /* ---------- 地図の操作 ---------- */
  $('mpBack').onclick = () => { if (view.canGoBack()) view.goBack(); };
  $('mpFwd').onclick = () => { if (view.canGoForward()) view.goForward(); };
  $('mpReload').onclick = () => view.reload();
  $('mpGo').onclick = () => go(addr.value);
  addr.addEventListener('keydown', e => { if (e.key === 'Enter') go(addr.value); });
  view.addEventListener('did-navigate', e => { addr.value = e.url; });
  view.addEventListener('did-navigate-in-page', e => { addr.value = e.url; });

  /* ---------- 範囲を選ぶ ---------- */
  function startPick() {
    picking = true;
    overlay.classList.add('on');
    $('mpPick').classList.add('active');
    setHint('地図の上をドラッグして、用紙に載せる範囲を四角で囲んでください。もう一度「⬛ 範囲を選ぶ」を押すとやめられます。');
  }
  function stopPick() {
    picking = false;
    overlay.classList.remove('on');
    $('mpPick').classList.remove('active');
  }
  function clearSel() { sel = null; rectEl.hidden = true; }
  $('mpPick').onclick = () => { if (picking) { stopPick(); setHint('範囲を選ぶのをやめました。'); } else startPick(); };

  overlay.addEventListener('pointerdown', e => {
    if (!picking) return;
    const r = overlay.getBoundingClientRect();
    dragStart = { x: e.clientX - r.left, y: e.clientY - r.top };
    sel = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    drawSel();
    overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove', e => {
    if (!picking || !dragStart) return;
    const r = overlay.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    sel = { x: Math.min(dragStart.x, x), y: Math.min(dragStart.y, y),
            w: Math.abs(x - dragStart.x), h: Math.abs(y - dragStart.y) };
    drawSel();
  });
  overlay.addEventListener('pointerup', () => {
    dragStart = null;
    if (sel && (sel.w < 12 || sel.h < 12)) { clearSel(); setHint('範囲が小さすぎます。もう一度ドラッグしてください。'); return; }
    if (sel) {
      stopPick();
      setHint('範囲を決めました（' + Math.round(sel.w) + '×' + Math.round(sel.h) + '）。'
            + 'よければ「📌 この範囲を貼り付ける」を押してください。選び直すときは「⬛ 範囲を選ぶ」から。');
    }
  });
  function drawSel() {
    if (!sel) { rectEl.hidden = true; return; }
    rectEl.hidden = false;
    rectEl.style.left = sel.x + 'px'; rectEl.style.top = sel.y + 'px';
    rectEl.style.width = sel.w + 'px'; rectEl.style.height = sel.h + 'px';
  }

  /* ---------- 貼り付け ---------- */
  $('mpPaste').onclick = async () => {
    const box = overlay.getBoundingClientRect();
    let rect = null;
    if (sel && sel.w >= 12 && sel.h >= 12) {
      rect = {
        x: Math.max(0, Math.round(sel.x)),
        y: Math.max(0, Math.round(sel.y)),
        width: Math.min(Math.round(sel.w), Math.floor(box.width)),
        height: Math.min(Math.round(sel.h), Math.floor(box.height))
      };
    }
    setHint('切り取っています…');
    let src;
    try {
      /* まれに1回目が空になることがある（描き直しの途中など）ので、
         そのときは少し待ってから、もう一度だけ試します */
      let img = null;
      for (let i = 0; i < 3 && (!img || img.isEmpty()); i++) {
        if (i) await new Promise(r => setTimeout(r, 400));
        img = rect ? await view.capturePage(rect) : await view.capturePage();
      }
      if (!img || img.isEmpty()) throw new Error('empty');
      src = img.toDataURL();
    } catch (err) {
      console.error(err);
      setHint('切り取れませんでした。');
      alert('地図を切り取れませんでした。\n\n地図が出そろってから、もう一度お試しください。');
      return;
    }
    if (typeof window.loadMapWithConfirm !== 'function') {
      alert('アプリ本体と、うまくつながりませんでした。');
      return;
    }
    close();
    await window.loadMapWithConfirm(src);          // 用紙に地図として入ります
    clearSel();
    if (typeof window.setTool === 'function') window.setTool('arrow');   // 線が引ける状態へ
    if (typeof window.setHint === 'function') {
      window.setHint('地図を貼り付けました。道に沿ってクリックしていくと矢印が引けます（大きさや位置は右の「用紙と地図」で直せます）。');
    }
  };

  /* Esc で閉じる。アプリ本体の Esc より先に受け取ります */
  window.addEventListener('keydown', e => {
    if (panel.hidden || e.key !== 'Escape') return;
    if (document.querySelector('.mpAskBack')) return;   // 名前を入れる窓が出ている間はそちら優先
    e.stopPropagation();
    if (picking) { stopPick(); setHint('範囲を選ぶのをやめました。'); }
    else close();
  }, true);
}

/* 文字を入れてもらう小さな窓。
   パソコン用アプリ（Electron）では prompt が使えないので、自分で作っています。
   OK を押すか Enter で入れた文字を、キャンセル・Esc・×印の外側を押すと空を返します */
function askText(message, initial) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'mpAskBack';
    back.innerHTML = `
      <div class="mpAsk">
        <div class="mpAskMsg"></div>
        <input class="mpAskInput" type="text">
        <div class="mpAskBtns">
          <button class="mpAskCancel">キャンセル</button>
          <button class="mpAskOk primary">OK</button>
        </div>
      </div>`;
    back.querySelector('.mpAskMsg').textContent = message;
    const input = back.querySelector('.mpAskInput');
    input.value = initial || '';
    document.body.appendChild(back);
    input.focus(); input.select();

    let done = false;
    function finish(value) {
      if (done) return;
      done = true;
      back.remove();
      resolve(value);
    }
    back.querySelector('.mpAskOk').onclick = () => finish(input.value.trim());
    back.querySelector('.mpAskCancel').onclick = () => finish('');
    back.addEventListener('pointerdown', e => { if (e.target === back) finish(''); });
    back.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim()); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(''); }
    });
  });
}

/* どうするか選んでもらう小さな窓。押したボタンの value を返します
   （Esc・外側クリックは、いちばん最後のボタンの value を返します＝ふつうは「やめる」） */
function askChoice(message, buttons) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'mpAskBack';
    back.innerHTML = '<div class="mpAsk"><div class="mpAskMsg"></div><div class="mpAskBtns"></div></div>';
    back.querySelector('.mpAskMsg').textContent = message;
    const btns = back.querySelector('.mpAskBtns');
    let done = false;
    function finish(value) { if (done) return; done = true; back.remove(); resolve(value); }
    buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (i === 0) el.className = 'primary';
      el.onclick = () => finish(b.value);
      btns.appendChild(el);
    });
    const cancelValue = buttons[buttons.length - 1].value;
    back.addEventListener('pointerdown', e => { if (e.target === back) finish(cancelValue); });
    back.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(cancelValue); }
    });
    document.body.appendChild(back);
    btns.firstChild.focus();
  });
}

/* 見た目。アプリ本体のボタンの形をそのまま受け継ぐので、最低限だけ足します */
function addStyle() {
  const css = `
#mapPanel{position:fixed;inset:0;z-index:100;background:#2b3038;display:flex;flex-direction:column}
#mapPanel[hidden]{display:none}
/* 地図の画面のツールバーも、段を増やさずに横へすべらせて見せます */
#mapPanelBar{flex:none;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:7px 10px;background:#2b3038;
             overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin}
#mapPanelBar::-webkit-scrollbar{height:7px}
#mapPanelBar::-webkit-scrollbar-thumb{background:#59636f;border-radius:4px}
#mapPanelBar::-webkit-scrollbar-track{background:transparent}
#mapPanelBar>*{flex:none}
#mapPanelBar.dragging{cursor:grabbing;user-select:none}
#mapPanelBar .mpGap{flex:1 1 0;min-width:8px}
#mapPanelBar input{font:inherit;font-size:14px;padding:6px 9px;border:1px solid #55606e;border-radius:6px;min-width:180px;flex:1 1 180px}
#mapPanelBar select{font:inherit;padding:5px;border:1px solid #55606e;border-radius:6px;max-width:190px}
#mapPanelBar button.active{background:#1a73e8;color:#fff;border-color:#1a73e8}
.mpShortWrap{display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:8px;background:#3a4049}
.mpShortWrap .mpLbl{color:#cfd6df;font-size:12px}
#mapPanelBar .mpShort{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mapPanelBar .mpShort.empty{color:#7c8794;border-style:dashed}
#mapPanelBody{flex:1;position:relative;min-height:0;background:#fff}
#mpView{position:absolute;inset:0;width:100%;height:100%;border:0}
#mpOverlay{position:absolute;inset:0;pointer-events:none}
#mpOverlay.on{pointer-events:auto;cursor:crosshair;background:rgba(26,115,232,.06)}
#mpRect{position:absolute;border:2px dashed #1a73e8;background:rgba(26,115,232,.12);box-shadow:0 0 0 9999px rgba(0,0,0,.18)}
#mapPanelHint{flex:none;background:#fffbe6;border-top:1px solid #e8dfa8;color:#6b6000;padding:5px 12px;min-height:24px;font-size:12.5px}
.mpAskBack{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
.mpAsk{background:#fff;color:#222;border-radius:10px;padding:16px 18px;min-width:340px;max-width:90vw;box-shadow:0 10px 34px rgba(0,0,0,.4)}
.mpAskMsg{font-size:14px;margin-bottom:10px;white-space:pre-wrap}
.mpAskInput{font:inherit;font-size:15px;width:100%;padding:7px 9px;border:1px solid #9aa4b0;border-radius:6px;box-sizing:border-box}
.mpAskBtns{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}
