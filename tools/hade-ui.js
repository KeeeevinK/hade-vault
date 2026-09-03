#!/usr/bin/env node
'use strict';

/**
 * hade-ui — HADE 卸载器的可视化界面（只读）
 *
 *   node tools/hade-ui.js          启动并自动打开浏览器
 *   双击 tools/HADE-卸载器.cmd     同上，不用开终端
 *
 * 【只读契约】本服务永远不会执行 --apply。
 * 它只调用 hade-uninstall.js 的三个只读子命令（doctor / uninstall 的 dry-run / restore 的列表），
 * 真正的删除必须你自己在终端里跑 —— 那条路径上有已经审过的三道闸。
 * 子进程参数由本文件硬编码构造，界面上的任何输入都进不了命令行。
 *
 * 【安全约束】
 *   1. 只绑 127.0.0.1，外网碰不到
 *   2. 每次启动随机会话密钥，所有请求必须带对
 *   3. 校验 Host 头，防 DNS 重绑定
 *   4. 15 分钟无请求自动关闭
 */

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const TOOL = path.join(__dirname, 'hade-uninstall.js');
const KEY = crypto.randomBytes(16).toString('hex');
const IDLE_MS = 15 * 60 * 1000;

let idleTimer = null;
const touch = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('\n  闲置 15 分钟，已自动关闭。\n');
    process.exit(0);
  }, IDLE_MS);
};

/** 只允许这三种只读调用；参数在这里硬编码，界面传不进任何东西 */
function runTool(kind, opts, cb) {
  let args;
  if (kind === 'scan') args = ['doctor', '--json'];
  else if (kind === 'plan') args = ['uninstall', ...(opts.vault ? ['--with-vault'] : []), '--json'];
  else if (kind === 'backups') args = ['restore', '--json'];
  else return cb(new Error('未知调用'));

  execFile(process.execPath, [TOOL, ...args], { encoding: 'utf8', maxBuffer: 8 << 20 },
    (err, stdout, stderr) => {
      // doctor 用退出码表达状态（0/1/2），非零不代表失败
      const raw = (stdout || '').trim();
      if (!raw) return cb(new Error((stderr || err && err.message || '无输出').slice(0, 500)));
      try { cb(null, JSON.parse(raw)); }
      catch (e) { cb(new Error('输出不是合法 JSON：' + raw.slice(0, 300))); }
    });
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const server = http.createServer((req, res) => {
  touch();
  const url = new URL(req.url, 'http://127.0.0.1');
  const port = server.address().port;

  // 闸 3：Host 必须是本机 —— 防 DNS 重绑定把外部页面变成本地请求
  const host = (req.headers.host || '').toLowerCase();
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Host 不被允许');
  }
  // 跨源请求一律拒绝
  const origin = req.headers.origin;
  if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Origin 不被允许');
  }
  // 闸 2：会话密钥
  if (!safeEq(url.searchParams.get('k') || '', KEY)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('密钥不对。请回到启动时打开的那个地址。');
  }

  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE.replace(/__KEY__/g, KEY));
  }
  if (url.pathname === '/api/scan') {
    return runTool('scan', {}, (e, d) => e ? json(500, { error: e.message }) : json(200, d));
  }
  if (url.pathname === '/api/plan') {
    const vault = url.searchParams.get('vault') === '1';
    return runTool('plan', { vault }, (e, d) => e ? json(500, { error: e.message }) : json(200, d));
  }
  if (url.pathname === '/api/backups') {
    return runTool('backups', {}, (e, d) => e ? json(500, { error: e.message }) : json(200, d));
  }
  if (url.pathname === '/api/quit') { json(200, { ok: true }); return setTimeout(() => process.exit(0), 200); }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('没有这个页面');
});

server.listen(0, '127.0.0.1', () => {
  const addr = `http://127.0.0.1:${server.address().port}/?k=${KEY}`;
  console.log('');
  console.log('  HADE 卸载器 · 可视化界面（只读）');
  console.log('  ' + addr);
  console.log('');
  console.log('  这个界面不会删任何东西 —— 它只体检和出计划。');
  console.log('  真要卸载时，它会给你一条命令，你自己粘到终端里跑。');
  console.log('  结束方式：界面上的「关闭服务」按钮，或 15 分钟无操作自动结束。');
  console.log('');
  touch();
  if (process.argv.includes('--no-open')) return;   // 测试 / 无桌面环境
  const open = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', addr]]
    : process.platform === 'darwin' ? ['open', [addr]] : ['xdg-open', [addr]];
  execFile(open[0], open[1], () => {});
});

