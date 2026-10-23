#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const CARDS = [
  { id: 'organization', required: true, question: 'What does the organization do, and who are its customers or users?' },
  { id: 'firstGoal', required: true, question: 'What is the first goal or problem, and what is the current situation?' },
  { id: 'constraints', required: true, question: 'What deadline, budget, tools, collaborators, or hard constraints apply?' },
  { id: 'success', required: true, question: 'What observable deliverable, number, or state would mean success?' },
  { id: 'relationship', required: false, question: 'What kind of agent relationship, names, forms of address, and tone would feel right?' },
  { id: 'personality', required: false, question: 'What personality references or behaviors do you like or dislike?' },
  { id: 'visual', required: false, question: 'What visual motif, emoji, palette, or avatar style would you prefer?' },
];

function fail(message) { throw new Error(message); }

function parseArgs(args) {
  const [mode, ...rest] = args;
  if (!['start', 'show', 'update'].includes(mode)) fail('usage: interview_draft.mjs start|show|update --file <path> [--card <id> --answer <text>]');
  const result = { mode };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!['--file', '--card', '--answer'].includes(key) || value === undefined) fail(`invalid option: ${key}`);
    result[key.slice(2)] = value;
  }
  if (!result.file) fail('--file is required');
  if (mode === 'update' && (!result.card || !result.answer?.trim())) fail('update requires --card and a nonempty --answer');
  return result;
}

function readDraft(file) {
  const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (draft.version !== 1 || !Array.isArray(draft.cards)) fail('invalid draft format');
  return draft;
}

function writePrivate(file, draft, exclusive = false) {
  const content = `${JSON.stringify(draft, null, 2)}\n`;
  if (exclusive) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return;
  }
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const file = path.resolve(options.file);
  if (options.mode === 'start') {
    const draft = { version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cards: CARDS.map(card => ({ ...card, answer: null })) };
    writePrivate(file, draft, true);
    process.stdout.write(`${JSON.stringify({ ok: true, file, cards: draft.cards }, null, 2)}\n`);
    return;
  }
  const draft = readDraft(file);
  if (options.mode === 'update') {
    const card = draft.cards.find(item => item.id === options.card);
    if (!card) fail(`unknown card: ${options.card}`);
    const answer = options.answer.trim();
    if (answer.length > 4000) fail('answer must be 4000 characters or less');
    card.answer = answer;
    draft.updatedAt = new Date().toISOString();
    writePrivate(file, draft);
  }
  const missingRequired = draft.cards.filter(card => card.required && !card.answer).map(card => card.id);
  process.stdout.write(`${JSON.stringify({ ok: true, file, missingRequired, cards: draft.cards }, null, 2)}\n`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exitCode = 1;
}
