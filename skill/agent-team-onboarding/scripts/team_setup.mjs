#!/usr/bin/env node
// 승인된 팀 계획(JSON)을 OpenClaw 에이전트로 만든다.
//   preview  — 충돌·검증만, 아무것도 만들지 않음
//   apply    — 생성 (반드시 --confirmed). 중간 실패 후에는 --resume 으로 이어서
//   status   — 계획의 에이전트가 실제 등록돼 있는지 보고
//   rollback — 이 스크립트가 만든 것만 제거 (--confirmed)
import fs from 'node:fs';
import path from 'node:path';
import { capabilities, cli, cliJson } from './lib/openclaw-cli.mjs';
import { agentsMarkdown, identityMarkdown, removeManagedBlock, soulMarkdown, teamJson, teamMarkdown, upsertManagedBlock, userMarkdown, writeProjectTeamMd } from './lib/outputs.mjs';

const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_AGENTS = 4;
const SECRET_PATTERN = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|xox[abp]-[a-z0-9-]{10,}|bearer\s+[a-z0-9._-]{12,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i;
const PROVISION_LOG = '.provision-log.json';
const KOREAN_LANGUAGE = /한국|korean|^ko\b/i;
const HANGUL = /[가-힣]/;
// archetype 은 OpenClaw 화면 카드에 이름 아래 그대로 보이는 한 줄이다. 메모를 섞지 않는다.
const ARCHETYPE_NOTE = /(아바타|avatar|이미지|image|없음|미정|TODO)/i;
// 기본 에이전트를 총괄로 채택할 때: 통째로 교체(백업)하는 파일 / 관리 구역만 넣는 파일.
// my-work-map.md·HIA 블록 등 나머지는 손대지 않는다.
const ADOPT_REPLACE_FILES = ['IDENTITY.md', 'SOUL.md', 'TEAM.md'];
const ADOPT_BLOCK_FILES = ['AGENTS.md', 'USER.md'];

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
    // 화면에 보이는 이름은 사용자 언어로. ID(로마자)는 내부 식별자일 뿐이다.
    if (KOREAN_LANGUAGE.test(team.language) && !HANGUL.test(agent.name)) fail(`${label}.name "${agent.name}" must be written in Korean for a Korean team (e.g. name "루미", id "lumi"). The id stays romanized; the name is what the user sees.`);
    if (agent.archetype.length > 60 || ARCHETYPE_NOTE.test(agent.archetype)) fail(`${label}.archetype is shown under the name in the OpenClaw UI: keep it a short personality phrase (≤60 chars) without notes like "아바타 이미지 없음"`);
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
  if (!modes.includes(mode)) fail(`usage: team_setup.mjs ${modes.join('|')} --plan <file> [--workspace-root <absolute-dir>] [--profile <name>] [--project-root <dir>] [--avatar-root <dir>] [--delegation-mode <mode>] [--confirmed] [--resume] [--keep-default]`);
  const options = { mode, confirmed: false, resume: false, keepDefault: false };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--confirmed') { options.confirmed = true; continue; }
    if (flag === '--resume') { options.resume = true; continue; }
    if (flag === '--keep-default') { options.keepDefault = true; continue; }
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

function roster(options) {
  const agents = cliJson(['agents', 'list', '--json'], options);
  if (!Array.isArray(agents)) fail('openclaw agents list returned an unexpected result');
  return agents;
}
function configuredIds(options) {
  return new Set(roster(options).map(agent => agent.id));
}
// 이름을 한 번도 정하지 않은 기본 에이전트(설치 직후 main).
function isBare(agent) {
  return !agent.identityName || agent.identityName === agent.id;
}
function configGet(key, options) {
  try { return cliJson(['config', 'get', key, '--json'], options); } catch { return null; }
}

function readLog(teamRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(teamRoot, PROVISION_LOG), 'utf8')); } catch { return null; }
}
function writeLog(teamRoot, log) {
  fs.writeFileSync(path.join(teamRoot, PROVISION_LOG), `${JSON.stringify(log, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function preflight(plan, options, root) {
  const teamRoot = path.join(root, plan.team.id);
  const agents = roster(options);
  const existing = new Set(agents.map(agent => agent.id));
  const log = readLog(teamRoot);
  const collisions = [];
  const warnings = [];
  const defaultAgent = agents.find(agent => agent.isDefault) || null;
  const coordinator = plan.agents.find(agent => agent.coordinator);
  // 총괄 ID 가 기본 에이전트(main)와 같으면 새로 만들지 않고 main 을 총괄로 바꾼다.
  const adopt = defaultAgent && coordinator.id === defaultAgent.id ? defaultAgent : null;
  for (const agent of plan.agents) {
    if (adopt && agent.id === adopt.id) continue;
    if (existing.has(agent.id) && !(options.resume && log?.created?.includes(agent.id))) collisions.push(agent.id);
  }
  if (adopt && !(adopt.workspace && path.isAbsolute(adopt.workspace) && fs.existsSync(adopt.workspace))) collisions.push(`default agent ${adopt.id} workspace not found: ${adopt.workspace}`);
  if (adopt && !isBare(adopt) && !log?.adopted) warnings.push(`${adopt.id} already has a persona (${adopt.identityName}). It will become ${coordinator.name}; its IDENTITY.md/SOUL.md are backed up, not deleted. Confirm with the user.`);
  if (defaultAgent && !adopt) {
    if (isBare(defaultAgent) && !options.keepDefault) collisions.push(`default agent "${defaultAgent.id}" has no persona and would remain as an unnamed extra agent next to the new coordinator. Set the coordinator id to "${defaultAgent.id}" so it becomes the coordinator, or pass --keep-default only if the user explicitly wants it kept separate`);
    else if (!isBare(defaultAgent)) warnings.push(`default agent ${defaultAgent.id} (${defaultAgent.identityName}) stays outside this team. Confirm the user wants a separate coordinator instead of converting it (coordinator id "${defaultAgent.id}").`);
  }
  const emptyPriorRun = log && Array.isArray(log.created) && log.created.length === 0 && !log.adopted;
  if (fs.existsSync(teamRoot) && !(options.resume && log) && !emptyPriorRun) collisions.push(`workspace: ${teamRoot}`);
  return { teamRoot, collisions, warnings, existing, log, adopt };
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

const stampNow = () => new Date().toISOString().replace(/[:.]/g, '-');

// 기본 에이전트(main)를 총괄로 채택: 새 워크스페이스를 만들지 않고 기존 워크스페이스에 쓴다.
// 진행 상황을 record.adopted 에 파일 단위로 남겨 중단 후 --resume 해도 원본 백업을 잃지 않는다.
function adoptWorkspace(plan, agent, record, teamRoot) {
  const state = record.adopted;
  const workspace = state.workspace;
  const full = { 'IDENTITY.md': identityMarkdown(agent), 'SOUL.md': soulMarkdown(agent), 'TEAM.md': teamMarkdown(plan) };
  for (const name of ADOPT_REPLACE_FILES) {
    const target = path.join(workspace, name);
    if (state.backups.some(b => b.file === name) || state.createdFiles.includes(name)) {
      if (!fs.existsSync(target)) writeNew(target, full[name]);
      continue;
    }
    if (fs.existsSync(target)) {
      const backup = `${name}.bak-onboarding-${stampNow()}`;
      fs.renameSync(target, path.join(workspace, backup));
      state.backups.push({ file: name, backup });
    } else state.createdFiles.push(name);
    writeLog(teamRoot, record);
    writeNew(target, full[name]);
  }
  const blocks = { 'AGENTS.md': agentsMarkdown(plan, agent), 'USER.md': userMarkdown(plan, agent) };
  for (const name of ADOPT_BLOCK_FILES) {
    const target = path.join(workspace, name);
    const exists = fs.existsSync(target);
    if (!exists && !state.createdFiles.includes(name)) state.createdFiles.push(name);
    if (!state.blockFiles.includes(name)) state.blockFiles.push(name);
    writeLog(teamRoot, record);
    fs.writeFileSync(target, upsertManagedBlock(exists ? fs.readFileSync(target, 'utf8') : '', blocks[name]), { encoding: 'utf8' });
  }
}

// 화면 이름(entries.<id>.name) + 총괄 → 전문가 위임 허용 목록. 버전별로 가능한 명령을 순서대로 시도한다.
// agents add 는 name 에 ID 를 넣기 때문에, 이걸 바꾸지 않으면 OpenClaw 화면 카드에 "lumi" 같은 ID 가 보인다.
function wireConfig(plan, options, teamRoot, caps) {
  const coordinator = plan.agents.find(agent => agent.coordinator);
  const specialists = plan.agents.filter(agent => !agent.coordinator);
  const entries = {};
  for (const agent of plan.agents) entries[agent.id] = { name: agent.name };
  let subagents = null;
  if (specialists.length) {
    subagents = { allowAgents: specialists.map(agent => agent.id) };
    if (options.delegationMode) subagents.delegationMode = options.delegationMode;
    entries[coordinator.id].subagents = subagents;
    for (const specialist of specialists) entries[specialist.id].subagents = { allowAgents: [] };
  }
  const patchPath = path.join(teamRoot, 'config.patch.json');
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
      for (const [agentId, entry] of Object.entries(entries)) {
        for (const [key, value] of Object.entries(entry)) cli(['config', 'set', `agents.entries.${agentId}.${key}`, JSON.stringify(value), '--strict-json'], options); // 2026.10.x: JSON 값은 --strict-json 필요
      }
      return { method: 'config-set', patchFile: patchPath, manualSteps: [], attempts };
    } catch (error) { attempts.push(`config set: ${error.message}`); }
  }
  const manualSteps = [
    `이 OpenClaw 버전에서는 자동으로 설정을 쓰지 못했습니다. 다음 내용을 설정에 직접 반영하세요 (패치 파일: ${patchPath}).`,
    ...plan.agents.map(agent => `${agent.id} 의 name 을 "${agent.name}" 로 설정 (화면에 보이는 이름)`),
    ...(subagents ? [
      `${coordinator.id} 의 subagents.allowAgents 를 ${JSON.stringify(subagents.allowAgents)} 로 설정`,
      ...specialists.map(s => `${s.id} 의 subagents.allowAgents 를 [] 로 설정 (전문 에이전트는 재위임 금지)`),
    ] : []),
    '방법: `openclaw config file` 로 설정 파일 위치를 확인한 뒤 해당 에이전트 항목(agents.entries.<id>)을 고치고 게이트웨이를 재시작',
  ];
  return { method: 'manual', patchFile: patchPath, manualSteps, attempts };
}

function apply(plan, options, teamRoot, log, adopt) {
  const caps = capabilities(options);
  const created = [];
  const skipped = [];
  const record = log || { teamId: plan.team.id, startedAt: new Date().toISOString(), created: [], attempts: [] };
  record.attempts.push({ at: new Date().toISOString(), resume: Boolean(options.resume) });
  if (adopt) plan.adoptedId = adopt.id;
  fs.mkdirSync(teamRoot, { recursive: true });
  writeLog(teamRoot, record);
  const teamFile = path.join(teamRoot, 'TEAM.md');
  if (!fs.existsSync(teamFile)) writeNew(teamFile, teamMarkdown(plan));
  const activeRun = { teamRoot, created, skipped };
  let adopted = null;
  try {
    for (const agent of plan.agents) {
      if (adopt && agent.id === adopt.id) {
        if (!record.adopted) {
          record.adopted = {
            id: adopt.id, workspace: adopt.workspace, done: false,
            previous: { name: adopt.name ?? adopt.id, identityName: adopt.identityName ?? null, identityEmoji: adopt.identityEmoji ?? null, subagents: configGet(`agents.entries.${adopt.id}.subagents`, options) },
            backups: [], createdFiles: [], blockFiles: [],
          };
          writeLog(teamRoot, record);
        }
        adopted = adopt.id;
        if (record.adopted.done) { skipped.push(agent.id); continue; }
        try { adoptWorkspace(plan, agent, record, teamRoot); }
        catch (error) { activeRun.failedAgent = agent.id; throw error; }
      } else {
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
      }
      const identityArgs = ['agents', 'set-identity', '--agent', agent.id, '--name', agent.name, '--emoji', agent.emoji, '--theme', agent.archetype, '--json'];
      if (agent.avatar) identityArgs.push('--avatar', agent.avatar);
      cli(identityArgs, options);
      if (adopt && agent.id === adopt.id) { record.adopted.done = true; writeLog(teamRoot, record); }
    }
    const delegation = wireConfig(plan, options, teamRoot, caps);
    record.delegation = delegation.method;
    const teamJsonPath = path.join(teamRoot, 'team.json');
    fs.writeFileSync(teamJsonPath, `${JSON.stringify(teamJson(plan), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    let projectTeamMd = null;
    const warnings = [];
    if (options.projectRoot) {
      // 에이전트는 이미 만들어졌으므로 team.md 쓰기 실패는 경고로만 남긴다 (권한 문제 등).
      try { projectTeamMd = writeProjectTeamMd(options.projectRoot, plan); }
      catch (error) { warnings.push(`team.md not written to ${options.projectRoot}: ${error.message}. Copy ${teamJsonPath} or fix permissions and re-run with --resume.`); }
    }
    record.finishedAt = new Date().toISOString();
    writeLog(teamRoot, record);
    return { created, skipped, adopted, adoptedBackups: record.adopted?.backups || [], teamRoot, teamJson: teamJsonPath, projectTeamMd, warnings, delegation, openclawVersion: caps.version, coordinatorId: plan.agents.find(agent => agent.coordinator).id };
  } catch (error) {
    error.activeRun = activeRun;
    throw error;
  }
}

function status(plan, options, teamRoot) {
  const existing = configuredIds(options);
  const log = readLog(teamRoot);
  const adoptedDone = Boolean(log?.adopted?.done);
  return {
    ok: true, mode: 'status', teamRoot, logFound: Boolean(log),
    agents: plan.agents.map(agent => {
      const adopted = log?.adopted?.id === agent.id;
      return {
        id: agent.id, registered: existing.has(agent.id),
        createdByThisTool: Boolean(log?.created?.includes(agent.id)),
        adoptedDefault: adopted,
        workspaceFiles: fs.existsSync(path.join(adopted ? log.adopted.workspace : path.join(teamRoot, agent.id), 'SOUL.md')),
      };
    }),
    delegation: log?.delegation || null,
    nextStep: log && (plan.agents.some(a => !existing.has(a.id)) || (log.adopted && !adoptedDone) || !log.finishedAt) ? 'apply --confirmed --resume' : log ? 'complete' : 'apply --confirmed',
  };
}

// 채택한 기본 에이전트 되돌리기: 에이전트는 지우지 않고, 백업 파일·이름·위임 설정을 원래대로.
function restoreAdopted(adopted, options, caps, stamp) {
  const manualSteps = [];
  const ws = adopted.workspace;
  const setAside = file => { const target = path.join(ws, file); if (fs.existsSync(target)) fs.renameSync(target, `${target}.rolled-back-${stamp}`); };
  for (const { file, backup } of adopted.backups) {
    setAside(file);
    if (fs.existsSync(path.join(ws, backup))) fs.renameSync(path.join(ws, backup), path.join(ws, file));
    else manualSteps.push(`${ws}/${backup} 백업이 없어 ${file} 를 복원하지 못했습니다`);
  }
  for (const file of adopted.blockFiles) {
    const target = path.join(ws, file);
    if (adopted.createdFiles.includes(file)) { setAside(file); continue; }
    if (fs.existsSync(target)) fs.writeFileSync(target, removeManagedBlock(fs.readFileSync(target, 'utf8')), 'utf8');
  }
  for (const file of adopted.createdFiles) if (!adopted.blockFiles.includes(file)) setAside(file);
  const { previous } = adopted;
  const tryCli = (args, label) => { try { cli(args, options); } catch (error) { manualSteps.push(`${label}: ${error.message}`); } };
  if (caps.configSet) tryCli(['config', 'set', `agents.entries.${adopted.id}.name`, JSON.stringify(previous.name), '--strict-json'], `${adopted.id} name 을 "${previous.name}" 로 되돌리기`);
  else manualSteps.push(`${adopted.id} 의 name 을 "${previous.name}" 로 되돌리세요`);
  if (previous.subagents) {
    if (caps.configSet) tryCli(['config', 'set', `agents.entries.${adopted.id}.subagents`, JSON.stringify(previous.subagents), '--strict-json'], `${adopted.id} subagents 되돌리기`);
    else manualSteps.push(`${adopted.id} 의 subagents 를 ${JSON.stringify(previous.subagents)} 로 되돌리세요`);
  } else if (caps.configUnset) tryCli(['config', 'unset', `agents.entries.${adopted.id}.subagents`], `${adopted.id} subagents 제거`);
  else manualSteps.push(`${adopted.id} 의 subagents 항목을 지우세요`);
  const identityArgs = ['agents', 'set-identity', '--agent', adopted.id, '--name', previous.identityName || adopted.id, '--json'];
  if (previous.identityEmoji) identityArgs.push('--emoji', previous.identityEmoji);
  tryCli(identityArgs, `${adopted.id} 이름 표시 되돌리기`);
  return manualSteps;
}

function rollback(plan, options, teamRoot) {
  const log = readLog(teamRoot);
  if (!log) fail(`no ${PROVISION_LOG} in ${teamRoot}; rollback only removes agents this tool created`);
  const caps = capabilities(options);
  const removed = [];
  const manualSteps = [];
  const stamp = stampNow();
  for (const agentId of log.created) {
    if (!plan.agents.some(a => a.id === agentId)) continue;
    if (caps.agentsDelete) {
      try { cli(['agents', 'delete', agentId, '--force', '--json'], options); removed.push(agentId); continue; }
      catch (error) { manualSteps.push(`${agentId}: ${error.message}`); }
    } else manualSteps.push(`openclaw 에이전트 ${agentId} 를 수동으로 삭제하세요 (이 버전에 agents delete 가 없음)`);
  }
  let restored = null;
  if (log.adopted) { manualSteps.push(...restoreAdopted(log.adopted, options, caps, stamp)); restored = log.adopted.id; }
  const archived = `${teamRoot}.rolled-back-${stamp}`;
  fs.renameSync(teamRoot, archived);
  return { ok: manualSteps.length === 0, mode: 'rollback', removed, restored, archivedWorkspace: archived, manualSteps };
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
  const { teamRoot, collisions, warnings, log, adopt } = preflight(plan, options, root);
  const summary = {
    ok: collisions.length === 0, mode: options.mode, team: plan.team.name, teamRoot,
    coordinatorId: plan.agents.find(agent => agent.coordinator).id,
    adoptsDefault: adopt ? { id: adopt.id, workspace: adopt.workspace, currentName: adopt.identityName || null, keeps: ['my-work-map.md', 'HIA block in AGENTS.md', 'other workspace files'] } : null,
    agents: plan.agents.map(agent => ({ id: agent.id, name: agent.name, role: agent.role, whyNow: agent.whyNow, menus: agent.menus, firstTask: agent.firstTasks[0], adopted: adopt?.id === agent.id, alreadyCreated: Boolean(log?.created?.includes(agent.id)) })),
    collisions,
    warnings,
  };
  if (options.mode === 'preview') {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (collisions.length) process.exitCode = 1;
    return;
  }
  if (collisions.length) fail(`preflight collisions: ${collisions.join(', ')}${log ? ' (use --resume to continue a partial run)' : ''}`);
  const result = apply(plan, options, teamRoot, options.resume ? log : null, adopt);
  process.stdout.write(`${JSON.stringify({ ok: result.delegation.method !== 'manual', mode: 'apply', ...result, warnings: [...warnings, ...result.warnings] }, null, 2)}\n`);
  if (result.delegation.method === 'manual') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, ...(error.activeRun || {}) })}\n`);
    process.exitCode = 1;
  }
}
