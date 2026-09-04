#!/usr/bin/env node
'use strict';

/**
 * check-context — 量一下 HADE 每个会话吃掉多少上下文
 *
 *   node tools/check-context.js           人读报告
 *   node tools/check-context.js --json    机器可读
 *   node tools/check-context.js --repo    量仓库副本而不是已安装的本体
 *
 * 为什么需要它：人格层是**无条件加载**的 —— 每个会话、每个项目，
 * 在你打第一个字之前就已经进了上下文。这是 100% 生效的代价，
 * 而这个代价此前从没被量过（执行日志里 0 处讨论）。
 *
 * 本工具不替你做判断，只把数字和分布摆出来：哪一章最重、能砍哪里、
 * 关掉记忆层省多少。要不要接受这个代价是你的事。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');
const USE_REPO = process.argv.includes('--repo');

// 重构前的基线，来自 archive/PLAN-AND-EXECUTION-LOG.md
const BASELINE = { lines: 1090, bytes: 91052, label: '2026-08 重构前' };

// ---------------------------------------------------------------- 度量

const CJK = /[㐀-䶿一-鿿豈-﫿　-〿＀-￯]/;

/**
 * token 估算。没有本地 tokenizer，用公开的经验值：
 * 中日韩字符约 1 char ≈ 1 token；拉丁文本约 3.5-4 char ≈ 1 token。
 * 给区间而不是单值 —— 真实值取决于分词器，别把估算当实测。
 */
function estimate(text) {
  const chars = [...text];
  const cjk = chars.filter(c => CJK.test(c)).length;
  const rest = chars.length - cjk;
  return {
    chars: chars.length,
    cjk,
    bytes: Buffer.byteLength(text, 'utf8'),
    tokensLow: Math.round(cjk * 0.9 + rest / 4),
    tokensHigh: Math.round(cjk * 1.2 + rest / 3.2),
  };
}

function pick() {
  const home = path.join(os.homedir(), '.claude');
  const installed = { body: path.join(home, 'CLAUDE.md'), mem: path.join(home, 'hade', 'cases.md') };
  const repo = {
    body: path.join(REPO, 'plugins/hade-core/install/CLAUDE.md'),
    mem: path.join(REPO, 'plugins/hade-core/install/hade/cases.md'),
  };
  if (USE_REPO) return { ...repo, source: '仓库副本' };
  if (fs.existsSync(installed.body)) return { ...installed, source: '已安装（' + home + '）' };
  return { ...repo, source: '仓库副本（本机未安装）' };
}

/** 按 `## 标题` 切段，返回每段的字符数 */
function bySection(text) {
  const out = [];
  let cur = '(文件头)', buf = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^## (.+)/);
    if (m) { out.push({ name: cur, chars: [...buf.join('\n')].length }); cur = m[1].trim(); buf = [line]; }
    else buf.push(line);
  }
  out.push({ name: cur, chars: [...buf.join('\n')].length });
  return out.filter(s => s.chars > 0).sort((a, b) => b.chars - a.chars);
}

// ---------------------------------------------------------------- 汇总

const src = pick();
const bodyText = fs.existsSync(src.body) ? fs.readFileSync(src.body, 'utf8') : '';
const memText = fs.existsSync(src.mem) ? fs.readFileSync(src.mem, 'utf8') : '';

if (!bodyText) {
  const msg = '找不到本体：' + src.body;
  if (JSON_MODE) { console.log(JSON.stringify({ ok: false, error: msg })); }
  else { console.log('\n  ' + msg + '\n'); }
  process.exit(2);
}

const body = estimate(bodyText);
const mem = estimate(memText);
const total = {
  chars: body.chars + mem.chars,
  bytes: body.bytes + mem.bytes,
  tokensLow: body.tokensLow + mem.tokensLow,
  tokensHigh: body.tokensHigh + mem.tokensHigh,
};
const sections = bySection(bodyText);
const bodyLines = bodyText.split('\n').length;

if (JSON_MODE) {
  console.log(JSON.stringify({
    source: src.source, body: { ...body, lines: bodyLines }, memory: mem, total,
    sections: sections.map(s => ({ ...s, pct: +(s.chars / body.chars * 100).toFixed(1) })),
    baseline: BASELINE,
  }, null, 2));
  process.exit(0);
}

const n = x => x.toLocaleString('en-US');
console.log('');
console.log('  HADE 上下文开销');
console.log('  来源  ' + src.source);
console.log('');
console.log('  每个会话无条件加载：');
console.log('    人格层骨架   ' + String(bodyLines).padStart(5) + ' 行  ' +
  String(n(body.chars)).padStart(7) + ' 字符  ' + String(n(body.bytes)).padStart(7) + ' 字节');
console.log('    记忆层       ' + String(memText ? memText.split('\n').length : 0).padStart(5) + ' 行  ' +
  String(n(mem.chars)).padStart(7) + ' 字符  ' + String(n(mem.bytes)).padStart(7) + ' 字节');
console.log('    ' + '-'.repeat(56));
console.log('    合计                ' + String(n(total.chars)).padStart(7) + ' 字符  ' +
  String(n(total.bytes)).padStart(7) + ' 字节');
console.log('');
console.log('    估算 ≈ ' + n(total.tokensLow) + ' – ' + n(total.tokensHigh) + ' token');
console.log('    （无本地分词器，按中日韩 1 字≈1 token、拉丁 3.2-4 字≈1 token 推算；');
console.log('      是估算不是实测，真实值取决于分词器）');
console.log('');
console.log('  骨架各章占比（想瘦身就从上面砍）：');
for (const s of sections.slice(0, 8)) {
  const pct = s.chars / body.chars * 100;
  const bar = '█'.repeat(Math.max(1, Math.round(pct / 2)));
  console.log('    ' + (pct.toFixed(1) + '%').padStart(6) + '  ' + String(n(s.chars)).padStart(6) +
    ' 字符  ' + bar.padEnd(16) + ' ' + s.name.slice(0, 34));
}
if (sections.length > 8) {
  const rest = sections.slice(8).reduce((a, b) => a + b.chars, 0);
  console.log('    ' + ((rest / body.chars * 100).toFixed(1) + '%').padStart(6) + '  ' +
    String(n(rest)).padStart(6) + ' 字符  ' + ' '.repeat(16) + ' 其余 ' + (sections.length - 8) + ' 节');
}
console.log('');
console.log('  可选的降低方式：');
console.log('    · 只装能力层（方式 A）        开销 0 —— skill 按需加载，不进常驻上下文');
console.log('    · 用空模板换掉记忆层          省 ' + n(mem.chars) + ' 字符（' +
  (mem.chars / total.chars * 100).toFixed(0) + '%），骨架规则不受影响');
console.log('    · 砍掉用不上的章节            上表最重的两章合计 ' +
  ((sections[0].chars + sections[1].chars) / body.chars * 100).toFixed(0) + '%');
console.log('');
console.log('  对照：' + BASELINE.label + ' 为 ' + BASELINE.lines + ' 行 / ' + n(BASELINE.bytes) +
  ' 字节，现为 ' + bodyLines + ' 行 / ' + n(body.bytes) + ' 字节（' +
  ((body.bytes / BASELINE.bytes - 1) * 100).toFixed(1) + '%）。');
console.log('');
console.log('  ⚠ 这个开销值不值，项目从未做过端到端测量 —— 触发率测的是「skill 调没调」，');
console.log('    不是「常驻规则对任务质量的净影响」。如实标注，别当成已验证的结论。');
console.log('');
