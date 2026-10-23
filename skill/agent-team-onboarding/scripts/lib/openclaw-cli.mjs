import { execFileSync } from 'node:child_process';

// OpenClaw CLI 호출 래퍼. 바이너리는 OPENCLAW_BIN 으로 바꿀 수 있다(테스트·비표준 설치).
export function cli(args, options = {}) {
  const binary = process.env.OPENCLAW_BIN || 'openclaw';
  const prefix = options.profile ? ['--profile', options.profile] : [];
  try {
    return execFileSync(binary, [...prefix, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...(options.env || {}) },
    }).trim();
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || '').trim().slice(0, 600);
    const wrapped = new Error(`openclaw ${args.slice(0, 2).join(' ')} failed: ${detail}`);
    wrapped.code = error.code;
    wrapped.stderr = detail;
    throw wrapped;
  }
}

export function cliJson(args, options) {
  const text = cli(args, options);
  try { return JSON.parse(text); }
  catch { throw new Error(`openclaw ${args.slice(0, 2).join(' ')} did not return JSON: ${text.slice(0, 200)}`); }
}

function helpLists(args, options) {
  try { return cli(args, options); } catch (error) { return error.stderr || ''; }
}

// 설치된 OpenClaw 버전이 어떤 하위 명령을 지원하는지 --help 로 확인한다.
// 버전마다 config 편집 명령이 달라서 추측으로 설정 파일을 고치지 않기 위한 장치.
export function capabilities(options = {}) {
  const configHelp = helpLists(['config', '--help'], options);
  const agentsHelp = helpLists(['agents', '--help'], options);
  const has = (help, name) => new RegExp(`(^|\\s)${name}(\\s|$)`, 'm').test(help);
  let version = null;
  try { version = cli(['--version'], options); } catch {}
  return {
    version,
    configPatch: has(configHelp, 'patch'),
    configSet: has(configHelp, 'set'),
    agentsDelete: has(agentsHelp, 'delete'),
  };
}
