'use strict';
/*
 * 三向差分对照组 —— 核实「卸载后是否等价于从未安装」
 *
 *   A（对照）  只有 Claude Code 自己的东西，从未装过 HADE
 *   B（实验）  A 的全部内容 + 照安装文档装一遍 HADE → 再完整卸载
 *
 * 三个方向都读：A有B无(多删) / B有A无(没删净) / 同名hash不同(改坏了)
 * 只比路径集合与内容 hash，不比 mtime。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = require('path').resolve(__dirname, '..', '..');
const TOOL = require('path').join(REPO, 'tools', 'hade-uninstall.js');
const LAB = path.join(require('os').tmpdir(), 'hade-test-lab');

const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const J = (o) => JSON.stringify(o, null, 2) + '\n';

/** 快照：相对路径 → 内容 hash（目录也登记，用来发现空目录的增减） */
function snap(root) {
  const m = {};
  if (!fs.existsSync(root)) return m;
  const rec = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const f = path.join(d, e.name);
      const rel = path.relative(root, f).replace(/\\/g, '/');
      if (e.isDirectory()) { m[rel + '/'] = '<dir>'; rec(f); }
      else m[rel] = sha(fs.readFileSync(f));
    }
  };
  rec(root);
  return m;
}

/** ============ A：Claude Code 自己的东西 ============ */
function buildBaseline(root, variant) {
  fs.rmSync(root, { recursive: true, force: true });
  const H = path.join(root, '.claude');

  // 你自己的偏好 —— 与 plugin 无关，任何情况下都该原样保留
  const settings = {
    effortLevel: 'high', tui: 'fullscreen',
    skipWorkflowUsageWarning: true, agentPushNotifEnabled: true,
  };

  if (variant === 'with-plugins') {
    // 变体 1：你本来就装过别的 plugin
    settings.enabledPlugins = { 'someone-else@official': true };
    w(path.join(H, 'plugins', 'installed_plugins.json'), J({
      version: 2, plugins: { 'someone-else@official': [{ scope: 'user', version: '1.0.0' }] },
    }));
    w(path.join(H, 'plugins', 'known_marketplaces.json'), J({
      'claude-plugins-official': { source: { source: 'github', repo: 'anthropics/claude-plugins-official' } },
    }));
  }
  // 变体 2 'pristine'：从没装过任何 plugin —— settings 里没有 enabledPlugins，
  //                    installed_plugins.json / known_marketplaces.json 都不存在

  w(path.join(H, 'settings.json'), J(settings));
  w(path.join(H, 'plugins', 'blocklist.json'), J({ blocked: [] }));

  // 你自己的 skill、Claude Code 自己的备份、与 HADE 无关的项目记忆
  w(path.join(H, 'skills', 'vllm', 'SKILL.md'), '# vllm\n');
  w(path.join(H, 'skills', 'axolotl', 'SKILL.md'), '# axolotl\n');
  w(path.join(H, 'backups', '.claude.json.backup.123'), '{"fake":true}\n');
  const MEM = path.join(H, 'projects', 'E--other-proj', 'memory');
  w(path.join(MEM, 'other-note.md'), '---\nname: other-note\n---\n\n某项目笔记，提到 ~/.claude/CLAUDE.md 但与那个体系无关。\n');
  w(path.join(MEM, 'MEMORY.md'), '# Memory 索引\n\n- [别的笔记](other-note.md) — 必须保留\n');

  // Claude Code 自己的运行时产物 —— 不是 HADE 装的，也不该被碰
  w(path.join(H, 'sessions', 'abc.jsonl'), '{"t":1}\n');
  w(path.join(H, 'telemetry', 'x.log'), 'log\n');
  w(path.join(H, 'shell-snapshots', 'snap.sh'), '#!/bin/sh\n');

  w(path.join(root, '.claude.json'), J({
    projects: { 'E:\\some\\proj': { lastUsed: 1 } },
    skillUsage: { 'other:thing': 1 }, pluginUsage: {},
  }));
  return H;
}