// ---------------------------------------------------------------- 页面

const PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HADE 卸载器</title>
<style>
:root{
  --bg:#e7eaed; --card:#fbfcfd; --card2:#eff2f5; --sunken:#dde2e7;
  --ink:#12171b; --ink2:#3c454d; --muted:#5f6a73; --faint:#86909a;
  --line:#ccd4da; --line2:#dde3e8;
  --keep:#0c5a68; --keepbg:#d3e6ea; --del:#8a5a04; --delbg:#f1e3c9;
  --danger:#a3301f;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0f1315; --card:#181d21; --card2:#1f252a; --sunken:#12171a;
  --ink:#e4e9ec; --ink2:#b6c0c7; --muted:#8e98a1; --faint:#6a747d;
  --line:#2b3238; --line2:#232a30;
  --keep:#5cb9c9; --keepbg:#12333a; --del:#d79c3e; --delbg:#332810;
  --danger:#e0705c;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.7 "PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif}
.mono{font-family:"JetBrains Mono",ui-monospace,Consolas,"Cascadia Code",monospace}
.wrap{max-width:900px;margin:0 auto;padding:32px 20px 72px}
h1{font-size:24px;margin:0;letter-spacing:-.01em}
h2{font-size:16px;margin:0 0 12px;letter-spacing:-.005em}
p{margin:0}
.head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.badge{font-size:12.5px;padding:4px 11px;border-radius:99px;font-weight:600;white-space:nowrap}
.b-on{background:var(--delbg);color:var(--del)}
.b-off{background:var(--keepbg);color:var(--keep)}
.b-err{background:#f6d9d4;color:var(--danger)}
@media (prefers-color-scheme:dark){.b-err{background:#3a1c17}}
.sub{color:var(--muted);font-size:13.5px;margin-bottom:26px}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:20px 22px;margin-bottom:16px}
.grid{display:grid;gap:16px;grid-template-columns:1fr 1fr}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
.row{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--line2);align-items:flex-start}
.row:last-child{border-bottom:0}
.dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:8px}
.d-del{background:var(--del)} .d-keep{background:var(--keep)}
.rt{min-width:0;flex:1}
.rt b{font-weight:600;font-size:14px}
.rt .p{display:block;font-size:12px;color:var(--faint);word-break:break-all;margin-top:1px}
.rt .d{display:block;font-size:12.5px;color:var(--muted)}
.why{font-size:12.5px;color:var(--del);margin-top:3px}
.opt{background:var(--card2);border:1px dashed var(--del);border-radius:5px;padding:14px 16px;margin-top:14px}
.opt label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.opt input{margin-top:5px;flex:none;width:16px;height:16px;accent-color:var(--del)}
.warn{background:var(--delbg);border-left:3px solid var(--del);padding:12px 15px;border-radius:0 4px 4px 0;margin-bottom:16px;font-size:14px}
.warn b{color:var(--ink)}
.okbox{background:var(--keepbg);border-left:3px solid var(--keep);padding:12px 15px;border-radius:0 4px 4px 0;margin-bottom:16px;font-size:14px}
button{font:inherit;font-size:14px;padding:11px 20px;border-radius:5px;border:1px solid var(--line);
  background:var(--card);color:var(--ink2);cursor:pointer}
button:hover{border-color:var(--keep);color:var(--keep)}
button.primary{background:var(--keep);border-color:var(--keep);color:var(--card);font-weight:600}
button.primary:hover{opacity:.88;color:var(--card)}
.cmdbox{background:var(--sunken);border:1px solid var(--line);border-radius:5px;padding:14px 16px;margin-top:14px}
.cmdbox code{display:block;font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;
  font-size:12.5px;color:var(--ink);word-break:break-all;line-height:1.8}
.cmdbar{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
.hint{font-size:12.5px;color:var(--muted)}
.steps{counter-reset:s;margin:0;padding:0;list-style:none}
.steps li{counter-increment:s;position:relative;padding-left:30px;margin-bottom:9px;font-size:14px;color:var(--ink2)}
.steps li::before{content:counter(s);position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:50%;
  background:var(--keep);color:var(--card);font-size:11.5px;font-weight:700;display:grid;place-items:center}
.muted{color:var(--muted);font-size:13px}
.tag{font-size:11px;padding:2px 7px;border-radius:3px;background:var(--card2);color:var(--faint);white-space:nowrap}
.loading{padding:60px 0;text-align:center;color:var(--muted)}
.err{background:#f6d9d4;color:var(--danger);padding:14px 16px;border-radius:5px;font-size:14px}
@media (prefers-color-scheme:dark){.err{background:#3a1c17}}
.foot{margin-top:26px;font-size:12.5px;color:var(--faint);line-height:1.9}
</style></head><body>
<div class="wrap" id="app"><div class="loading">正在体检…</div></div>
<script>
const K='__KEY__';
const $=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=(p,q='')=>fetch(p+'?k='+K+q).then(r=>r.json());

let scanData=null, withVault=false;

function rowsHtml(items, cls){
  return items.map(it=>\`<div class="row"><span class="dot \${cls}"></span><span class="rt">
    <b>\${esc(it.label)}</b>
    <span class="p mono">\${esc(it.rel)}</span>
    <span class="d">\${esc(it.detail||'')}</span>
    \${it.id&&it.id.startsWith('memptr')?'<span class="why">不删它，卸载后会剩一个指向已消失文件的路标，误导以后每个新会话</span>':''}
  </span></div>\`).join('');
}

function render(d){
  if(d.error){document.getElementById('app').innerHTML='<div class="err">出错了：'+esc(d.error)+'</div>';return}
  scanData=d;
  const st = !d.installed ? ['b-off','未安装 —— 已是初始状态']
           : d.exitCode===2 ? ['b-err','已安装 · 有异常']
           : ['b-on','已安装 · 正常'];
  const app=document.getElementById('app');
  app.innerHTML = \`
  <div class="head"><h1>HADE 卸载器</h1><span class="badge \${st[0]}">\${st[1]}</span></div>
  <p class="sub">这个界面只看不动手。真要卸载时，它会给你一条命令，你自己粘到终端里跑。</p>

  \${d.checks.filter(c=>!c.ok).map(c=>\`<div class="warn">\${esc(c.text.split('\\n')[0])}
    <div class="muted" style="margin-top:4px">\${esc(c.text.split('\\n').slice(1).join(' ').trim())}</div></div>\`).join('')}

  \${d.originalBackup?\`<div class="okbox"><b>找到了你装 HADE 之前的规则</b>
    <span class="mono">\${esc(d.originalBackup.name)}</span>（\${d.originalBackup.lines} 行）。
    卸载时会自动把它改回 CLAUDE.md —— 这样你得到的是原来的环境，而不是一个没有规则文件的空壳。</div>\`:''}

  \${d.installed?\`
  <div class="grid">
    <div class="card">
      <h2 style="color:var(--del)">会被移除 · \${d.items.length} 项</h2>
      \${rowsHtml(d.items,'d-del')}
      \${d.optional.length?\`<div class="opt"><label>
        <input type="checkbox" id="vault" \${withVault?'checked':''}>
        <span><b>\${esc(d.optional[0].label)}</b> <span class="tag">可选</span>
        <span class="p mono">\${esc(d.optional[0].rel)}</span>
        <span class="d">\${esc(d.optional[0].detail)}</span>
        <span class="muted" style="display:block;margin-top:5px">Claude Code 从不读它，里面是你的画像数据。默认保留，勾上才一起移走。</span>
        </span></label></div>\`:''}
    </div>
    <div class="card">
      <h2 style="color:var(--keep)">会被保留</h2>
      \${rowsHtml(d.keeps.map(k=>({label:k.split('保留：')[0].replace(/[:：]$/,''),rel:'',detail:k.split('保留：')[1]||k})),'d-keep')}
      \${rowsHtml(d.blocklist.map(b=>({label:'代码级禁止触碰',rel:b,detail:''})),'d-keep')}
      \${d.usageKeys.length?rowsHtml([{label:'使用计数键',rel:'~/.claude.json',detail:d.usageKeys.length+' 个 · 纯统计，工具永不写这个文件'}],'d-keep'):''}
    </div>
  </div>

  <div class="card">
    <h2>怎么卸载</h2>
    <ol class="steps">
      <li>点下面的按钮，生成一条命令（令牌 30 分钟有效）</li>
      <li>复制它，粘到终端里回车</li>
      <li>终端会再要你手敲一次「确认销毁」才真动手</li>
      <li>完全退出 Claude Code 再重开，回来点「重新体检」复查</li>
    </ol>
    <div class="cmdbar"><button class="primary" id="gen">生成卸载命令</button>
      <span class="hint">按钮本身不删任何东西</span></div>
    <div id="cmdout"></div>
  </div>\`:\`
  <div class="card"><h2>没有检测到 HADE</h2>
    <p class="muted">Claude Code 现在处于初始状态，不需要做任何事。</p></div>\`}

  <div class="card"><h2>备份与还原</h2><div id="bk" class="muted">读取中…</div></div>

  <div class="cmdbar"><button id="re">重新体检</button><button id="quit">关闭服务</button></div>
  <p class="foot">扫描目标 <span class="mono">\${esc(d.claudeHome)}</span><br>
  这个界面只在你的电脑上运行，只连 127.0.0.1，不会执行删除操作。<br>
  用完点上面的「关闭服务」，或者不管它 —— 15 分钟无操作会自动结束。</p>\`;

  const vb=document.getElementById('vault');
  if(vb) vb.onchange=()=>{withVault=vb.checked;const o=document.getElementById('cmdout');if(o)o.innerHTML=''};
  const g=document.getElementById('gen'); if(g) g.onclick=genCmd;
  document.getElementById('re').onclick=load;
  document.getElementById('quit').onclick=()=>api('/api/quit').then(()=>{
    document.body.innerHTML='<div class="wrap"><div class="loading">已关闭，可以关掉这个标签页了。</div></div>'});
  loadBackups();
}

function genCmd(){
  const out=document.getElementById('cmdout');
  out.innerHTML='<p class="hint" style="margin-top:12px">生成中…</p>';
  api('/api/plan', '&vault='+(withVault?'1':'0')).then(p=>{
    if(p.error){out.innerHTML='<div class="err" style="margin-top:12px">'+esc(p.error)+'</div>';return}
    out.innerHTML=\`<div class="cmdbox">
      <div class="hint" style="margin-bottom:8px">在仓库目录里运行 · 令牌 <b class="mono">\${esc(p.digest)}</b> · 30 分钟内有效</div>
      <code id="cmd">\${esc(p.command)}</code>
      <div class="cmdbar"><button id="cp">复制命令</button>
      <span class="hint">共 \${p.items.length} 项\${p.skipped.length?('，未包含 '+p.skipped.length+' 个可选项'):''}\${p.originalBackup?'；卸载后会把 '+esc(p.originalBackup.name)+' 改回 CLAUDE.md':''}</span></div>
    </div>\`;
    document.getElementById('cp').onclick=function(){
      navigator.clipboard.writeText(p.command).then(()=>{this.textContent='已复制 ✓';
        setTimeout(()=>{this.textContent='复制命令'},1800)})
      .catch(()=>{const r=document.createRange();r.selectNode(document.getElementById('cmd'));
        getSelection().removeAllRanges();getSelection().addRange(r);this.textContent='已选中，按 Ctrl+C'})};
  });
}

function loadBackups(){
  api('/api/backups').then(b=>{
    const el=document.getElementById('bk'); if(!el) return;
    if(b.error){el.innerHTML='<span class="err">'+esc(b.error)+'</span>';return}
    if(!b.backups.length){el.innerHTML='还没有备份 —— 说明从来没执行过卸载。<br><span class="muted">卸载时会自动备份到 '+esc(b.backupRoot)+'，随时能一键装回来。</span>';return}
    el.innerHTML=b.backups.map(x=>\`<div class="row"><span class="dot d-keep"></span><span class="rt">
      <b class="mono">\${esc(x.name)}</b>
      <span class="d">\${x.fsCount} 个文件/目录 · \${x.jsonCount} 个键\${x.mdCount?' · '+x.mdCount+' 处行删除':''}\${x.body?' · 本体 '+esc(x.body):''}</span>
      <span class="p mono">还原：\${esc(x.command)}</span></span></div>\`).join('');
  });
}

function load(){document.getElementById('app').innerHTML='<div class="loading">正在体检…</div>';
  api('/api/scan').then(render).catch(e=>{document.getElementById('app').innerHTML='<div class="err">连不上本地服务：'+esc(e.message)+'</div>'})}
load();
</script></body></html>`;
