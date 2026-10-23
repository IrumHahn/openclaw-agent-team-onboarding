#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const CARDS = [
  { id: 'organization', required: true, question: '01 · 조직 — 무슨 일을 하나요? 제품·서비스와 고객(이용자)은 누구인가요?', questionEn: 'What does the organization do, and who are its customers or users?' },
  { id: 'firstGoal', required: true, question: '02 · 첫 목표 — 무엇을 먼저 이루고 싶나요? 지금 상황은 어떤가요?', questionEn: 'What is the first goal or problem, and what is the current situation?' },
  { id: 'constraints', required: true, question: '03 · 제약 — 기한·예산·쓰는 도구·함께하는 사람·꼭 지킬 조건은요? (모르면 "미정")', questionEn: 'What deadline, budget, tools, collaborators, or hard constraints apply?' },
  { id: 'success', required: true, question: '04 · 성공 기준 — 무엇이 보이면 "됐다"고 할 수 있나요? (산출물·숫자·상태)', questionEn: 'What observable deliverable, number, or state would mean success?' },
  { id: 'relationship', required: false, question: '05 · 관계 — 동료 같은 팀? 캐릭터 같은 팀? 나를 뭐라고 부르면 좋을까요? 존댓말/반말?', questionEn: 'What kind of agent relationship, names, forms of address, and tone would feel right?' },
  { id: 'personality', required: false, question: '06 · 성격 — 좋아하는 성격·말투·싫어하는 행동이 있나요? ("추천해줘"도 됩니다)', questionEn: 'What personality references or behaviors do you like or dislike?' },
  { id: 'visual', required: false, question: '07 · 외형 — 이모지·색·아바타 분위기 취향이 있나요? (건너뛰어도 됩니다)', questionEn: 'What visual motif, emoji, palette, or avatar style would you prefer?' },
];
const MAX_ANSWER = 4000;

function fail(message) { throw new Error(message); }

function parseArgs(args) {
  const [mode, ...rest] = args;
  if (!['start', 'show', 'update'].includes(mode)) fail('usage: interview_draft.mjs start|show|update --file <path> [--card <id> --answer <text>]');
  const result = { mode };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!['--file', '--card', '--answer', '--answer-file'].includes(key) || value === undefined) fail(`invalid option: ${key}`);
    result[key.slice(2).replace('-f', 'F')] = value;
  }
  if (!result.file) fail('--file is required');
  if (mode === 'update') {
    if (result.answer !== undefined && result.answerFile !== undefined) fail('use --answer or --answer-file, not both');
    // 답에 한글·따옴표·줄바꿈이 섞이면 셸 인자가 깨지기 쉬우므로 파일로 받는 경로를 둔다.
    if (result.answerFile !== undefined) result.answer = fs.readFileSync(path.resolve(result.answerFile), 'utf8');
    if (!result.card || !result.answer?.trim()) fail('update requires --card and a nonempty --answer or --answer-file');
  }
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
    if (answer.length > MAX_ANSWER) fail(`answer must be ${MAX_ANSWER} characters or less`);
    if (/(sk-[a-z0-9]{8,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i.test(answer)) fail('answer looks like it contains a secret (token/password/API key); do not put credentials in the interview');
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