/** ============ B：在 A 之上，照安装文档装一遍 HADE ============ */
function installHade(root) {
  const H = path.join(root, '.claude');

  // MIGRATE.md 第 3 步：拷本体 + 记忆层
  w(path.join(H, 'CLAUDE.md'),
    '# Claude 全局工作规则\n\n## §零 · 元规则（HADE 决策的三个公理）\n\n元 A · 反复 = 假节省\n\n@hade/cases.md\n');
  w(path.join(H, 'hade', 'cases.md'), '# HADE 个人记忆层 · 反例库\n\n### M-01 · 三、对话习惯\n\n假条目。\n');

  // MIGRATE.md 第 2 步：marketplace add + plugin install ×2
  const sp = path.join(H, 'settings.json');
  const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
  s.enabledPlugins = Object.assign({}, s.enabledPlugins, {
    'hade-skills@hade-vault': true, 'hade-core@hade-vault': true,
  });
  s.extraKnownMarketplaces = { 'hade-vault': { source: { source: 'directory', path: 'X:\\fake' } } };
  fs.writeFileSync(sp, J(s));

  const ipp = path.join(H, 'plugins', 'installed_plugins.json');
  const ip = fs.existsSync(ipp) ? JSON.parse(fs.readFileSync(ipp, 'utf8')) : { version: 2, plugins: {} };
  ip.plugins['hade-skills@hade-vault'] = [{ scope: 'user', version: '0.9.0' }];
  ip.plugins['hade-core@hade-vault'] = [{ scope: 'user', version: '0.9.0' }];
  fs.writeFileSync(ipp, J(ip));

  const kmp = path.join(H, 'plugins', 'known_marketplaces.json');
  const km = fs.existsSync(kmp) ? JSON.parse(fs.readFileSync(kmp, 'utf8')) : {};
  km['hade-vault'] = { source: { source: 'directory', path: 'X:\\fake' } };
  fs.writeFileSync(kmp, J(km));

  // plugin 缓存 + 运行时数据目录
  w(path.join(H, 'plugins', 'cache', 'hade-vault', 'hade-core', '0.9.0', 'hooks', 'session-start.js'), '// hook\n');
  w(path.join(H, 'plugins', 'cache', 'hade-vault', 'hade-skills', '0.9.0', 'skills', 'design-color', 'SKILL.md'), '# skill\n');
  fs.mkdirSync(path.join(H, 'plugins', 'data', 'hade-core-hade-vault'), { recursive: true });
  fs.mkdirSync(path.join(H, 'plugins', 'data', 'HADE-core-inline'), { recursive: true });

  // HADE 自己按 §八.3 写的记忆桥接指针 + 索引行
  const MEM = path.join(H, 'projects', 'E--other-proj', 'memory');
  w(path.join(MEM, 'hade-global-pointer.md'), '---\nname: hade-global-pointer\n---\n\nHADE 的唯一源在 `~/.claude/CLAUDE.md`。\n');
  const idx = fs.readFileSync(path.join(MEM, 'MEMORY.md'), 'utf8');
  fs.writeFileSync(path.join(MEM, 'MEMORY.md'),
    idx.replace('- [别的笔记]', '- [HADE Global 桥接指针](hade-global-pointer.md) — 以 Global 为准\n- [别的笔记]'));

  // 实例化数据仓（claudeHome 的同级）
  w(path.join(root, '.hade', 'active-instance'), 'kevin\n');
  w(path.join(root, '.hade', 'instances', 'kevin', 'persona.md'), '# Persona\n');

  // Claude Code 因为用过 HADE 而写的使用计数
  const cjp = path.join(root, '.claude.json');
  const cj = JSON.parse(fs.readFileSync(cjp, 'utf8'));
  cj.skillUsage['hade-skills:naming-system'] = 3;
  cj.pluginUsage['hade-core@hade-vault'] = 5;
  fs.writeFileSync(cjp, J(cj));
}

function run(home, bk, args) {
  try {
    const out = execFileSync('node', [TOOL, ...args, '--home', home, '--backup-root', bk],
      { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    return { code: 0, out };
  } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

/** ============ 跑一轮 ============ */
function roundtrip(variant, withVault) {
  const A = path.join(LAB, `A-${variant}`);
  const B = path.join(LAB, `B-${variant}${withVault ? '-vault' : ''}`);

  buildBaseline(A, variant);
  buildBaseline(B, variant);
  installHade(B);
  // 对照组也要有 ~/.hade？不 —— A 是"从未装过 HADE"，所以没有。
  // 但没开 --with-vault 时 B 会保留 ~/.hade，这正是要如实读出来的差异。

  const hB = path.join(B, '.claude');
  const bk = path.join(B, '_backups');
  const flags = withVault ? ['--with-vault'] : [];
  let r = run(hB, bk, ['uninstall', ...flags]);
  const tok = (r.out.match(/--token ([0-9a-f]{8})/) || [])[1];
  if (!tok) return { variant, withVault, error: '拿不到令牌\n' + r.out };
  r = run(hB, bk, ['uninstall', ...flags, '--apply', '--confirm', '确认销毁', '--token', tok]);
  if (r.code !== 0) return { variant, withVault, error: `apply 失败 code=${r.code}\n${r.out}` };

  // 备份目录是卸载的产物，不参与"是否回到出厂"的比较
  fs.rmSync(bk, { recursive: true, force: true });

  const sa = snap(A), sb = snap(B);
  const keys = [...new Set([...Object.keys(sa), ...Object.keys(sb)])].sort();
  const onlyA = keys.filter(k => sa[k] && !sb[k]);        // ① 多删了
  const onlyB = keys.filter(k => !sa[k] && sb[k]);        // ② 没删净
  const diff = keys.filter(k => sa[k] && sb[k] && sa[k] !== sb[k]);  // ③ 改坏了
  return { variant, withVault, onlyA, onlyB, diff };
}

/** ============ 报告 ============ */
console.log('\n════ 三向差分对照组 ════\n');
const results = [];
for (const variant of ['with-plugins', 'pristine']) {
  for (const withVault of [false, true]) {
    results.push(roundtrip(variant, withVault));
  }
}

let bad = 0;
for (const r of results) {
  const tag = `${r.variant}${r.withVault ? ' + --with-vault' : ''}`;
  console.log(`── ${tag} ──`);
  if (r.error) { console.log('  ✗ ' + r.error); bad++; continue; }
  const show = (label, arr, mark) => {
    if (!arr.length) { console.log(`  ✓ ${label}：无`); return; }
    bad++;
    console.log(`  ${mark} ${label}：${arr.length} 项`);
    arr.forEach(k => console.log(`      ${k}`));
  };
  show('① A有B无（多删了）  ', r.onlyA, '✗');
  show('② B有A无（没删净）  ', r.onlyB, '!');
  show('③ 同名内容不同（改坏）', r.diff, '!');
  console.log('');
}
console.log(bad === 0 ? '════ 四轮全部逐字节等价 ════\n' : `════ 有 ${bad} 处差异，见上 ════\n`);
