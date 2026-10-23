#!/usr/bin/env node
// 승인된 팀 계획(JSON)을 OpenClaw 에이전트로 만든다.
//   preview  — 충돌·검증만, 아무것도 만들지 않음
//   apply    — 생성 (반드시 --confirmed). 중간 실패 후에는 --resume 으로 이어서
//   status   — 계획의 에이전트가 실제 등록돼 있는지 보고
//   rollback — 이 스크립트가 만든 것만 제거 (--confirmed)
import fs from 'node:fs';
import path from 'node:path';
import { capabilities, cli, cliJson } from './lib/openclaw-cli.mjs';
import { agentsMarkdown, identityMarkdown, soulMarkdown, teamJson, teamMarkdown, userMarkdown, writeProjectTeamMd } from './lib/outputs.mjs';

const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_AGENTS = 4;
const SECRET_PATTERN = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|xox[abp]-[a-z0-9-]{10,}|bearer\s+[a-z0-9._-]{12,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i;
const PROVISION_LOG = '.provision-log.json';

function fail(message) { throw new Error(message); }

function oneLine(value, label, maxLength = 500) {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > maxLength) fail(`${label} must be 1–${maxLength} characters`);
  if (SECRET_PATTERN.test(cleaned)) fail(`${label} looks like it contains a secret (token/password/API key). Remove it; the plan must never carry credentials.`);
  return cleaned;
}
function id(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(`${label} must begin with a lower-case letter and contain only lower-case letters, digits, or hyphens (2–40 characters)`);
  return value;
}
function textList(value, label, min = 0, max = 20) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label} must contain ${min}–${max} items`);
  return value.map((item, index) => oneLine(item, `${label}[${index}]`));
}
function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function validateAvatar(value, label, avatarRoot) {
  const avatar = oneLine(value, label, 200000);
  if (/^https:\/\/\S+$/i.test(avatar)) return avatar;
  if (/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(avatar)) return avatar;
  if (/^(?!\/)(?!.*\.\.)[\w./-]+\.(png|jpe?g|gif|webp)$/i.test(avatar)) {
    if (!avatarRoot) fail(`${label} is a workspace-relative path; pass --avatar-root <dir> that already contains it, or use an https URL`);
    if (!fs.existsSync(path.join(avatarRoot, avatar))) fail(`${label} points to a file that does not exist under ${avatarRoot}`);
    return avatar;
  }
  fail(`${label} must be an https URL, a data:image URI, or an existing image path relative to --avatar-root`);
}

export function normalizePlan(raw, options = {}) {
  requiredObject(raw, 'plan');
  if (raw.version !== 1) fail('plan.version must be 1');
  const sourceTeam = requiredObject(raw.team, 'team');
  const team = {
    id: id(sourceTeam.id, 'team.id'),
    name: oneLine(sourceTeam.name, 'team.name'),
    organization: oneLine(sourceTeam.organization, 'team.organization'),
    product: oneLine(sourceTeam.product, 'team.product'),
    audience: oneLine(sourceTeam.audience, 'team.audience'),
    objective: oneLine(sourceTeam.objective, 'team.objective'),
    deadline: oneLine(sourceTeam.deadline, 'team.deadline'),
    successCriteria: textList(sourceTeam.successCriteria, 'team.successCriteria', 1),
    constraints: textList(sourceTeam.constraints, 'team.constraints', 0),
    tools: textList(sourceTeam.tools, 'team.tools', 0),
    userName: oneLine(sourceTeam.userName, 'team.userName'),
    language: oneLine(sourceTeam.language, 'team.language'),
    relationshipStyle: oneLine(sourceTeam.relationshipStyle, 'team.relationshipStyle'),
  };
  if (!Array.isArray(raw.agents) || raw.agents.length < 1 || raw.agents.length > MAX_AGENTS) fail(`agents must contain 1–${MAX_AGENTS} new agents`);
  const agents = raw.agents.map((source, index) => {
    const label = `agents[${index}]`;
    requiredObject(source, label);
    if (source.coordinator !== undefined && typeof source.coordinator !== 'boolean') fail(`${label}.coordinator must be boolean`);
    if (!Array.isArray(source.firstTasks) || source.firstTasks.length < 1 || source.firstTasks.length > 7) fail(`${label}.firstTasks must contain 1–7 tasks`);
    const firstTasks = source.firstTasks.map((task, taskIndex) => {
      requiredObject(task, `${label}.firstTasks[${taskIndex}]`);
      return {
        task: oneLine(task.task, `${label}.firstTasks[${taskIndex}].task`),
        why: oneLine(task.why, `${label}.firstTasks[${taskIndex}].why`),
        doneWhen: oneLine(task.doneWhen, `${label}.firstTasks[${taskIndex}].doneWhen`),
      };
    });
    const agent = {
      id: id(source.id, `${label}.id`),
      name: oneLine(source.name, `${label}.name`),
      emoji: oneLine(source.emoji, `${label}.emoji`, 16),
      archetype: oneLine(source.archetype, `${label}.archetype`),
      role: oneLine(source.role, `${label}.role`),
      mission: oneLine(source.mission, `${label}.mission`),
      whyNow: oneLine(source.whyNow, `${label}.whyNow`),
      addressUser: oneLine(source.addressUser, `${label}.addressUser`),
      traits: textList(source.traits, `${label}.traits`, 3, 3),
      counterTraits: textList(source.counterTraits, `${label}.counterTraits`, 3, 3),
      toneExamples: textList(source.toneExamples, `${label}.toneExamples`, 3, 3),
      responsibilities: textList(source.responsibilities, `${label}.responsibilities`, 1),
      outOfScope: textList(source.outOfScope, `${label}.outOfScope`, 1),
      deliverables: textList(source.deliverables, `${label}.deliverables`, 1),
      boundaries: textList(source.boundaries, `${label}.boundaries`, 1),
      failureProtocol: oneLine(source.failureProtocol, `${label}.failureProtocol`),
      menus: source.menus === undefined ? [] : textList(source.menus, `${label}.menus`, 0, 40).map(m => id(m, `${label}.menus`)),
      firstTasks,
      coordinator: source.coordinator === true,
    };
    if (source.model !== undefined) agent.model = oneLine(source.model, `${label}.model`, 150);
    if (source.avatar !== undefined) agent.avatar = validateAvatar(source.avatar, `${label}.avatar`, options.avatarRoot);
    return agent;
  });
  const ids = agents.map(agent => agent.id);
  if (new Set(ids).size !== ids.length) fail('agent IDs must be unique');
  const coordinators = agents.filter(agent => agent.coordinator);
  if (agents.length > 1 && coordinators.length !== 1) fail('multi-agent teams require exactly one coordinator');
  if (agents.length === 1 && coordinators.length > 1) fail('a team cannot have multiple coordinators');
  if (agents.length === 1) agents[0].coordinator = true;
  return { version: 1, team, agents };
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const modes = ['preview', 'apply', 'status', 'rollback'];
  if (!modes.includes(mode)) fail(`usage: team_setup.mjs ${modes.join('|')} --plan <file> [--workspace-root <absolute-dir>] [--profile <name>] [--project-root <dir>] [--avatar-root <dir>] [--delegation-mode <mode>] [--confirmed] [--resume]`);
  const options = { mode, confirmed: false, resume: false };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--confirmed') { options.confirmed = true; continue; }
    if (flag === '--resume') { options.resume = true; continue; }
    if (!['--plan', '--workspace-root', '--profile', '--project-root', '--avatar-root', '--delegation-mode'].includes(flag)) fail(`unknown option: ${flag}`);
    const value = rest[++index];
    if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
    options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!options.plan) fail('--plan is required');
  if ((mode === 'apply' || mode === 'rollback') && !options.confirmed) fail(`${mode} requires --confirmed after the user approved the exact preview`);
  for (const key of ['workspaceRoot', 'projectRoot', 'avatarRoot']) if (options[key] && !path.isAbsolute(options[key])) fail(`--${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())} must be absolute`);
  if (options.profile && !ID_PATTERN.test(options.profile)) fail('--profile must be a simple lower-case profile name');
  if (options.delegationMode && !/^[a-z-]{2,20}$/.test(options.delegationMode)) fail('--delegation-mode must be a simple word');
  return options;
}

function activeRoot(options) {
  if (options.workspaceRoot) return path.resolve(options.workspaceRoot);
  if (process.env.OPENCLAW_STATE_DIR && !options.profile) return path.join(path.resolve(process.env.OPENCLAW_STATE_DIR), 'workspaces');
  const configPath = cli(['config', 'file'], options);
  if (!path.isAbsolute(configPath)) fail('openclaw config file did not return an absolute path');
  return path.join(path.dirname(configPath), 'workspaces');
}

function configuredIds(options) {
  const agents = cliJson(['agents', 'list', '--json'], options);
  if (!Array.isArray(agents)) fail('openclaw agents list returned an unexpected result');
  return new Set(agents.map(agent => agent.id));
}

function readLog(teamRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(teamRoot, PROVISION_LOG), 'utf8')); } catch { return null; }
}
function writeLog(teamRoot, log) {
  fs.writeFileSync(path.join(teamRoot, PROVISION_LOG), `${JSON.stringify(log, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function preflight(plan, options, root) {
  const teamRoot = path.join(root, plan.team.id);
  const existing = configuredIds(options);
  const log = readLog(teamRoot);
  const collisions = [];
  for (const agent of plan.agents) {
    if (existing.has(agent.id) && !(options.resume && log?.created?.includes(agent.id))) collisions.push(agent.id);
  }
  if (fs.existsSync(teamRoot) && !(options.resume && log)) collisions.push(`workspace: ${teamRoot}`);
  return { teamRoot, collisions, existing, log };
}

function writeNew(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}
function writeWorkspace(plan, agent, workspace) {
  fs.mkdirSync(workspace, { recursive: true });
  const files = { 'IDENTITY.md': identityMarkdown(agent), 'SOUL.md': soulMarkdown(agent), 'USER.md': userMarkdown(plan, agent), 'AGENTS.md': agentsMarkdown(plan, agent), 'TEAM.md': teamMarkdown(plan) };
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(workspace, name);
    if (!fs.existsSync(target)) writeNew(target, content);
  }
}

// 총괄 → 전문가 위임 허용 목록. 버전별로 가능한 명령을 순서대로 시도한다.
function wireDelegation(plan, options, teamRoot, caps) {
  if (plan.agents.length < 2) return { method: 'none', manualSteps: [] };
  const coordinator = plan.agents.find(agent => agent.coordinator);
  const specialists = plan.agents.filter(agent => !agent.coordinator);
  const subagents = { allowAgents: specialists.map(agent => agent.id) };
  if (options.delegationMode) subagents.delegationMode = options.delegationMode;
  const entries = { [coordinator.id]: { subagents } };
  for (const specialist of specialists) entries[specialist.id] = { subagents: { allowAgents: [] } };
  const patchPath = path.join(teamRoot, 'delegation.patch.json');
  fs.writeFileSync(patchPath, `${JSON.stringify({ agents: { entries } }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  const attempts = [];
  if (caps.configPatch) {
    try {
      cli(['config', 'patch', '--file', patchPath, '--dry-run'], options);
      cli(['config', 'patch', '--file', patchPath], options);
      return { method: 'config-patch', patchFile: patchPath, manualSteps: [] };
    } catch (error) { attempts.push(`config patch: ${error.message}`); }
  }
  if (caps.configSet) {
    try {
      for (const [agentId, entry] of Object.entries(entries)) cli(['config', 'set', `agents.entries.${agentId}.subagents`, JSON.stringify(entry.subagents)], options);
      return { method: 'config-set', patchFile: patchPath, manualSteps: [], attempts };
    } catch (error) { attempts.push(`config set: ${error.message}`); }
  }
  const manualSteps = [
    `이 OpenClaw 버전에서는 자동으로 위임 설정을 쓰지 못했습니다. 다음 내용을 설정에 직접 반영하세요 (패치 파일: ${patchPath}).`,
    `${coordinator.id} 의 subagents.allowAgents 를 ${JSON.stringify(subagents.allowAgents)} 로 설정`,
    ...specialists.map(s => `${s.id} 의 subagents.allowAgents 를 [] 로 설정 (전문 에이전트는 재위임 금지)`),
    '방법: `openclaw config file` 로 설정 파일 위치를 확인한 뒤 해당 에이전트 항목에 subagents 를 추가하고 게이트웨이를 재시작',
  ];
  return { method: 'manual', patchFile: patchPath, manualSteps, attempts };
}

function apply(plan, options, teamRoot, log) {
  const caps = capabilities(options);
  const created = [];
  const skipped = [];
  const record = log || { teamId: plan.team.id, startedAt: new Date().toISOString(), created: [], attempts: [] };
  record.attempts.push({ at: new Date().toISOString(), resume: Boolean(options.resume) });
  fs.mkdirSync(teamRoot, { recursive: true });
  writeLog(teamRoot, record);
  const teamFile = path.join(teamRoot, 'TEAM.md');
  if (!fs.existsSync(teamFile)) writeNew(teamFile, teamMarkdown(plan));
  const activeRun = { teamRoot, created, skipped };
  try {
    for (const agent of plan.agents) {
      const workspace = path.join(teamRoot, agent.id);
      if (record.created.includes(agent.id)) { skipped.push(agent.id); continue; }
      writeWorkspace(plan, agent, workspace);
      const args = ['agents', 'add', agent.id, '--workspace', workspace, '--non-interactive', '--json'];
      if (agent.model) args.push('--model', agent.model);
      let added;
      try { added = cliJson(args, options); }
      catch (error) { activeRun.failedAgent = agent.id; throw error; }
      const returnedId = added.agentId || added.id;
      if (returnedId && returnedId !== agent.id) fail(`unexpected creation result for ${agent.id}: got ${returnedId}`);
      if (added.workspace && path.resolve(added.workspace) !== workspace) fail(`unexpected workspace for ${agent.id}: ${added.workspace}`);
      created.push(agent.id);
      record.created.push(agent.id);
      writeLog(teamRoot, record);
      const identityArgs = ['agents', 'set-identity', '--agent', agent.id, '--name', agent.name, '--emoji', agent.emoji, '--theme', agent.archetype, '--json'];
      if (agent.avatar) identityArgs.push('--avatar', agent.avatar);
      cli(identityArgs, options);
    }
    const delegation = wireDelegation(plan, options, teamRoot, caps);
    record.delegation = delegation.method;
    const teamJsonPath = path.join(teamRoot, 'team.json');
    fs.writeFileSync(teamJsonPath, `${JSON.stringify(teamJson(plan), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    let projectTeamMd = null;
    if (options.projectRoot) projectTeamMd = writeProjectTeamMd(options.projectRoot, plan);
    record.finishedAt = new Date().toISOString();
    writeLog(teamRoot, record);
    return { created, skipped, teamRoot, teamJson: teamJsonPath, projectTeamMd, delegation, openclawVersion: caps.version, coordinatorId: plan.agents.find(agent => agent.coordinator).id };
  } catch (error) {
    error.activeRun = activeRun;
    throw error;
  }
}

function status(plan, options, teamRoot) {
  const existing = configuredIds(options);
  const log = readLog(teamRoot);
  return {
    ok: true, mode: 'status', teamRoot, logFound: Boolean(log),
    agents: plan.agents.map(agent => ({
      id: agent.id, registered: existing.has(agent.id),
      createdByThisTool: Boolean(log?.created?.includes(agent.id)),
      workspaceFiles: fs.existsSync(path.join(teamRoot, agent.id, 'SOUL.md')),
    })),
    delegation: log?.delegation || null,
    nextStep: log && plan.agents.some(a => !existing.has(a.id)) ? 'apply --confirmed --resume' : log ? 'complete' : 'apply --confirmed',
  };
}

function rollback(plan, options, teamRoot) {
  const log = readLog(teamRoot);
  if (!log) fail(`no ${PROVISION_LOG} in ${teamRoot}; rollback only removes agents this tool created`);
  const caps = capabilities(options);
  const removed = [];
  const manualSteps = [];
  for (const agentId of log.created) {
    if (!plan.agents.some(a => a.id === agentId)) continue;
    if (caps.agentsDelete) {
      try { cli(['agents', 'delete', agentId, '--json'], options); removed.push(agentId); continue; }
      catch (error) { manualSteps.push(`${agentId}: ${error.message}`); }
    } else manualSteps.push(`openclaw 에이전트 ${agentId} 를 수동으로 삭제하세요 (이 버전에 agents delete 가 없음)`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archived = `${teamRoot}.rolled-back-${stamp}`;
  fs.renameSync(teamRoot, archived);
  return { ok: manualSteps.length === 0, mode: 'rollback', removed, archivedWorkspace: archived, manualSteps };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = normalizePlan(JSON.parse(fs.readFileSync(path.resolve(options.plan), 'utf8')), options);
  const root = activeRoot(options);
  if (options.mode === 'status') { process.stdout.write(`${JSON.stringify(status(plan, options, path.join(root, plan.team.id)), null, 2)}\n`); return; }
  if (options.mode === 'rollback') {
    const result = rollback(plan, options, path.join(root, plan.team.id));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 2;
    return;
  }
  const { teamRoot, collisions, log } = preflight(plan, options, root);
  const summary = {
    ok: collisions.length === 0, mode: options.mode, team: plan.team.name, teamRoot,
    coordinatorId: plan.agents.find(agent => agent.coordinator).id,
    agents: plan.agents.map(agent => ({ id: agent.id, name: agent.name, role: agent.role, whyNow: agent.whyNow, menus: agent.menus, firstTask: agent.firstTasks[0], alreadyCreated: Boolean(log?.created?.includes(agent.id)) })),
    collisions,
  };
  if (options.mode === 'preview') {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (collisions.length) process.exitCode = 1;
    return;
  }
  if (collisions.length) fail(`preflight collisions: ${collisions.join(', ')}${log ? ' (use --resume to continue a partial run)' : ''}`);
  const result = apply(plan, options, teamRoot, options.resume ? log : null);
  process.stdout.write(`${JSON.stringify({ ok: result.delegation.method !== 'manual', mode: 'apply', ...result }, null, 2)}\n`);
  if (result.delegation.method === 'manual') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, ...(error.activeRun || {}) })}\n`);
    process.exitCode = 1;
  }
}
