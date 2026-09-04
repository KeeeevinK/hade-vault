'use strict';
/* hade-uninstall 沙箱测试 —— 绝不碰真本体 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = require('path').resolve(__dirname, '..', '..');
 const TOOL = require('path').join(REPO, 'tools', 'hade-uninstall.js');
const ROOT = path.join(require('os').tmpdir(), 'hade-test-sandbox');
const HOME = path.join(ROOT, '.claude');
const BK = path.join(ROOT, 'backups');

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${extra ? '  → ' + extra : ''}`)); };

function run(args) {
  try {
    const out = execFileSync('node', [TOOL, ...args, '--home', HOME, '--backup-root', BK],
      { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function snapshot(dir) {
  const m = {};
  const rec = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { m[path.relative(dir, f).replace(/\\/g, '/') + '/'] = 'DIR'; rec(f); }
      else m[path.relative(dir, f).replace(/\\/g, '/')] = sha(fs.readFileSync(f));
    }
  };
  if (fs.existsSync(dir)) rec(dir);
  return m;
}

function build() {
  fs.rmSync(ROOT, { recursive: true, force: true });
  w(path.join(HOME, 'CLAUDE.md'),
    '# Claude 全局工作规则\n\n## §零 · 元规则（HADE 决策的三个公理）\n\n元 A · 反复 = 假节省\n\n@hade/cases.md\n');
  w(path.join(HOME, 'hade', 'cases.md'),
    '# HADE 个人记忆层 · 反例库\n\n### M-01 · 三、对话习惯\n\n测试用假条目。\n');
  w(path.join(HOME, 'settings.json'), JSON.stringify({
    enabledPlugins: { 'hade-skills@hade-vault': true, 'hade-core@hade-vault': true, 'some-other@official': true },
    extraKnownMarketplaces: { 'hade-vault': { source: { source: 'directory', path: 'X:\\fake' } } },
    effortLevel: 'high', tui: 'fullscreen', skipWorkflowUsageWarning: true, agentPushNotifEnabled: true,
  }, null, 2) + '\n');
  w(path.join(HOME, 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: {
      'hade-skills@hade-vault': [{ scope: 'user', version: '0.9.0' }],
      'hade-core@hade-vault': [{ scope: 'user', version: '0.9.0' }],
    },
  }, null, 2) + '\n');
  w(path.join(HOME, 'plugins', 'known_marketplaces.json'), JSON.stringify({
    'claude-plugins-official': { source: { source: 'github', repo: 'anthropics/claude-plugins-official' } },
    'hade-vault': { source: { source: 'directory', path: 'X:\\fake' } },
  }, null, 2) + '\n');
  w(path.join(HOME, 'plugins', 'cache', 'hade-vault', 'hade-core', '0.9.0', 'hooks', 'session-start.js'), '// fake hook\n');
  w(path.join(HOME, 'plugins', 'cache', 'hade-vault', 'hade-skills', '0.9.0', 'skills', 'design-color', 'SKILL.md'), '# fake skill\n');
  fs.mkdirSync(path.join(HOME, 'plugins', 'data', 'hade-core-hade-vault'), { recursive: true });
  fs.mkdirSync(path.join(HOME, 'plugins', 'data', 'HADE-core-inline'), { recursive: true });
  fs.mkdirSync(path.join(HOME, 'references'), { recursive: true });
  // 记忆层桥接指针（HADE 按 §八.3 写的）+ 索引行
  const MEM = path.join(HOME, 'projects', 'E--fake-proj', 'memory');
  w(path.join(MEM, 'hade-global-pointer.md'),
    '---\nname: hade-global-pointer\n---\n\nHADE 的唯一源在 `~/.claude/CLAUDE.md`。任何 session 启动时先读它。\n');
  // 非 HADE 的记忆：必须原封不动（提到 CLAUDE.md 但不提 HADE）
  w(path.join(MEM, 'other-note.md'), '---\nname: other-note\n---\n\n某项目的 ~/.claude/CLAUDE.md 用法笔记，与那个体系无关。\n');
  w(path.join(MEM, 'MEMORY.md'),
    '# Memory 索引\n\n- [HADE Global 桥接指针](hade-global-pointer.md) — 以 Global 为准\n- [别的笔记](other-note.md) — 必须保留\n');

  // 实例化数据仓（claudeHome 的同级，可选项）
  w(path.join(ROOT, '.hade', 'active-instance'), 'kevin\n');
  w(path.join(ROOT, '.hade', 'instances', 'kevin', 'persona.md'), '# Persona\n假的个人画像。\n');

  // Claude Code 自己的使用统计（只报告，不该被动）
  w(path.join(ROOT, '.claude.json'), JSON.stringify({
    projects: {}, skillUsage: { 'hade-skills:naming-system': 3, 'other:thing': 1 },
    pluginUsage: { 'hade-core@hade-vault': 5 },
  }, null, 2) + '\n');

  // 非 HADE：必须原封不动
  w(path.join(HOME, 'skills', 'vllm', 'SKILL.md'), '# vllm skill — 与 HADE 无关\n');
  w(path.join(HOME, 'skills', 'axolotl', 'SKILL.md'), '# axolotl skill\n');
  w(path.join(HOME, 'backups', '.claude.json.backup.123'), '{"fake":true}\n');
}

const tokenOf = out => (out.match(/--token ([0-9a-f]{8})/) || [])[1];
const readJ = p => JSON.parse(fs.readFileSync(p, 'utf8'));

console.log('\n=== hade-uninstall 沙箱测试 ===\n');
build();

// T1 doctor
let r = run(['doctor']);
ok('T1  doctor 退出码 1（已安装且正常）', r.code === 1, `实际 ${r.code}`);
// 13 = 5 个文件/目录 + 6 个 JSON 键 + 1 个记忆指针 + 1 个记忆索引行
//      （~/.hade 是可选项，不计入）
ok('T1  检出 13 处', /检出 13 处/.test(r.out), (r.out.match(/检出 \d+ 处/) || ['无'])[0]);
ok('T1  识别记忆桥接指针', /记忆桥接指针/.test(r.out));
ok('T1  识别记忆索引行', /记忆索引行/.test(r.out));
ok('T1  ~/.hade 列为可选、默认不动', /可选（Claude Code 从不读它/.test(r.out) && /实例化数据仓/.test(r.out));
ok('T1  claude.json 使用计数只报告', /只报告，工具不碰/.test(r.out) && /使用计数键/.test(r.out));
ok('T1  报告保留 claude-plugins-official', /claude-plugins-official/.test(r.out));
// 待删项绝不能出现在「保留」清单里 —— 会误导人以为它不会被删
const keepLines = (r.out.match(/^.*保留：.*$/gm) || []);
ok('T1  保留清单里不含 hade-vault', !keepLines.some(l => /hade-vault/.test(l)), keepLines.join(' | '));
ok('T1  非 HADE 的 plugin 被报告为保留', /enabledPlugins 里的 some-other@official/.test(r.out), keepLines.join(' | '));
ok('T1  报告 @import 完整', /@import 完整/.test(r.out));
ok('T1  空 references 被跳过', /空目录，跳过/.test(r.out));
ok('T1  漂移只报告、不改退出码', /本体 ↔ 仓库副本：漂移/.test(r.out) && r.code === 1);

// T1b 真异常（@import 断链）才给退出码 2
fs.renameSync(path.join(HOME, 'hade'), path.join(HOME, 'hade-moved'));
r = run(['doctor']);
ok('T1b @import 断链 → 退出码 2', r.code === 2 && /@import 断链/.test(r.out), `实际 ${r.code}`);
fs.renameSync(path.join(HOME, 'hade-moved'), path.join(HOME, 'hade'));

// T2 dry-run 不改动任何东西
const before = snapshot(HOME);
r = run(['uninstall']);
const tok = tokenOf(r.out);
ok('T2  dry-run 退出码 0', r.code === 0, `实际 ${r.code}`);
ok('T2  发出令牌', !!tok, tok || '无');
ok('T2  dry-run 零改动', JSON.stringify(snapshot(HOME)) === JSON.stringify(before));

// T3~T5 闸门
ok('T3  缺 --confirm 拒绝', run(['uninstall', '--apply', '--token', tok]).code === 3);
ok('T4  --confirm 写错拒绝', run(['uninstall', '--apply', '--confirm', 'OK', '--token', tok]).code === 3);
ok('T5  缺 --token 拒绝', run(['uninstall', '--apply', '--confirm', '确认销毁']).code === 3);

// T6 环境变了 → digest 不符
fs.mkdirSync(path.join(HOME, 'plugins', 'data', 'hade-sneaky'), { recursive: true });
r = run(['uninstall', '--apply', '--confirm', '确认销毁', '--token', tok]);
ok('T6  dry-run 后环境变化 → 拒绝', r.code === 3 && /环境已变/.test(r.out), `code=${r.code}`);
fs.rmSync(path.join(HOME, 'plugins', 'data', 'hade-sneaky'), { recursive: true, force: true });

// T6b 运行时标记（.in_use/<pid>）churn 不该让令牌失效 ——
//     Claude Code 每开关一个窗口就动这个目录，而"我代跑"全程都在会话里
const inUse = path.join(HOME, 'plugins', 'cache', 'hade-vault', 'hade-core', '0.9.0', '.in_use');
fs.mkdirSync(inUse, { recursive: true });
fs.writeFileSync(path.join(inUse, '5980'), '');
r = run(['uninstall']);
const tokA = tokenOf(r.out);
fs.rmSync(path.join(inUse, '5980'));            // 窗口关了
fs.writeFileSync(path.join(inUse, '12345'), ''); // 又开了一个，PID 不同
r = run(['uninstall']);
ok('T6b .in_use churn 后令牌不变', tokenOf(r.out) === tokA, `${tokA} → ${tokenOf(r.out)}`);
r = run(['doctor']);
const size1 = (r.out.match(/plugin 缓存[\s\S]*?(\d+) 字节/) || [])[1];
fs.writeFileSync(path.join(inUse, '999999'), '');
r = run(['doctor']);
ok('T6b .in_use churn 后体积数字不跳', (r.out.match(/plugin 缓存[\s\S]*?(\d+) 字节/) || [])[1] === size1);
fs.rmSync(inUse, { recursive: true, force: true });

// T7 正式执行
const preUninstall = snapshot(HOME);
r = run(['uninstall']);
const tok2 = tokenOf(r.out);
r = run(['uninstall', '--apply', '--confirm', '确认销毁', '--token', tok2]);
ok('T7  apply 退出码 0', r.code === 0, `实际 ${r.code}\n${r.out}`);
ok('T7  自检复检通过', /复检通过/.test(r.out));

// T8 不误伤
ok('T8  skills/ 原封不动', fs.existsSync(path.join(HOME, 'skills', 'vllm', 'SKILL.md')) && fs.existsSync(path.join(HOME, 'skills', 'axolotl', 'SKILL.md')));
ok('T8  backups/ 原封不动', fs.existsSync(path.join(HOME, 'backups', '.claude.json.backup.123')));
const s = readJ(path.join(HOME, 'settings.json'));
ok('T8  个人偏好 4 键全在', s.effortLevel === 'high' && s.tui === 'fullscreen' && s.skipWorkflowUsageWarning === true && s.agentPushNotifEnabled === true, JSON.stringify(s));
ok('T8  enabledPlugins 只剩非 HADE 的那个', JSON.stringify(Object.keys(s.enabledPlugins || {})) === JSON.stringify(['some-other@official']), JSON.stringify(s.enabledPlugins));
ok('T8  extraKnownMarketplaces 已清空', Object.keys(s.extraKnownMarketplaces || {}).length === 0);
const km = readJ(path.join(HOME, 'plugins', 'known_marketplaces.json'));
ok('T8  官方 marketplace 保留', !!km['claude-plugins-official']);
ok('T8  hade-vault 已删', !km['hade-vault']);
const ip = readJ(path.join(HOME, 'plugins', 'installed_plugins.json'));
ok('T8  installed_plugins 保留 version', ip.version === 2 && Object.keys(ip.plugins).length === 0);
ok('T8  本体已移走', !fs.existsSync(path.join(HOME, 'CLAUDE.md')));
ok('T8  记忆层已移走', !fs.existsSync(path.join(HOME, 'hade')));
ok('T8  plugin 缓存已移走', !fs.existsSync(path.join(HOME, 'plugins', 'cache', 'hade-vault')));
ok('T8  两个 data 残留已移走', !fs.existsSync(path.join(HOME, 'plugins', 'data', 'hade-core-hade-vault')) && !fs.existsSync(path.join(HOME, 'plugins', 'data', 'HADE-core-inline')));

// T8b 记忆层：只删 HADE 那条，别的记忆一根汗毛都不能动
const MEM = path.join(HOME, 'projects', 'E--fake-proj', 'memory');
ok('T8b HADE 桥接指针已删', !fs.existsSync(path.join(MEM, 'hade-global-pointer.md')));
ok('T8b 非 HADE 的记忆原封不动', fs.existsSync(path.join(MEM, 'other-note.md')));
const memIdx = fs.readFileSync(path.join(MEM, 'MEMORY.md'), 'utf8');
ok('T8b 索引里 HADE 那行已删', !/hade-global-pointer/.test(memIdx), memIdx.replace(/\n/g, ' | '));
ok('T8b 索引里别的行保留', /other-note\.md/.test(memIdx) && /# Memory 索引/.test(memIdx));

// T8c 可选项默认不动
ok('T8c ~/.hade 未被删（没给 --with-vault）', fs.existsSync(path.join(ROOT, '.hade', 'instances', 'kevin', 'persona.md')));
const cj = readJ(path.join(ROOT, '.claude.json'));
ok('T8c claude.json 的使用计数未被动', !!cj.skillUsage['hade-skills:naming-system'] && !!cj.pluginUsage['hade-core@hade-vault']);

// T9 doctor 干净
r = run(['doctor']);
ok('T9  doctor 退出码 0（未安装）', r.code === 0, `实际 ${r.code}`);
ok('T9  报告未检测到 HADE', /未检测到 HADE/.test(r.out));

// T10 幂等
r = run(['uninstall', '--apply', '--confirm', '确认销毁', '--token', 'deadbeef']);
ok('T10 重复卸载不报错', r.code === 0 && /无事可做/.test(r.out), `code=${r.code}`);

// T11 + T12 还原（先塞一个新键，验证键级合并）
const s2 = readJ(path.join(HOME, 'settings.json'));
s2.myNewSettingAfterUninstall = 'keep-me';
fs.writeFileSync(path.join(HOME, 'settings.json'), JSON.stringify(s2, null, 2) + '\n');

r = run(['restore']);
ok('T11 restore 列出备份', r.code === 0 && /个文件\/目录/.test(r.out));
const bkName = (r.out.match(/(\d{4}-\d{2}-\d{2}T\d{6})/) || [])[1];
r = run(['restore', bkName]);
const tok3 = tokenOf(r.out);
ok('T11 restore dry-run 发令牌', !!tok3);
r = run(['restore', bkName, '--apply', '--confirm', '确认销毁', '--token', tok3]);
ok('T11 restore apply 退出码 0', r.code === 0, `实际 ${r.code}\n${r.out}`);

const s3 = readJ(path.join(HOME, 'settings.json'));
ok('T12 键级合并：卸载后新增的键仍在', s3.myNewSettingAfterUninstall === 'keep-me');
ok('T12 HADE 注册项已补回', !!s3.enabledPlugins['hade-core@hade-vault'] && !!s3.enabledPlugins['hade-skills@hade-vault'] && !!s3.extraKnownMarketplaces['hade-vault']);
ok('T12 非 HADE 的 plugin 未被覆盖', !!s3.enabledPlugins['some-other@official']);
ok('T12 键顺序按原样恢复', JSON.stringify(Object.keys(s3.enabledPlugins)) === JSON.stringify(['hade-skills@hade-vault', 'hade-core@hade-vault', 'some-other@official']), JSON.stringify(Object.keys(s3.enabledPlugins)));
ok('T12 个人偏好未被吃掉', s3.effortLevel === 'high');

// 还原后与卸载前逐字节一致（排除刻意新增的键）
delete s3.myNewSettingAfterUninstall;
fs.writeFileSync(path.join(HOME, 'settings.json'), JSON.stringify(s3, null, 2) + '\n');
const after = snapshot(HOME);
const diff = Object.keys({ ...preUninstall, ...after }).filter(k => preUninstall[k] !== after[k]);
ok('T11 还原后与卸载前逐字节一致', diff.length === 0, diff.join(', '));

// T13 身份校验：无锚点的 CLAUDE.md 必须跳过
fs.writeFileSync(path.join(HOME, 'CLAUDE.md'), '# 我自己的规则\n\n随便写点什么，没有 HADE 的锚点。\n');
r = run(['doctor']);
ok('T13 无锚点的 CLAUDE.md 被跳过', /判定为「你自己的规则文件」/.test(r.out));
r = run(['uninstall']);
ok('T13 卸载计划里不含它', !/移走.*人格层骨架/.test(r.out), r.out.match(/移走.*/g));

