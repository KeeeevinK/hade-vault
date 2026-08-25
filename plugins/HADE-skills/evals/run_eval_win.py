#!/usr/bin/env python3
"""Windows 兼容版 skill 触发率评测器。

为什么存在：官方 skill-creator 的 scripts/run_eval.py 用 select.select() 读子进程
stdout —— 在 Windows 上 select 只支持 socket，传 pipe 直接抛 OSError(WinError 10093)。
该异常被官方代码的 `except Exception` 吞掉并记为「未触发」，结果是**安静地输出全 0%
的假报告**，看上去像 skill 全部欠触发。这比崩溃更危险。

本文件沿用官方的事件解析思路（stream-json → Skill/Read 工具调用），但把 select 轮询
换成阻塞 readline + watchdog kill，把 ProcessPoolExecutor 换成 ThreadPoolExecutor
（IO-bound，且避免 Windows spawn 模式下的 pickle 问题）。官方 skill 的任何文件均未修改。

与官方的方法论差异（实测后修正）：官方注入一个临时 command 来"模拟"未安装的 skill，
比对的是临时名。我们的 skill 已经真装上了，模型触发的是真名（HADE-skills:xxx），
两个名字对不上 → 官方逻辑会把真实触发判成未触发（假阴性，实测确认）。
故本版直接测**已安装 skill 的真实触发**：不注入、不模拟，扫完整轮对话看 Skill/Read
是否指向目标 skill。这比模拟更接近真实场景。

输出格式与官方 run_eval.py 一致，便于对照。

用法：
  python run_eval_win.py --eval-set converted/naming-system.json \
      --skill-path ../skills/naming-system --runs-per-query 3 --verbose
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def parse_skill_md(skill_path: Path) -> tuple[str, str]:
    """从 SKILL.md 的 YAML frontmatter 取 name 与 description。"""
    text = (skill_path / "SKILL.md").read_text(encoding="utf-8")
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    if not m:
        raise ValueError(f"No YAML frontmatter in {skill_path / 'SKILL.md'}")
    fm = m.group(1)

    def field(key: str) -> str:
        # 支持 `key: value`、`key: >-` / `key: |` 折叠块
        block = re.search(rf"^{key}:\s*[>|][-+]?\s*\r?\n((?:[ \t]+.*\r?\n?)+)", fm, re.M)
        if block:
            lines = [ln.strip() for ln in block.group(1).splitlines()]
            return " ".join(x for x in lines if x)
        one = re.search(rf"^{key}:\s*(.+?)\s*$", fm, re.M)
        if not one:
            raise ValueError(f"frontmatter 缺少 {key}")
        return one.group(1).strip().strip("'\"")

    return field("name"), field("description")


def run_single_query(
    query: str,
    skill_name: str,
    skill_description: str,
    timeout: int,
    project_root: str,
    model: str | None = None,
) -> bool:
    """跑一条 query，返回目标 skill 是否被真实触发。

    skill 已通过 plugin 安装，无需注入模拟件。扫完整轮对话（直到 result 事件），
    只要有任一 Skill 调用的 skill 参数含 skill_name，或任一 Read 的路径指向该
    skill 目录，即判为触发。不因为"第一个工具不是 Skill"就提前判否 —— 模型完全
    可能先做别的再读 skill。
    """
    claude_exe = shutil.which("claude")
    if not claude_exe:
        raise RuntimeError("PATH 里找不到 claude CLI")

    cmd = [
        claude_exe,
        "-p", query,
        "--output-format", "stream-json",
        "--verbose",
    ]
    if model:
        cmd.extend(["--model", model])

    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

    process = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        cwd=project_root,
        env=env,
    )
    killer = threading.Timer(timeout, lambda: process.poll() is None and process.kill())
    killer.start()

    triggered = False
    try:
        for raw in process.stdout:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            if event.get("type") == "assistant":
                for item in event.get("message", {}).get("content", []):
                    if item.get("type") != "tool_use":
                        continue
                    tool_name = item.get("name", "")
                    tool_input = item.get("input", {})
                    if tool_name == "Skill" and skill_name in str(tool_input.get("skill", "")):
                        triggered = True
                    elif tool_name == "Read" and skill_name in str(tool_input.get("file_path", "")):
                        triggered = True
            elif event.get("type") == "result":
                break
    finally:
        killer.cancel()
        if process.poll() is None:
            process.kill()
        process.wait()

    return triggered


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Windows 兼容版 skill 触发率评测")
    ap.add_argument("--eval-set", required=True)
    ap.add_argument("--skill-path", required=True)
    ap.add_argument("--description", default=None, help="覆盖 SKILL.md 里的 description 来测")
    ap.add_argument("--runs-per-query", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--trigger-threshold", type=float, default=0.5)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--model", default=None)
    ap.add_argument("--project-root", default=None)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))
    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: 没有 SKILL.md：{skill_path}", file=sys.stderr)
        sys.exit(1)

    name, original_description = parse_skill_md(skill_path)
    description = args.description or original_description
    project_root = args.project_root or str(Path.cwd())

    if args.verbose:
        print(f"skill: {name}\ndescription: {description}\n", file=sys.stderr)

    jobs = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for item in eval_set:
            for _ in range(args.runs_per_query):
                jobs.append((item, ex.submit(
                    run_single_query, item["query"], name, description,
                    args.timeout, project_root, args.model,
                )))

        per_query: dict[str, list[bool]] = {}
        items: dict[str, dict] = {}
        for item, fut in jobs:
            q = item["query"]
            items[q] = item
            per_query.setdefault(q, [])
            try:
                per_query[q].append(fut.result())
            except Exception as e:
                print(f"Warning: query 失败: {type(e).__name__}: {e}", file=sys.stderr)
                per_query[q].append(False)

    results = []
    for q, triggers in per_query.items():
        rate = sum(triggers) / len(triggers)
        should = items[q]["should_trigger"]
        did_pass = rate >= args.trigger_threshold if should else rate < args.trigger_threshold
        results.append({
            "query": q, "should_trigger": should, "trigger_rate": rate,
            "triggers": sum(triggers), "runs": len(triggers), "pass": did_pass,
        })

    passed = sum(1 for r in results if r["pass"])
    output = {
        "skill_name": name,
        "description": description,
        "results": results,
        "summary": {"total": len(results), "passed": passed, "failed": len(results) - passed},
    }

    if args.verbose:
        print(f"\n结果: {passed}/{len(results)} 通过", file=sys.stderr)
        for r in results:
            status = "PASS" if r["pass"] else "FAIL"
            print(f"  [{status}] {r['triggers']}/{r['runs']}  expected={r['should_trigger']}  {r['query'][:50]}", file=sys.stderr)

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
