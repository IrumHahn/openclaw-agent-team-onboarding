import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'agent-team-onboarding', 'scripts', 'interview_draft.mjs');

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

test('answers can be supplied from a file, preserving Korean, quotes and newlines', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-interview-file-'));
  const file = path.join(temp, 'draft.json');
  const answerFile = path.join(temp, 'answer.txt');
  try {
    assert.equal(run(['start', '--file', file]).status, 0);
    fs.writeFileSync(answerFile, '동네 "빵집" 운영.\n고객은 주민과 카페 사장님.\n');
    const updated = run(['update', '--file', file, '--card', 'organization', '--answer-file', answerFile]);
    assert.equal(updated.status, 0, updated.stderr);
    const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(draft.cards[0].answer, '동네 "빵집" 운영.\n고객은 주민과 카페 사장님.');
    assert.match(draft.cards[0].question, /조직/);
    const both = run(['update', '--file', file, '--card', 'organization', '--answer', 'x', '--answer-file', answerFile]);
    assert.notEqual(both.status, 0);
    fs.writeFileSync(answerFile, 'api_key = abcdef123456');
    const secret = run(['update', '--file', file, '--card', 'constraints', '--answer-file', answerFile]);
    assert.notEqual(secret.status, 0);
    assert.match(secret.stderr, /secret/i);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