// ===== T14 · --with-vault（可选项）=====
build();
r = run(['uninstall']);
const tokNo = tokenOf(r.out);
ok('T14 默认计划不含 ~/.hade', !/移走.*实例化数据仓/.test(r.out));
ok('T14 明确提示有未纳入的可选项', /未纳入（可选）/.test(r.out) && /\.hade/.test(r.out));
r = run(['uninstall', '--with-vault']);
const tokVault = tokenOf(r.out);
ok('T14 清单变了 → 令牌也变', tokNo !== tokVault, `${tokNo} vs ${tokVault}`);
ok('T14 --with-vault 计划含 ~/.hade', /移走.*实例化数据仓/.test(r.out));
r = run(['uninstall', '--with-vault', '--apply', '--confirm', '确认销毁', '--token', tokVault]);
ok('T14 apply 成功', r.code === 0, `code=${r.code}\n${r.out}`);
ok('T14 ~/.hade 已移走', !fs.existsSync(path.join(ROOT, '.hade')));
r = run(['restore']);
const bk14 = (r.out.match(/(\d{4}-\d{2}-\d{2}T\d{6})/) || [])[1];
r = run(['restore', bk14]);
r = run(['restore', bk14, '--apply', '--confirm', '确认销毁', '--token', tokenOf(r.out)]);
ok('T14 restore 把 ~/.hade 装回来', r.code === 0 && fs.existsSync(path.join(ROOT, '.hade', 'instances', 'kevin', 'persona.md')), `code=${r.code}\n${r.out}`);

