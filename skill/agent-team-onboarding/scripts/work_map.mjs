#!/usr/bin/env node
// 업무 지도 모드(과제1): 5문항 인터뷰 결과를 기본 에이전트(main) 워크스페이스의 my-work-map.md 로 쓴다.
//   preview — 쓸 위치와 내용만 출력
//   write   — 파일 작성. 기존 파일은 my-work-map.md.bak-<시각> 으로 보관 후 갱신
// 이 모드는 에이전트 생성·IDENTITY/SOUL 변경·설정 변경을 하지 않는다. OpenClaw 에는 `agents list` 읽기만 한다.
import fs from 'node:fs';
import path from 'node:path';
import { cliJson } from './lib/openclaw-cli.mjs';
import { workMapMarkdown } from './lib/outputs.mjs';

const FILE_NAME = 'my-work-map.md';
const ANSWER_KEYS = ['work', 'recurring', 'timeSink', 'delegate', 'neverDelegate'];
const SECRET_PATTERN = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|xox[abp]-[a-z0-9-]{10,}|bearer\s+[a-z0-9._-]{12,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i;

function fail(message) { throw new Error(message); }

function text(value, label, max = 1000) {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) fail(`${label} must be 1–${max} characters (use "미정" if unknown)`);
  if (SECRET_PATTERN.test(cleaned)) fail(`${label} looks like it contains a secret (token/password/API key). Remove it.`);
  return cleaned;
}

export function normalizeMap(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) fail('map.version must be 1');
  if (!raw.answers || typeof raw.answers !== 'object') fail('map.answers must be an object');
  const answers = Object.fromEntries(ANSWER_KEYS.map(key => [key, text(raw.answers[key], `answers.${key}`)]));
  if (!Array.isArray(raw.tasks) || raw.tasks.length < 3 || raw.tasks.length > 20) fail('map.tasks must contain 3–20 tasks');
  const tasks = raw.tasks.map((task, index) => {
    const label = `tasks[${index}]`;
    if (!task || typeof task !== 'object') fail(`${label} must be an object`);
    const delegation = Number(task.delegation);
    if (!Number.isInteger(delegation) || delegation < 1 || delegation > 5) fail(`${label}.delegation must be an integer 1–5`);
    const connections = Array.isArray(task.connections) ? task.connections.map((c, i) => text(c, `${label}.connections[${i}]`, 100)).join(', ') || '없음' : text(task.connections ?? '없음', `${label}.connections`, 300);
    return {
      name: text(task.name, `${label}.name`, 120),
      frequency: text(task.frequency, `${label}.frequency`, 60),
      duration: text(task.duration, `${label}.duration`, 60),
      delegation,
      connections,
    };
  });
  const map = { version: 1, answers, tasks };
  if (raw.userName !== undefined) map.userName = text(raw.userName, 'userName', 60);
  return map;
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['preview', 'write'].includes(mode)) fail('usage: work_map.mjs preview|write --map <map.json> [--workspace <absolute-dir>] [--profile <name>]');
  const options = { mode };
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!['--map', '--workspace', '--profile'].includes(flag) || !value || value.startsWith('--')) fail(`invalid option: ${flag}`);
    options[flag.slice(2)] = value;
  }
  if (!options.map) fail('--map is required');
  if (options.workspace && !path.isAbsolute(options.workspace)) fail('--workspace must be absolute');
  return options;
}

// 지정하지 않으면 기본 에이전트(main)의 워크스페이스. 과제2 팀 인터뷰가 같은 곳에서 읽는다.
function targetWorkspace(options) {
  if (options.workspace) return path.resolve(options.workspace);
  const agents = cliJson(['agents', 'list', '--json'], options);
  if (!Array.isArray(agents)) fail('openclaw agents list returned an unexpected result');
  const main = agents.find(agent => agent.isDefault) || agents.find(agent => agent.id === 'main');
  if (!main?.workspace) fail('could not find the default agent workspace; pass --workspace <absolute-dir>');
  return main.workspace;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const map = normalizeMap(JSON.parse(fs.readFileSync(path.resolve(options.map), 'utf8')));
  const workspace = targetWorkspace(options);
  if (!fs.existsSync(workspace)) fail(`workspace does not exist: ${workspace}`);
  const target = path.join(workspace, FILE_NAME);
  const content = workMapMarkdown(map);
  if (options.mode === 'preview') {
    process.stdout.write(`${JSON.stringify({ ok: true, mode: 'preview', file: target, exists: fs.existsSync(target), content }, null, 2)}\n`);
    return;
  }
  let backup = null;
  if (fs.existsSync(target)) {
    backup = `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.renameSync(target, backup);
  }
  fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'write', file: target, backup }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
