import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, '..', 'skill', 'agent-team-onboarding', 'scripts', 'team_setup.mjs');
const fakeBin = path.join(directory, 'fake-openclaw', 'openclaw');
const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'));

function run(args, env) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, timeout: 90000 });
}

test('interview plan previews without mutation, provisions a coordinated team, and refuses overwrite', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-onboarding-test-'));
  const stateDir = path.join(temp, 'state');
  const planPath = path.join(temp, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(fixture));
  const env = { ...process.env, OPENCLAW_BIN: fakeBin, OPENCLAW_STATE_DIR: stateDir, OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json') };
  try {
    const preview = run(['preview', '--plan', planPath], env);
    assert.equal(preview.status, 0, preview.stderr);
    const previewJson = JSON.parse(preview.stdout);
    assert.equal(previewJson.agents.length, 2);
    assert.equal(previewJson.coordinatorId, 'orchard-pilot-lead');
    assert.equal(fs.existsSync(previewJson.teamRoot), false);

    const missingConsent = run(['apply', '--plan', planPath], env);
    assert.notEqual(missingConsent.status, 0);
    assert.equal(fs.existsSync(previewJson.teamRoot), false);

    const applied = run(['apply', '--plan', planPath, '--confirmed', '--delegation-mode', 'prefer'], env);
    assert.equal(applied.status, 0, applied.stderr);
    const result = JSON.parse(applied.stdout);
    assert.deepEqual(result.created, ['orchard-pilot-lead', 'orchard-pilot-analyst']);

    const leadWorkspace = path.join(result.teamRoot, 'orchard-pilot-lead');
    assert.match(fs.readFileSync(path.join(leadWorkspace, 'SOUL.md'), 'utf8'), /not overconfident/i);
    assert.match(fs.readFileSync(path.join(leadWorkspace, 'AGENTS.md'), 'utf8'), /Initial task proposals/);
    assert.equal(fs.existsSync(path.join(leadWorkspace, 'BOOTSTRAP.md')), false);

    const roster = JSON.parse(execFileSync(fakeBin, ['agents', 'list', '--json'], { encoding: 'utf8', env }));
    assert.equal(roster.filter(agent => result.created.includes(agent.id)).length, 2);
    assert.equal(roster.find(agent => agent.id === 'orchard-pilot-lead').identityName, 'Mara');
    const delegation = JSON.parse(execFileSync(fakeBin, ['config', 'get', 'agents.entries.orchard-pilot-lead.subagents', '--json'], { encoding: 'utf8', env }));
    assert.deepEqual(delegation.allowAgents, ['orchard-pilot-analyst']);
    assert.equal(delegation.delegationMode, 'prefer');

    const originalSoul = fs.readFileSync(path.join(leadWorkspace, 'SOUL.md'), 'utf8');
    const secondApply = run(['apply', '--plan', planPath, '--confirmed'], env);
    assert.notEqual(secondApply.status, 0);
    assert.equal(fs.readFileSync(path.join(leadWorkspace, 'SOUL.md'), 'utf8'), originalSoul);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('invalid plans fail before agent creation', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-onboarding-invalid-'));
  const planPath = path.join(temp, 'invalid.json');
  const invalid = structuredClone(fixture);
  invalid.agents[1].id = invalid.agents[0].id;
  fs.writeFileSync(planPath, JSON.stringify(invalid));
  try {
    const result = run(['preview', '--plan', planPath], { ...process.env, OPENCLAW_BIN: fakeBin, OPENCLAW_STATE_DIR: temp });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /agent IDs must be unique/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