// ===== T15 · 你装 HADE 之前的原规则 =====
build();
w(path.join(HOME, 'CLAUDE.md.backup'), '# 我装 HADE 之前的规则\n\n第二行\n第三行\n');
r = run(['doctor']);
ok('T15 doctor 报告原规则备份', /你装 HADE 之前的原规则/.test(r.out) && /CLAUDE\.md\.backup/.test(r.out));
r = run(['uninstall']);
ok('T15 计划里有还原步骤', /还原.*CLAUDE\.md\.backup.*CLAUDE\.md/.test(r.out), (r.out.match(/.*还原.*/) || ['无'])[0]);
r = run(['uninstall', '--apply', '--confirm', '确认销毁', '--token', tokenOf(r.out)]);
ok('T15 apply 成功', r.code === 0, `code=${r.code}\n${r.out}`);
ok('T15 原规则已改回 CLAUDE.md', /我装 HADE 之前的规则/.test(fs.readFileSync(path.join(HOME, 'CLAUDE.md'), 'utf8')));
ok('T15 卸载后不是空环境', fs.existsSync(path.join(HOME, 'CLAUDE.md')) && !fs.existsSync(path.join(HOME, 'CLAUDE.md.backup')));
r = run(['restore']);
const bk15 = (r.out.match(/(\d{4}-\d{2}-\d{2}T\d{6})/) || [])[1];
r = run(['restore', bk15]);
r = run(['restore', bk15, '--apply', '--confirm', '确认销毁', '--token', tokenOf(r.out)]);
ok('T15 restore 复位原规则 + 装回 HADE 本体', r.code === 0
  && fs.existsSync(path.join(HOME, 'CLAUDE.md.backup'))
  && /我装 HADE 之前的规则/.test(fs.readFileSync(path.join(HOME, 'CLAUDE.md.backup'), 'utf8'))
  && /§零/.test(fs.readFileSync(path.join(HOME, 'CLAUDE.md'), 'utf8')), `code=${r.code}\n${r.out}`);

