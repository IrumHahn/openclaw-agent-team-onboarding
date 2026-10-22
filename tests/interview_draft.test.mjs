import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'interview_draft.mjs');

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('four core cards persist and resume without overwriting answers', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-interview-test-'));
  const file = path.join(temp, 'drafts', 'pilot.json');
  try {
    const started = run(['start', '--file', file]);
    assert.equal(started.status, 0, started.stderr);
    assert.equal(JSON.parse(started.stdout).cards.length, 7);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);

    const updated = run(['update', '--file', file, '--card', 'organization', '--answer', 'A local co-op']);
    assert.equal(updated.status, 0, updated.stderr);
    assert.deepEqual(JSON.parse(updated.stdout).missingRequired, ['firstGoal', 'constraints', 'success']);

    const resumed = run(['show', '--file', file]);
    assert.equal(JSON.parse(resumed.stdout).cards[0].answer, 'A local co-op');
    assert.notEqual(run(['start', '--file', file]).status, 0);
    assert.equal(JSON.parse(run(['show', '--file', file]).stdout).cards[0].answer, 'A local co-op');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
