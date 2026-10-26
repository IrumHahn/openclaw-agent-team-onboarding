import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// 과제2 기본 경로: 이름 없는 기본 에이전트 main 을 총괄(루미)로 바꾸고 전문가(노바)만 새로 만든다.
const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, '..', 'skill', 'agent-team-onboarding', 'scripts', 'team_setup.mjs');
const fakeBin = path.join(directory, 'fake-openclaw', 'openclaw');
const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'));

const HIA_AGENTS = '# AGENTS.md\n\nOpenClaw default instructions.\n\n<!-- HIA:START -->\n## HIA — 파일 기반 업무 기억\n- 작업 시작 시 STATE.md를 읽는다.\n<!-- HIA:END -->\n';
const WORK_MAP = '# 내 업무 지도\n\n## 상위 3개 업무 (위임 희망도 순)\n\n1. **주간 리포트** — 매주\n';

function koreanPlan() {
  const plan = structuredClone(fixture);
  plan.team.language = '한국어';
  Object.assign(plan.agents[0], { id: 'main', name: '루미', emoji: '✨', archetype: '청록 네온의 따뜻한 성장 파트너' });
  Object.assign(plan.agents[1], { id: 'nova', name: '노바', emoji: '⚡', archetype: '보라핑크 네온의 아이디어 동료' });
  return plan;
}