// ===== T16 · 空容器清理（从没装过 plugin 的起点）=====
build();
// 把 settings 换成"只有个人偏好 + HADE 的键"—— 删完 HADE，两个容器都该空掉
const pristine = {
  effortLevel: 'high', tui: 'fullscreen',
  enabledPlugins: { 'hade-skills@hade-vault': true, 'hade-core@hade-vault': true },
  extraKnownMarketplaces: { 'hade-vault': { source: { source: 'directory', path: 'X:\\fake' } } },
};
fs.writeFileSync(path.join(HOME, 'settings.json'), JSON.stringify(pristine, null, 2) + '\n');
const beforeS = fs.readFileSync(path.join(HOME, 'settings.json'), 'utf8');

r = run(['uninstall']);
ok('T16 dry-run 预告会删空容器', /删空容器/.test(r.out) && /enabledPlugins/.test(r.out) && /extraKnownMarketplaces/.test(r.out),
   (r.out.match(/.*删空容器.*/g) || ['无']).join(' | '));
r = run(['uninstall', '--apply', '--confirm', '确认销毁', '--token', tokenOf(r.out)]);
ok('T16 apply 成功', r.code === 0, `code=${r.code}\n${r.out}`);
const afterS = readJ(path.join(HOME, 'settings.json'));
ok('T16 两个空容器都已清掉', !('enabledPlugins' in afterS) && !('extraKnownMarketplaces' in afterS), JSON.stringify(afterS));
ok('T16 个人偏好一个不少', afterS.effortLevel === 'high' && afterS.tui === 'fullscreen' && Object.keys(afterS).length === 2, JSON.stringify(afterS));
// installed_plugins 的 plugins 键不设 dropWhenEmpty —— 空了也必须留着
const afterIP = readJ(path.join(HOME, 'plugins', 'installed_plugins.json'));
ok('T16 installed_plugins 的 plugins 键保留（无实证不敢删）', 'plugins' in afterIP && Object.keys(afterIP.plugins).length === 0, JSON.stringify(afterIP));

r = run(['restore']);
const bk16 = (r.out.match(/(\d{4}-\d{2}-\d{2}T\d{6})/) || [])[1];
r = run(['restore', bk16]);
r = run(['restore', bk16, '--apply', '--confirm', '确认销毁', '--token', tokenOf(r.out)]);
ok('T16 restore 后 settings.json 与卸载前逐字节一致',
   r.code === 0 && fs.readFileSync(path.join(HOME, 'settings.json'), 'utf8') === beforeS,
   `code=${r.code}\n实际:\n${fs.readFileSync(path.join(HOME, 'settings.json'), 'utf8')}\n期望:\n${beforeS}`);

console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===\n`);
process.exit(fail ? 1 : 0);
