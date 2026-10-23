import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, '..', 'skill', 'agent-team-onboarding', 'scripts', 'team_setup.mjs');
const fakeBin = path.join(directory, 'fake-openclaw', 'openclaw');
const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'));

function setup(extraEnv = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-prov-'));
  const stateDir = path.join(temp, 'state');
  const planPath = path.join(temp, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(fixture));
  const env = { ...process.env, OPENCLAW_BIN: fakeBin, OPENCLAW_STATE_DIR: stateDir, OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json'), ...extraEnv };
  const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, timeout: 90000 });
  const fake = args => JSON.parse(spawnSync(fakeBin, args, { encoding: 'utf8', env }).stdout);
  return { temp, planPath, env, run, fake, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

test('without config patch, delegation falls back to config set', () => {
  const t = setup({ FAKE_NO_PATCH: '1' });
  try {
    const applied = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.equal(applied.status, 0, applied.stderr);
    const result = JSON.parse(applied.stdout);
    assert.equal(result.delegation.method, 'config-set');
    assert.deepEqual(t.fake(['config', 'get', 'agents.entries.orchard-pilot-lead.subagents.allowAgents', '--json']), ['orchard-pilot-analyst']);
  } finally { t.cleanup(); }
});

test('without patch or set, apply finishes agents and prints manual steps with exit code 2', () => {
  const t = setup({ FAKE_NO_PATCH: '1', FAKE_NO_SET: '1' });
  try {
    const applied = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.equal(applied.status, 2, applied.stderr);
    const result = JSON.parse(applied.stdout);
    assert.deepEqual(result.created, ['orchard-pilot-lead', 'orchard-pilot-analyst']);
    assert.equal(result.delegation.method, 'manual');
    assert.ok(result.delegation.manualSteps.some(step => /allowAgents/.test(step)));
  } finally { t.cleanup(); }
});

test('delegationMode is only written when requested', () => {
  const t = setup();
  try {
    assert.equal(t.run(['apply', '--plan', t.planPath, '--confirmed']).status, 0);
    const sub = t.fake(['config', 'get', 'agents.entries.orchard-pilot-lead.subagents', '--json']);
    assert.deepEqual(sub, { allowAgents: ['orchard-pilot-analyst'] });
  } finally { t.cleanup(); }
  const u = setup();
  try {
    assert.equal(u.run(['apply', '--plan', u.planPath, '--confirmed', '--delegation-mode', 'prefer']).status, 0);
    const sub = u.fake(['config', 'get', 'agents.entries.orchard-pilot-lead.subagents', '--json']);
    assert.equal(sub.delegationMode, 'prefer');
  } finally { u.cleanup(); }
});

test('partial failure is reported, status shows it, and --resume finishes the rest', () => {
  const t = setup({ FAKE_FAIL_AT: 'orchard-pilot-analyst' });
  try {
    const failed = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.notEqual(failed.status, 0);
    const failure = JSON.parse(failed.stderr);
    assert.deepEqual(failure.created, ['orchard-pilot-lead']);
    assert.equal(failure.failedAgent, 'orchard-pilot-analyst');

    const status = t.run(['status', '--plan', t.planPath]);
    assert.equal(status.status, 0, status.stderr);
    const report = JSON.parse(status.stdout);
    assert.deepEqual(report.agents.map(a => [a.id, a.registered]), [['orchard-pilot-lead', true], ['orchard-pilot-analyst', false]]);

    const blocked = t.run(['apply', '--plan', t.planPath, '--confirmed']);
    assert.notEqual(blocked.status, 0, 'plain apply must refuse an existing team root');

    const resumeEnv = { ...t.env }; delete resumeEnv.FAKE_FAIL_AT;
    const resumed = spawnSync(process.execPath, [script, 'apply', '--plan', t.planPath, '--confirmed', '--resume'], { encoding: 'utf8', env: resumeEnv });
    assert.equal(resumed.status, 0, resumed.stderr);
    const result = JSON.parse(resumed.stdout);
    assert.deepEqual(result.created, ['orchard-pilot-analyst']);
    assert.deepEqual(result.skipped, ['orchard-pilot-lead']);
    const roster = t.fake(['agents', 'list', '--json']);
    assert.equal(roster.length, 2);
  } finally { t.cleanup(); }
});

test('rollback removes only agents this run created and keeps pre-existing ones', () => {
  const t = setup();
  try {
    spawnSync(t.env.OPENCLAW_BIN, ['agents', 'add', 'older-agent', '--workspace', path.join(t.temp, 'older'), '--non-interactive', '--json'], { env: t.env });
    assert.equal(t.run(['apply', '--plan', t.planPath, '--confirmed']).status, 0);
    const refused = t.run(['rollback', '--plan', t.planPath]);
    assert.notEqual(refused.status, 0);
    const rolled = t.run(['rollback', '--plan', t.planPath, '--confirmed']);
    assert.equal(rolled.status, 0, rolled.stderr);
    const roster = t.fake(['agents', 'list', '--json']);
    assert.deepEqual(roster.map(a => a.id), ['older-agent']);
    assert.ok(!fs.existsSync(path.join(t.env.OPENCLAW_STATE_DIR, 'workspaces', 'orchard-pilot', 'orchard-pilot-lead', 'SOUL.md')));
  } finally { t.cleanup(); }
});

test('team.json and team.md are emitted for the dashboard builder and HIA', () => {
  const t = setup();
  try {
    const projectRoot = path.join(t.temp, 'project');
    fs.mkdirSync(projectRoot);
    fs.writeFileSync(path.join(projectRoot, 'team.md'), '# old\n');
    const plan = structuredClone(fixture);
    plan.agents[0].menus = ['tasks', 'agents'];
    fs.writeFileSync(t.planPath, JSON.stringify(plan));
    const applied = t.run(['apply', '--plan', t.planPath, '--confirmed', '--project-root', projectRoot]);
    assert.equal(applied.status, 0, applied.stderr);
    const result = JSON.parse(applied.stdout);
    const teamJson = JSON.parse(fs.readFileSync(path.join(result.teamRoot, 'team.json'), 'utf8'));
    assert.equal(teamJson.version, 1);
    assert.deepEqual(teamJson.agents[0].menus, ['tasks', 'agents']);
    assert.deepEqual(teamJson.agents[1].menus, []);
    assert.equal(teamJson.agents[0].coordinator, true);
    const teamMd = fs.readFileSync(path.join(projectRoot, 'team.md'), 'utf8');
    assert.match(teamMd, /Mara/);
    assert.match(teamMd, /orchard-pilot-analyst/);
    assert.ok(fs.readdirSync(projectRoot).some(name => /^team\.md\.bak-/.test(name)), 'old team.md backed up');
    assert.equal(result.teamJson, path.join(result.teamRoot, 'team.json'));
  } finally { t.cleanup(); }
});

test('avatar accepts https, data URI and existing workspace path; rejects others', () => {
  const t = setup();
  try {
    const plan = structuredClone(fixture);
    plan.agents[0].avatar = 'http://insecure.example/a.png';
    fs.writeFileSync(t.planPath, JSON.stringify(plan));
    assert.match(t.run(['preview', '--plan', t.planPath]).stderr, /avatar/);
    plan.agents[0].avatar = 'data:image/png;base64,iVBORw0KGgo=';
    fs.writeFileSync(t.planPath, JSON.stringify(plan));
    assert.equal(t.run(['preview', '--plan', t.planPath]).status, 0);
    plan.agents[0].avatar = 'avatars/mara.png';
    fs.writeFileSync(t.planPath, JSON.stringify(plan));
    assert.match(t.run(['preview', '--plan', t.planPath]).stderr, /avatar/);
    fs.mkdirSync(path.join(t.temp, 'avatars'));
    fs.writeFileSync(path.join(t.temp, 'avatars', 'mara.png'), 'x');
    assert.equal(t.run(['preview', '--plan', t.planPath, '--avatar-root', t.temp]).status, 0);
  } finally { t.cleanup(); }
});

test('secrets in the plan are refused', () => {
  const t = setup();
  try {
    const plan = structuredClone(fixture);
    plan.team.constraints.push('Use token sk-abc123456789 for the API');
    fs.writeFileSync(t.planPath, JSON.stringify(plan));
    const result = t.run(['preview', '--plan', t.planPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /secret/i);
  } finally { t.cleanup(); }
});
