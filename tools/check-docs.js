#!/usr/bin/env node
'use strict';

/**
 * check-docs — 查文档里的数字断言有没有过期
 *
 *   node tools/check-docs.js          人读报告，有不符则退出码 1
 *   node tools/check-docs.js --json   机器可读
 *
 * 为什么需要它：同一个数字散在 4-5 份分发文档里（拿 zip 的人只读
 * GETTING-STARTED，让 AI 装的只喂 AGENT-SETUP，两边都得看到），这种冗余是
 * 有意的、不该合并。代价是改一处别处就地过期 —— 实际已栽过三次：
 * 「892 行」「40 份 eval」「1499 行」都是发现时才知道错了很久。
 *
 * 所以这里不消除冗余，只让冗余可校验：每个数字都从仓库现场量，
 * 对不上就报文件与行号。零依赖。
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

// ---------------------------------------------------------------- 度量

const read = p => fs.readFileSync(path.join(REPO, p), 'utf8');
// 仓库钉死的口径：行数按换行符分段计，末尾换行算一段，故 wc -l 会少 1
const lines = p => read(p).split('\n').length;
const countFiles = (dir, filter = () => true) => {
  try { return fs.readdirSync(path.join(REPO, dir)).filter(filter).length; } catch { return -1; }
};
const countDirs = dir => {
  try {
    return fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }).filter(e => e.isDirectory()).length;
  } catch { return -1; }
};
const countPy = dir => {
  let n = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else if (e.name.endsWith('.py')) n++;
    }
  };
  try { walk(path.join(REPO, dir)); } catch { return -1; }
  return n;
};

// ---------------------------------------------------------------- 断言表
//
// 每条：正则从文档里捕获数字，actual() 从仓库现场量。
// 正则要锚在**能唯一定位**的措辞上 —— 只匹配「(\d+) 行」会撞上无关句子。

const CHECKS = [
  {
    id: 'body-lines',
    what: '人格层骨架行数',
    actual: () => lines('plugins/hade-core/install/CLAUDE.md'),
    patterns: [
      /CLAUDE\.md`?[，,（(]\s*(\d+)\s*行/g,
      /CLAUDE\.md\s+(\d+)\s*行/g,
      /\*\*骨架\*\*（(\d+)\s*行/g,
      /本体全文副本（(\d+)\s*行/g,
    ],
  },
  {
    id: 'eval-results',
    what: 'evals/results 结果文件数',
    actual: () => countFiles('plugins/hade-skills/evals/results', f => f.endsWith('.json')),
    patterns: [/results\/?[`*.json]*`?）?[（(](\d+)\s*[份个]/g, /测试集 \+ (\d+)\s*份实测结果/g],
  },
  {
    id: 'memory-cases',
    what: '记忆层反例条数',
    actual: () => (read('plugins/hade-core/install/hade/cases.md').match(/^### M-/gm) || []).length,
    // 捕获组一律放在 group 1：早先第一条把 (\s*) 也括了起来，取 group 2，
    // 于是第二条模式的数字落在 group 1、被读成 undefined → NaN → 静默跳过。
    // 症状正是"报告全绿但少扫了一处"，即仓库方法论里那类假阴性。
    patterns: [/cases\.md`?[，,]\s*(\d+)\s*条/g, /(\d+)\s*条翻车记录/g],
  },
  {
    id: 'decision-log',
    what: '决策史条目数',
    actual: () => (read('archive/decision-log.md').match(/^- \*\*\d{4}-/gm) || []).length,
    patterns: [/decision-log\.md`?（(\d+)\s*条/g, /决策史（(\d+)\s*条）/g],
  },
  {
    id: 'skills',
    what: 'skill 数',
    actual: () => countDirs('plugins/hade-skills/skills'),
    patterns: [/(\d+)\s*个?\s*skill\s*\+/g, /这\s*(\d+)\s*个 skill/g],
  },
  {
    id: 'validators',
    what: '可执行校验器数',
    actual: () => countPy('plugins/hade-skills/skills'),
    patterns: [/\+\s*(\d+)\s*个?可执行校验器/g, /\+\s*(\d+)\s*校验器/g],
  },
  {
    id: 'exec-log',
    what: '执行日志行数',
    actual: () => lines('archive/PLAN-AND-EXECUTION-LOG.md'),
    patterns: [/PLAN-AND-EXECUTION-LOG\.md`?）?[（(](\d+)\s*行/g, /实测数据（(\d+)\s*行）/g],
  },
];

// ---------------------------------------------------------------- 扫描

function docs() {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'archive' || e.name === 'node_modules') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.md')) out.push(path.relative(REPO, f).replace(/\\/g, '/'));
    }
  };
  walk(REPO);
  return out.sort();
}

const findings = [];
const measured = {};

for (const c of CHECKS) {
  const want = c.actual();
  measured[c.id] = { what: c.what, actual: want, hits: 0, bad: 0 };
  if (want < 0) { findings.push({ level: 'error', check: c.id, text: `量不到实际值（路径缺失？）` }); continue; }
  for (const file of docs()) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    const rows = text.split('\n');
    for (const re of c.patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const got = parseInt(m[c.group || 1], 10);
        if (!Number.isFinite(got)) continue;
        const line = text.slice(0, m.index).split('\n').length;
        measured[c.id].hits++;
        if (got !== want) {
          measured[c.id].bad++;
          findings.push({
            level: 'stale', check: c.id, what: c.what, file, line,
            found: got, expected: want, excerpt: (rows[line - 1] || '').trim().slice(0, 76),
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 输出

if (JSON_MODE) {
  console.log(JSON.stringify({ ok: findings.length === 0, measured, findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

console.log('');
console.log('  文档数字断言校验');
console.log('  扫描 ' + docs().length + ' 份 .md（archive/ 是历史记录，不扫）');
console.log('');
for (const c of CHECKS) {
  const m = measured[c.id];
  const mark = m.bad ? '✗' : m.hits ? '✓' : '·';
  console.log('  ' + mark + ' ' + m.what.padEnd(22) + '实际 ' + String(m.actual).padEnd(6) +
    '文档命中 ' + m.hits + (m.bad ? '  其中 ' + m.bad + ' 处不符' : ''));
}
if (findings.length) {
  console.log('');
  console.log('  ── 过期的断言 ──');
  for (const f of findings) {
    if (f.level === 'error') { console.log('  ! ' + f.check + '：' + f.text); continue; }
    console.log('  ✗ ' + f.file + ':' + f.line + '  ' + f.what + ' 写着 ' + f.found + '，实际 ' + f.expected);
    console.log('      ' + f.excerpt);
  }
  console.log('');
  console.log('  改完这些再提交；archive/ 下的历史记录不要改，那是当时的原话。');
} else {
  console.log('');
  console.log('  全部一致。');
}
console.log('');
process.exit(findings.length ? 1 : 0);
