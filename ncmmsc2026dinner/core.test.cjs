const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./core.js');
const rng = () => 0;
const round = (s, n, k, absent = [], all = false) => { let x = L.reveal(L.start(s, n, k, all, rng)); for (const value of absent) x = L.toggle(x, value); return L.confirm(x); };
test('10 + 5 + 0: missing places carry, winners and absentees never return', () => {
 let s = round(L.initial(), 30, 10, [1,2]); assert.equal(s.pending, 2);
 s = round(s,30,5,[11]); assert.equal(s.batches[1].numbers.length,7); assert.equal(s.pending,1);
 s = round(s,30,0); assert.equal(s.batches[2].numbers.length,1); assert.equal(s.pending,0);
 assert.equal(L.used(s).size,18); assert.equal(L.available(s),12); L.validate(s);
});
test('pool shortage carries unfilled places plus absentees', () => {
 let s = round(L.initial(),5,3,[1,2]);
 assert.throws(()=>L.start(s,5,5), /仅剩/);
 s=round(s,5,5,[4],true); assert.equal(s.pending,6); assert.equal(L.available(s),0);
 assert.throws(()=>L.start(s,5,0), /已抽完/); L.validate(s);
});
test('range, integers, first zero, lock and zero demand validation', () => {
 for (const n of [0,-1,2.2,NaN,100001]) assert.throws(()=>L.start(L.initial(),n,1));
 for (const k of [-1,1.5,NaN,100001]) assert.throws(()=>L.start(L.initial(),10,k));
 assert.throws(()=>L.start(L.initial(),10,0));
 const s=round(L.initial(),10,1); assert.throws(()=>L.start(s,11,1)); assert.throws(()=>L.start(s,10,0));
});
test('state machine prevents repeated draw, reveal, confirm and permits toggling', () => {
 let s=L.start(L.initial(),10,3,false,rng); assert.throws(()=>L.start(s,10,1)); assert.throws(()=>L.confirm(s)); assert.throws(()=>L.toggle(s,1));
 s=L.reveal(s); assert.throws(()=>L.reveal(s)); s=L.toggle(s,1); assert.deepEqual(s.current.absent,[1]); s=L.toggle(s,1); assert.deepEqual(s.current.absent,[]);
 assert.throws(()=>L.toggle(s,9)); s=L.confirm(s); assert.throws(()=>L.confirm(s));
});
test('persist/reload preserves exact rolling, review and confirmed results', () => {
 let s=L.start(L.initial(),100,12); const numbers=[...s.current.numbers];
 for (const phase of ['rolling','review','confirmed']) {
   const loaded=L.validate(JSON.parse(JSON.stringify(s)));
   assert.deepEqual(loaded.current?.numbers || loaded.batches[0].numbers,numbers);
   if (phase==='rolling') s=L.reveal(loaded); else if (phase==='review') s=L.confirm(loaded);
 }
});
test('sampling spans valid unique range, full pool includes all numbers', () => {
 for(let i=0;i<100;i++){ const s=L.start(L.initial(),97,60); assert.equal(new Set(s.current.numbers).size,60); assert.ok(s.current.numbers.every(n=>n>=1 && n<=97)); }
 const s=L.start(L.initial(),100,100); assert.deepEqual([...s.current.numbers].sort((a,b)=>a-b),Array.from({length:100},(_,i)=>i+1));
});
test('restore rejects corrupt counts, duplicates and missing fields', () => {
 const s=round(L.initial(),10,3); let bad=structuredClone(s); bad.pending=2; assert.throws(()=>L.validate(bad));
 bad=structuredClone(s); bad.batches[0].numbers[1]=bad.batches[0].numbers[0]; assert.throws(()=>L.validate(bad));
 assert.throws(()=>L.validate({version:1}));
});
