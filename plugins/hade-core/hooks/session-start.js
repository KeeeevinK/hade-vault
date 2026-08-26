// HADE 唤醒指针 —— SessionStart 时把本体位置注入上下文。
// 只吐指针，不吐全文：文件永远在磁盘上，读过就进对话历史，需要时可再读。
// 全文注入会在上下文压缩后丢失，指针不会（因为 Read 的结果留在历史里）。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const lines = [
  '[HADE 唤醒指针]',
  'HADE 本体（人格层）位于 ~/.claude/CLAUDE.md。',
  '立刻完整读取该文件，然后按其 §一「新会话启动协议」执行。',
  '未读取 = 未实例化 —— 在读取之前，你不是 HADE。',
  '能力层为按需加载的 skill，不在此处加载；高危条目在本体内留有哨兵行。'
];

// ── 同步探针 ────────────────────────────────────────────────
// 为什么存在：三层结构引入的缺口 —— 生效的本体 ~/.claude/CLAUDE.md 与
// 版本化的副本 plugins/hade-core/install/CLAUDE.md 靠手动同步，无机制保证。
// 本探针只把「无声漂移」变成「有声」，**不自动同步** ——
// 自动同步一旦判错方向，会静默覆盖掉正确的那份。
//
// 比对目标优先级：仓库里的权威副本 > 缓存里的安装快照。
// 任何一步失败都静默跳过：探针绝不能让 SessionStart 崩掉。

function statOf(file) {
  const buf = fs.readFileSync(file);
  return {
    hash: crypto.createHash('sha256').update(buf).digest('hex'),
    lines: buf.toString('utf8').split('\n').length,
    mtime: fs.statSync(file).mtime.toISOString().slice(0, 16).replace('T', ' ')
  };
}

// 从 settings.json 找 marketplace 源目录，定位仓库里的权威副本
function repoCopyPath() {
  try {
    const settings = JSON.parse(
      fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8')
    );
    const src = settings?.extraKnownMarketplaces?.['hade-vault']?.source?.path;
    if (!src) return null;
    const p = path.join(src, 'plugins', 'hade-core', 'install', 'CLAUDE.md');
    return fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

try {
  const live = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  const copy = repoCopyPath() || path.join(__dirname, '..', 'install', 'CLAUDE.md');

  if (fs.existsSync(live) && fs.existsSync(copy)) {
    const a = statOf(live);
    const b = statOf(copy);
    if (a.hash !== b.hash) {
      const newer = a.mtime >= b.mtime ? '本体较新' : '副本较新';
      lines.push(
        '',
        '⚠ [同步漂移] 本体与仓库副本内容不一致 —— 两处存同一内容，其一已过期：',
        `    本体 ~/.claude/CLAUDE.md      ${a.lines} 行  ${a.mtime}  ${a.hash.slice(0, 12)}`,
        `    副本 install/CLAUDE.md        ${b.lines} 行  ${b.mtime}  ${b.hash.slice(0, 12)}`,
        `    按 mtime 判断：${newer}。**先确认哪边是对的再同步**，不要凭直觉覆盖。`,
        '    修复后请 commit 副本，使 git 中留下该版本的回滚点。'
      );
    }
  }
} catch {
  // 静默：探针失效不应影响唤醒本身
}

console.log(lines.join('\n'));