function setup(mainKind = 'bare', extraEnv = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-adopt-'));
  const stateDir = path.join(temp, 'state');
  const mainWs = path.join(temp, 'main-ws');
  fs.mkdirSync(mainWs, { recursive: true });
  const originals = {
    'AGENTS.md': HIA_AGENTS,
    'USER.md': '# USER.md\n\n- 이름: 수강생\n',
    'IDENTITY.md': '# IDENTITY.md - Who Am I?\n\n_Fill this in during your first conversation._\n',
    'SOUL.md': '# SOUL.md\n\nDefault soul.\n',
    'my-work-map.md': WORK_MAP,
  };
  for (const [name, content] of Object.entries(originals)) fs.writeFileSync(path.join(mainWs, name), content);
  const planPath = path.join(temp, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(koreanPlan()));
  const env = { ...process.env, OPENCLAW_BIN: fakeBin, OPENCLAW_STATE_DIR: stateDir, OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json'), FAKE_MAIN: mainKind, FAKE_MAIN_WORKSPACE: mainWs, ...extraEnv };
  const run = (args, envOverride = env) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: envOverride, timeout: 90000 });
  const fake = args => JSON.parse(spawnSync(fakeBin, args, { encoding: 'utf8', env }).stdout);
  const read = name => fs.readFileSync(path.join(mainWs, name), 'utf8');
  const writePlan = plan => fs.writeFileSync(planPath, JSON.stringify(plan));
  return { temp, mainWs, originals, planPath, env, run, fake, read, writePlan, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

test('a bare default main blocks a plan that creates a separate coordinator', () => {
  const t = setup('bare');
  try {
    const plan = koreanPlan();
    plan.agents[0].id = 'lumi';
    t.writePlan(plan);
    const preview = t.run(['preview', '--plan', t.planPath]);
    assert.equal(preview.status, 1);
    assert.match(JSON.parse(preview.stdout).collisions.join(' '), /default agent "main" has no persona/);
    assert.notEqual(t.run(['apply', '--plan', t.planPath, '--confirmed']).status, 0);
    assert.equal(t.fake(['agents', 'list', '--json']).length, 1, 'nothing created');
    assert.equal(t.run(['preview', '--plan', t.planPath, '--keep-default']).status, 0, 'explicit opt-out still possible');
  } finally { t.cleanup(); }
});

test('main becomes the coordinator: Korean names shown, HIA block and my-work-map.md preserved, rollback restores', () => {
  const t = setup('bare');
  try {
    const preview = t.run(['preview', '--plan', t.planPath]);
    assert.equal(preview.status, 0, preview.stdout + preview.stderr);
    const summary = JSON.parse(preview.stdout);
    assert.equal(summary.adoptsDefault.id, 'main');
    assert.equal(fs.existsSync(path.join(t.mainWs, 'IDENTITY.md.bak-onboarding')), false);

    const applied = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.equal(applied.status, 0, applied.stderr);
    const result = JSON.parse(applied.stdout);
    assert.deepEqual(result.created, ['nova'], 'only the specialist is created');
    assert.equal(result.adopted, 'main');

    const roster = t.fake(['agents', 'list', '--json']);
    assert.deepEqual(roster.map(a => a.id), ['main', 'nova'], 'no extra coordinator next to main');
    assert.deepEqual(roster.map(a => a.name), ['루미', '노바'], 'card name (entries.<id>.name) is Korean');
    assert.equal(roster.find(a => a.id === 'main').identityName, '루미');
    assert.deepEqual(t.fake(['config', 'get', 'agents.entries.main.subagents', '--json']), { allowAgents: ['nova'] });

    // E. 보존 규칙
    assert.equal(t.read('my-work-map.md'), WORK_MAP, 'my-work-map.md untouched');
    assert.ok(!fs.readdirSync(t.mainWs).some(f => f.startsWith('my-work-map.md.')), 'my-work-map.md not backed up');
    const agentsMd = t.read('AGENTS.md');
    assert.ok(agentsMd.startsWith(HIA_AGENTS), 'original AGENTS.md incl. HIA block kept verbatim');
    assert.match(agentsMd, /<!-- agent-team-onboarding:start -->[\s\S]*루미[\s\S]*<!-- agent-team-onboarding:end -->/);
    assert.match(t.read('IDENTITY.md'), /Name: 루미/);
    const identityBackup = fs.readdirSync(t.mainWs).find(f => f.startsWith('IDENTITY.md.bak-onboarding-'));
    assert.equal(fs.readFileSync(path.join(t.mainWs, identityBackup), 'utf8'), t.originals['IDENTITY.md']);
    const teamJson = JSON.parse(fs.readFileSync(result.teamJson, 'utf8'));
    assert.equal(teamJson.agents[0].isDefault, true);

    const rolled = t.run(['rollback', '--plan', t.planPath, '--confirmed']);
    assert.equal(rolled.status, 0, rolled.stdout + rolled.stderr);
    assert.equal(JSON.parse(rolled.stdout).restored, 'main');
    for (const name of ['AGENTS.md', 'USER.md', 'IDENTITY.md', 'SOUL.md', 'my-work-map.md']) assert.equal(t.read(name), t.originals[name], `${name} restored`);
    const after = t.fake(['agents', 'list', '--json']);
    assert.deepEqual(after.map(a => [a.id, a.name]), [['main', 'main']], 'main kept, never deleted; nova removed');
    assert.equal(spawnSync(fakeBin, ['config', 'get', 'agents.entries.main.subagents', '--json'], { env: t.env }).status, 1, 'delegation removed');
  } finally { t.cleanup(); }
});

test('re-running apply on an adopted main refreshes only the managed block (HIA block intact)', () => {
  const t = setup('bare', { FAKE_FAIL_AT: 'nova' });
  try {
    const failed = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.notEqual(failed.status, 0);
    assert.equal(JSON.parse(failed.stderr).failedAgent, 'nova');
    const env = { ...t.env }; delete env.FAKE_FAIL_AT;
    const resumed = t.run(['apply', '--plan', t.planPath, '--confirmed', '--resume'], env);
    assert.equal(resumed.status, 0, resumed.stderr);
    const result = JSON.parse(resumed.stdout);
    assert.deepEqual(result.created, ['nova']);
    assert.deepEqual(result.skipped, ['main']);
    assert.equal(fs.readdirSync(t.mainWs).filter(f => f.startsWith('IDENTITY.md.bak-onboarding-')).length, 1, 'original backed up exactly once');
    const agentsMd = t.read('AGENTS.md');
    assert.equal(agentsMd.match(/agent-team-onboarding:start/g).length, 1);
    assert.ok(agentsMd.startsWith(HIA_AGENTS));
  } finally { t.cleanup(); }
});

test('a main with an existing persona can be adopted, but preview warns', () => {
  const t = setup('persona');
  try {
    const adopt = JSON.parse(t.run(['preview', '--plan', t.planPath]).stdout);
    assert.equal(adopt.ok, true);
    assert.match(adopt.warnings.join(' '), /already has a persona \(드림\)/);
    const plan = koreanPlan();
    plan.agents[0].id = 'lumi';
    t.writePlan(plan);
    const separate = JSON.parse(t.run(['preview', '--plan', t.planPath]).stdout);
    assert.equal(separate.ok, true, 'a named main is not blocked');
    assert.match(separate.warnings.join(' '), /stays outside this team/);
  } finally { t.cleanup(); }
});

test('Korean teams need Korean display names; archetype must not carry notes', () => {
  const t = setup('bare');
  try {
    const plan = koreanPlan();
    plan.agents[1].name = 'nova';
    t.writePlan(plan);
    const romanized = t.run(['preview', '--plan', t.planPath]);
    assert.notEqual(romanized.status, 0);
    assert.match(romanized.stderr, /must be written in Korean/);
    const noted = koreanPlan();
    noted.agents[1].archetype = '보라핑크 네온 콘텐츠 동료. 실제 아바타 이미지 없음';
    t.writePlan(noted);
    assert.match(t.run(['preview', '--plan', t.planPath]).stderr, /archetype/);
  } finally { t.cleanup(); }
});
