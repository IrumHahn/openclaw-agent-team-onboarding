import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// 과제1 업무 지도 모드: main 워크스페이스에 my-work-map.md 만 쓰고 OpenClaw 설정은 읽기만 한다.
const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, '..', 'skill', 'agent-team-onboarding', 'scripts', 'work_map.mjs');
const fakeBin = path.join(directory, 'fake-openclaw', 'openclaw');

const MAP = {
  version: 1,
  userName: '대표님',
  answers: { work: '온라인 강의 운영', recurring: '수강생 문의 응대, 주간 리포트', timeSink: '과제 피드백', delegate: '리포트 정리', neverDelegate: '환불 결정' },
  tasks: [
    { name: '수강생 문의 응대', frequency: '매일', duration: '1시간', delegation: 3, connections: ['카카오톡'] },
    { name: '주간 리포트', frequency: '매주', duration: '2시간', delegation: 5, connections: ['Google Sheets', 'Gmail'] },
    { name: '과제 피드백 | 1차', frequency: '매주', duration: '4시간', delegation: 4, connections: '없음' },
    { name: '환불 처리', frequency: '가끔', duration: '30분', delegation: 1, connections: [] },
  ],
};

function setup() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-map-'));
  const stateDir = path.join(temp, 'state');
  const mainWs = path.join(temp, 'main-ws');
  fs.mkdirSync(mainWs);
  fs.writeFileSync(path.join(mainWs, 'IDENTITY.md'), 'untouched\n');
  const mapPath = path.join(temp, 'map.json');
  fs.writeFileSync(mapPath, JSON.stringify(MAP));
  const env = { ...process.env, OPENCLAW_BIN: fakeBin, OPENCLAW_STATE_DIR: stateDir, FAKE_MAIN: 'bare', FAKE_MAIN_WORKSPACE: mainWs };
  const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
  const calls = () => JSON.parse(fs.readFileSync(path.join(stateDir, 'fake-state.json'), 'utf8')).calls;
  return { temp, mainWs, mapPath, run, calls, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

test('writes my-work-map.md to the default agent workspace with top 3 and table, touching nothing else', () => {
  const t = setup();
  try {
    const written = t.run(['write', '--map', t.mapPath]);
    assert.equal(written.status, 0, written.stderr);
    const file = path.join(t.mainWs, 'my-work-map.md');
    assert.equal(JSON.parse(written.stdout).file, file);
    const md = fs.readFileSync(file, 'utf8');
    const top = md.split('## 업무 표')[0];
    assert.ok(top.indexOf('주간 리포트') < top.indexOf('과제 피드백') && top.indexOf('과제 피드백') < top.indexOf('수강생 문의'), 'top 3 sorted by delegation');
    assert.ok(!top.includes('환불 처리'), 'only three in summary');
    assert.match(md, /\| 업무명 \| 빈도 \| 소요시간 \| 위임 희망도\(1~5\) \| 필요한 연결 \|/);
    assert.match(md, /\| 과제 피드백 \\\| 1차 \| 매주 \| 4시간 \| 4 \| 없음 \|/, 'pipe escaped');
    assert.match(md, /Google Sheets, Gmail/);
    assert.match(md, /절대 맡기기 싫은 일: 환불 결정/);
    assert.equal(fs.readFileSync(path.join(t.mainWs, 'IDENTITY.md'), 'utf8'), 'untouched\n');
    assert.deepEqual(t.calls(), ['agents list --json'], 'no agents add / set-identity / config writes');
  } finally { t.cleanup(); }
});

test('re-running backs up the previous map; invalid answers are refused', () => {
  const t = setup();
  try {
    assert.equal(t.run(['write', '--map', t.mapPath]).status, 0);
    const second = JSON.parse(t.run(['write', '--map', t.mapPath]).stdout);
    assert.ok(second.backup && fs.existsSync(second.backup));
    const bad = structuredClone(MAP);
    bad.tasks[0].delegation = 6;
    fs.writeFileSync(t.mapPath, JSON.stringify(bad));
    assert.match(t.run(['preview', '--map', t.mapPath]).stderr, /delegation must be an integer 1–5/);
    const short = structuredClone(MAP);
    short.tasks = short.tasks.slice(0, 2);
    fs.writeFileSync(t.mapPath, JSON.stringify(short));
    assert.match(t.run(['preview', '--map', t.mapPath]).stderr, /3–20 tasks/);
  } finally { t.cleanup(); }
});
