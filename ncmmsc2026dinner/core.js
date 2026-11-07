/* Pure lottery state transitions. Shared by the browser and Node tests. */
(function (root) {
  'use strict';
  const MAX_N = 100000;
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function integer(x, min, max = MAX_N) { return Number.isSafeInteger(x) && x >= min && x <= max; }
  function initial() { return { version: 1, n: 200, k: 5, pending: 0, batches: [], current: null, roster: null }; }
  function locked(s) { return !!s.current || s.batches.length > 0; }
  function used(s) { return new Set(s.batches.flatMap(b => b.numbers)); }
  function available(s) { return s.n - used(s).size; }
  function checkRoster(roster) {
    assert(Array.isArray(roster) && integer(roster.length, 1), '名单人数无效。');
    const ids = new Set();
    for (const person of roster) {
      assert(person && Number.isSafeInteger(person.number) && person.number > 0 && !ids.has(person.number), '名单注册号无效或重复。');
      assert(typeof person.registration === 'string' && /^\d+$/.test(person.registration) && Number(person.registration) === person.number && typeof person.name === 'string' && typeof person.organization === 'string', '名单字段无效。');
      ids.add(person.number);
    }
    return ids;
  }
  function importRoster(s, roster) {
    assert(!locked(s), '抽奖已开始，请先重置整场再更换名单。');
    checkRoster(roster);
    return { ...s, n: roster.length, roster, rosterSource: 'csv' };
  }
  function fromNumbers(s, numbers) {
    const roster = numbers.map(number => ({ number, registration: String(number), name: '', organization: '' }));
    return { ...importRoster(s, roster), rosterSource: 'builtin' };
  }
  function randomInt(max) {
    const limit = Math.floor(4294967296 / max) * max;
    const a = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % max;
  }
  function start(s, n, k, all = false, rng = randomInt) {
    assert(!s.current, '请先确认当前批次。');
    assert(integer(n, 1), '注册号上限需为 1～100,000 的整数。');
    assert((!locked(s) && !s.roster) || n === s.n, '本场注册号范围已锁定。');
    assert(integer(k, 0), '新增名额需为 0～100,000 的整数。');
    assert(s.batches.length > 0 || k > 0, '首批新增名额必须大于 0。');
    const requested = k + s.pending;
    assert(requested > 0, '请填写新增名额，或等待需要补抽的名额。');
    const excluded = used(s);
    const pool = (s.roster ? s.roster.map(p => p.number) : Array.from({ length: n }, (_, i) => i + 1)).filter(x => !excluded.has(x));
    assert(pool.length > 0, '号码池已抽完，无法继续抽奖。');
    assert(all || requested <= pool.length, `本批需抽 ${requested} 人，仅剩 ${pool.length} 人。请调整 K，或选择“抽完剩余号码”。`);
    const count = Math.min(requested, pool.length);
    for (let i = 0; i < count; i++) {
      const j = i + rng(pool.length - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { ...s, n, k, current: { id: s.batches.length + 1, requested, added: k, carried: s.pending, numbers: pool.slice(0, count), absent: [], phase: 'rolling' } };
  }
  function reveal(s) {
    assert(s.current?.phase === 'rolling', '当前没有正在滚动的抽奖。');
    return { ...s, current: { ...s.current, phase: 'review' } };
  }
  function toggle(s, number) {
    assert(s.current?.phase === 'review', '请先停止并揭晓号码。');
    assert(s.current.numbers.includes(number), '号码不属于当前批次。');
    const absent = s.current.absent.includes(number) ? s.current.absent.filter(x => x !== number) : [...s.current.absent, number];
    return { ...s, current: { ...s.current, absent } };
  }
  function confirm(s) {
    assert(s.current?.phase === 'review', '请先揭晓并核实当前批次。');
    const batch = { ...s.current, phase: 'confirmed' };
    return { ...s, pending: batch.requested - (batch.numbers.length - batch.absent.length), batches: [...s.batches, batch], current: null };
  }
  function validate(s) {
    assert(s?.version === 1 && integer(s.n, 1) && integer(s.k, 0), '保存的数据格式不受支持。');
    assert(Array.isArray(s.batches) && integer(s.pending, 0, Number.MAX_SAFE_INTEGER), '保存的数据不完整。');
    const rosterIds = s.roster == null ? null : checkRoster(s.roster);
    assert(!rosterIds || s.n === rosterIds.size, '名单人数不一致。');
    let pending = 0;
    const seen = new Set();
    const inspect = (b, index, phase) => {
      assert(b && b.id === index + 1 && phase.includes(b.phase) && integer(b.added, index === 0 ? 1 : 0), '批次数据无效。');
      assert(b.carried === pending && b.requested === b.added + pending && b.requested > 0, '补抽名额数据无效。');
      assert(Array.isArray(b.numbers) && b.numbers.length === Math.min(b.requested, s.n - seen.size) && b.numbers.length > 0 && Array.isArray(b.absent), '批次数量无效。');
      for (const num of b.numbers) { assert((rosterIds ? rosterIds.has(num) : integer(num, 1, s.n)) && !seen.has(num), '保存的号码重复或超出范围。'); seen.add(num); }
      assert(new Set(b.absent).size === b.absent.length && b.absent.every(x => b.numbers.includes(x)), '缺席记录无效。');
      assert(b.phase !== 'rolling' || b.absent.length === 0, '滚动中的缺席记录无效。');
      pending = b.requested - b.numbers.length + b.absent.length;
    };
    s.batches.forEach((b, i) => inspect(b, i, ['confirmed']));
    assert(s.pending === pending, '待补名额不一致。');
    if (s.current !== null) inspect(s.current, s.batches.length, ['rolling', 'review']);
    return s;
  }
  const api = { MAX_N, initial, fromNumbers, importRoster, locked, used, available, randomInt, start, reveal, toggle, confirm, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lottery = api;
})(globalThis);
