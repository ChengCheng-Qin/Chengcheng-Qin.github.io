(() => {
  'use strict';
  const L = window.Lottery, KEY = 'ncmmsc2026.lottery.v1';
  const $ = id => document.getElementById(id);
  const newActivity = () => L.fromNumbers(L.initial(), window.DefaultRegistrationIds);
  let state = newActivity(), snapshot = null, blocked = false, timer = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let startupMessage = '';
  try {
    snapshot = localStorage.getItem(KEY);
    if (snapshot) {
      state = L.validate(JSON.parse(snapshot));
      const fixed = newActivity();
      const previousIds = new Set(state.roster ? state.roster.map(p => p.number) : Array.from({ length: state.n }, (_, i) => i + 1));
      const samePool = previousIds.size === fixed.n && fixed.roster.every(p => previousIds.has(p.number));
      if (L.locked(state) && !samePool) {
        blocked = true;
        startupMessage = '已保存的旧活动使用其他号码池。记录已保留，请重置整场后使用固定的 660 个注册号。';
      } else {
        state = L.locked(state) ? { ...state, roster: fixed.roster, rosterSource: 'builtin' } : { ...fixed, k: state.k };
        localStorage.setItem(KEY, JSON.stringify(state)); snapshot = localStorage.getItem(KEY);
        startupMessage = state.current ? '已恢复当前批次，抽奖结果保持不变。' : '已加载固定抽奖池并恢复进度。';
      }
    }
    else { localStorage.setItem(KEY, JSON.stringify(state)); snapshot = localStorage.getItem(KEY); }
  } catch (err) { blocked = true; startupMessage = '无法读取或保存本机记录。请检查浏览器存储设置；如记录损坏，可重置整场重新开始。'; }

  function notice(message = '') { $('notice').textContent = message; }
  function commit(next) {
    if (blocked) throw new Error('当前记录不可用，请刷新页面或重置整场。');
    if (localStorage.getItem(KEY) !== snapshot) { blocked = true; render(); throw new Error('另一页面已修改记录。请刷新后继续，并仅保留一个操作页面。'); }
    const data = JSON.stringify(next);
    try { localStorage.setItem(KEY, data); } catch (err) { throw new Error('保存失败，本次操作未生效。请检查浏览器存储空间后重试。'); }
    snapshot = data; state = next; render();
  }
  function act(fn) { try { notice(); fn(); } catch (err) { notice(err.message); } }
  function numberValue(id) { const value = $(id).value.trim(); return value === '' ? NaN : Number(value); }
  function settings() {
    const n = state.n, k = numberValue('added');
    if (!Number.isInteger(k) || k < 0 || k > L.MAX_N) throw new Error('新增名额需为 0～100,000 的整数。');
    return { n, k };
  }
  function refreshFormula() {
    const n = state.n, k = numberValue('added');
    const validK = Number.isInteger(k) && k >= 0 && k <= L.MAX_N;
    const remaining = n - L.used(state).size;
    const request = state.current ? state.current.requested : validK ? k + state.pending : null;
    $('formula-added').textContent = state.current ? state.current.added : validK ? k : '—';
    $('carry').textContent = state.current ? state.current.carried : state.pending;
    $('requested').textContent = request ?? '—';
    $('draw-all').hidden = !!state.current || blocked || !validK || request <= remaining || remaining <= 0;
    $('range-note').textContent = '仅固定名单内注册号参与';
    $('remaining').textContent = Math.max(0, remaining - (state.current?.numbers.length || 0)).toLocaleString();
    $('pool-total').textContent = n.toLocaleString();
    $('pool-bar').style.width = `${Math.max(0, remaining - (state.current?.numbers.length || 0)) / n * 100}%`;
  }
  function renderLists() {
    for (const type of ['winner', 'absent']) {
      const isAbsent = type === 'absent';
      const groups = state.batches.map(b => ({ id: b.id, numbers: b.numbers.filter(n => b.absent.includes(n) === isAbsent) })).filter(b => b.numbers.length);
      $('' + type + '-count').textContent = groups.reduce((sum, b) => sum + b.numbers.length, 0);
      const container = $(type + '-list'); container.replaceChildren();
      if (!groups.length) {
        const empty = document.createElement('div'); empty.className = 'empty-list';
        empty.append(isAbsent ? '暂无缺席记录' : '静候今晚的幸运儿');
        const sub = document.createElement('span'); sub.textContent = isAbsent ? '缺席名额将自动结转' : '幸运即将揭晓'; empty.append(sub); container.append(empty);
      }
      for (const b of groups.reverse()) {
        const group = document.createElement('div'); group.className = 'record-group';
        const title = document.createElement('span'); title.textContent = `第 ${String(b.id).padStart(2, '0')} 批 · ${b.numbers.length} 人`;
        const chips = document.createElement('div'); chips.className = 'chips';
        for (const n of b.numbers) { const chip = document.createElement('span'); chip.className = `chip${isAbsent ? ' absent-chip' : ''}`; chip.textContent = n; chips.append(chip); }
        group.append(title, chips); container.append(group);
      }
    }
  }
  function render() {
    const numberScroll = $('numbers').scrollTop;
    clearInterval(timer); timer = null;
    const c = state.current, rolling = c?.phase === 'rolling', review = c?.phase === 'review';
    $('fixed-count').textContent = window.DefaultRegistrationIds.length;
    $('added').value = state.k;
    $('added').disabled = !!c || blocked;
    $('save-status').textContent = blocked ? '记录不可用 · 请处理提示' : '进度自动保存在本机';
    $('batch-label').textContent = `第 ${String(c?.id || state.batches.length + 1).padStart(2, '0')} 批`;
    $('stage-title').textContent = rolling ? '幸运，正在靠近' : review ? '恭喜本批幸运嘉宾' : state.batches.length ? '下一份幸运，蓄势待发' : '让幸运，在此刻发生';
    $('stage-subtitle').textContent = rolling ? '由你决定，揭晓这一刻' : review ? '请现场核实，点击号码标记或取消缺席' : '每一个号码，都是今晚的惊喜';
    $('idle-art').hidden = !!c; $('numbers').hidden = !c;
    $('numbers').className = `numbers${c?.numbers.length > 12 ? ' many' : ''}`;
    document.querySelector('.stage').classList.toggle('rolling-stage', !!rolling);
    $('numbers').replaceChildren();
    if (c) {
      const fragment = document.createDocumentFragment();
      for (const n of c.numbers) {
        const absent = c.absent.includes(n), card = document.createElement('button'); card.type = 'button';
        card.dataset.number = n; card.className = `number-card${absent ? ' absent' : ''}`; card.disabled = !review || blocked;
        card.setAttribute('aria-pressed', String(absent));
        card.setAttribute('aria-label', rolling ? '号码滚动中' : `注册号 ${n}，${absent ? '已标记缺席，点击取消' : '点击标记缺席'}`);
        const text = document.createElement('span'); text.textContent = rolling ? '···' : n;
        const hint = document.createElement('small'); hint.textContent = rolling ? '即将揭晓' : absent ? '缺席 · 再点取消' : '点击标记缺席';
        card.append(text);
        card.append(hint); card.addEventListener('click', () => act(() => { commit(L.toggle(state, n)); $('numbers').querySelector(`[data-number="${n}"]`)?.focus({ preventScroll: true }); })); fragment.append(card);
      }
      $('numbers').append(fragment);
      $('numbers').scrollTop = numberScroll;
      if (rolling && !motion.matches) {
        const labels = [...$('numbers').querySelectorAll('.number-card>span')];
        const paint = () => { for (const label of labels.slice(0, 200)) label.textContent = state.roster ? state.roster[Math.floor(Math.random() * state.roster.length)].registration : 1 + Math.floor(Math.random() * state.n); };
        paint(); timer = setInterval(paint, 90);
      }
    }
    $('review-summary').hidden = !review;
    if (review) {
      const present = c.numbers.length - c.absent.length;
      $('review-summary').textContent = `本批 ${c.numbers.length} 人 · 待确认中奖 ${present} 人 · 缺席 ${c.absent.length} 人 · 确认后待补 ${c.requested - present} 人`;
    }
    const primary = $('primary'); primary.classList.toggle('rolling', !!rolling);
    primary.firstElementChild.textContent = rolling ? '停止并揭晓' : review ? '确认本批' : '开始抽奖';
    primary.disabled = blocked || (!c && L.available(state) === 0);
    $('action-note').textContent = rolling ? '点击停止，揭晓本批幸运号码' : review ? '确认后，未标记缺席的号码将计入中奖名单' : L.available(state) === 0 ? `号码池已抽完${state.pending ? ` · 尚有 ${state.pending} 个名额未填满` : ' · 感谢参与'}` : '点击开始，让幸运号码跃动起来';
    refreshFormula(); renderLists();
  }
  $('primary').addEventListener('click', () => act(() => {
    if (!state.current) { const { n, k } = settings(); commit(L.start(state, n, k)); }
    else if (state.current.phase === 'rolling') { commit(L.reveal(state)); celebrate(); }
    else { const next = L.confirm(state); commit(next); notice(`本批已确认。${next.pending ? `${next.pending} 个缺额将加入下一批。` : '全部名额已确认。'}`); }
  }));
  // Prevent a double click from starting, stopping and confirming different phases at once.
  let lastPrimary = -Infinity;
  $('primary').addEventListener('click', e => { const now = performance.now(); if (now - lastPrimary < 650) { e.stopImmediatePropagation(); e.preventDefault(); } else lastPrimary = now; }, true);
  $('draw-all').addEventListener('click', () => act(() => { const { n, k } = settings(); commit(L.start(state, n, k, true)); }));
  for (const id of ['added']) {
    $(id).addEventListener('input', refreshFormula);
    $(id).addEventListener('change', () => act(() => {
      const { n, k } = settings();
      if (state.current || (L.locked(state) && n !== state.n)) throw new Error('当前设置已锁定。');
      commit({ ...state, n, k });
    }));
  }
  $('reset').addEventListener('click', () => $('reset-dialog').showModal());
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
  $('confirm-reset').addEventListener('click', () => act(() => {
    const next = newActivity(), data = JSON.stringify(next);
    localStorage.setItem(KEY, data); snapshot = data; state = next; blocked = false;
    $('reset-dialog').close(); render(); notice('已重新开始，恢复内置的 660 个注册号。');
  }));
  $('fullscreen').addEventListener('click', () => act(() => {
    const operation = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    if (!operation) notice('当前浏览器不支持网页全屏，请使用浏览器的全屏菜单。');
    else operation.catch(() => notice('未能进入全屏，请使用浏览器的全屏菜单。'));
  }));
  document.addEventListener('fullscreenchange', () => { $('fullscreen').lastElementChild.textContent = document.fullscreenElement ? '退出全屏' : '全屏展示'; });
  window.addEventListener('storage', event => { if ((event.key === KEY || event.key === null) && event.newValue !== snapshot) { blocked = true; render(); notice('抽奖记录已在另一页面修改。请刷新本页，并仅保留一个操作页面。'); } });
  motion.addEventListener('change', render);
  function celebrate() {
    $('numbers').classList.remove('revealed'); void $('numbers').offsetWidth; $('numbers').classList.add('revealed');
    if (motion.matches) return;
    for (let i = 0; i < 65; i++) {
      const piece = document.createElement('i'); piece.className = 'confetti';
      piece.style.left = `${Math.random() * 100}%`; piece.style.background = ['#f5d49c', '#7ee2ff', '#ccecff'][i % 3];
      piece.style.setProperty('--drift', `${(Math.random() - .5) * 250}px`); piece.style.animationDelay = `${Math.random() * .5}s`;
      document.body.append(piece); setTimeout(() => piece.remove(), 3500);
    }
  }
  const wave = $('waveform');
  for (let i = 0; i < 85; i++) { const bar = document.createElement('i'); bar.style.height = `${10 + Math.abs(Math.sin(i * .7)) * 65}px`; bar.style.animationDelay = `${i * -.13}s`; wave.append(bar); }
  const canvas = $('atmosphere'), context = canvas.getContext('2d');
  let w, h, frame = 0;
  function resize() { w = innerWidth; h = innerHeight; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = w * dpr; canvas.height = h * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function background() {
    context.clearRect(0, 0, w, h);
    const t = motion.matches ? 0 : frame++ * .003;
    for (let j = 0; j < 13; j++) {
      context.beginPath();
      for (let x = 0; x <= w; x += 12) { const y = h * .83 + Math.sin(x / w * 7 + j * .12 + t) * 65 + j * 8; x ? context.lineTo(x, y) : context.moveTo(x, y); }
      context.strokeStyle = `rgba(70,153,226,${.025 + j * .002})`; context.lineWidth = 1; context.stroke();
    }
    for (let i = 0; i < 44; i++) { const x = (i * 173.3) % w, y = ((i * 127.7 - t * (i % 3 + 1) * 12) % h + h) % h; context.beginPath(); context.arc(x, y, i % 4 === 0 ? 1.3 : .65, 0, Math.PI * 2); context.fillStyle = '#8bd6ff55'; context.fill(); }
  }
  resize(); background(); window.addEventListener('resize', () => { resize(); background(); });
  setInterval(() => { if (!document.hidden && !motion.matches) background(); }, 50);
  render(); notice(startupMessage);
})();
