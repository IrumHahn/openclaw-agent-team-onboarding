# Agent Team Onboarding for OpenClaw

조직·첫 목표·제약·성공 기준을 인터뷰하고, 필요한 **최소** 에이전트 팀을 제안한 뒤, 승인된 팀만 OpenClaw에 생성하는 범용 스킬입니다. 정해진 프리셋을 찍어내지 않습니다.

A portable, interview-led skill that recommends the smallest useful agent team, creates approved personas, wires delegation, and proposes first tasks.

- 처음이라면: [10분 퀵스타트](docs/quickstart-ko.md)
- 에이전트가 따르는 절차: [`skill/agent-team-onboarding/SKILL.md`](skill/agent-team-onboarding/SKILL.md)

## 저장소 구조

```
skill/agent-team-onboarding/   ← OpenClaw에 설치하는 단위 (이 폴더만 복사)
  SKILL.md · references/ · scripts/
tests/                         ← 개발용 (가짜 openclaw CLI 포함, 설치 불필요)
docs/                          ← 사람용 안내
dist/                          ← 릴리스 zip (skill 폴더만 담김)
```

## 설치 — OpenClaw가 있는 곳(VPS) 터미널에서

```bash
git clone https://github.com/IrumHahn/openclaw-agent-team-onboarding.git
mkdir -p ~/.openclaw/skills
cp -R openclaw-agent-team-onboarding/skill/agent-team-onboarding ~/.openclaw/skills/
openclaw skills list        # agent-team-onboarding 이 보이면 성공
```

Git이 없으면 [Releases](https://github.com/IrumHahn/openclaw-agent-team-onboarding/releases)의 `agent-team-onboarding.skill`(zip)을 받아 `unzip agent-team-onboarding.skill -d ~/.openclaw/skills/` 합니다. 같은 이름의 폴더가 이미 있으면 먼저 백업하세요. 설치 후 **새 세션**에서 시작합니다.

> `openclaw skills install` 명령은 OpenClaw 버전에 따라 없을 수 있어 사용하지 않습니다. 폴더 복사가 모든 버전에서 통합니다.

## 사용

채팅에서 "에이전트 팀 만들어줘" / "Help me set up an agent team". 스킬이 ① 환경 확인 → ② 인터뷰(4장 필수 + 3장 선택) → ③ 제안서 미리보기 → ④ 승인 후 생성 → ⑤ 검증 → ⑥ 첫 주 과제 순으로 진행합니다. 답은 비공개 초안 JSON에 저장돼 중단 후 이어집니다.

## 만들어지는 것 / 만들지 않는 것

| 만든다 | 만들지 않는다 |
|---|---|
| 새 워크스페이스 + `IDENTITY/SOUL/USER/AGENTS/TEAM.md` | 채널 연결, 예약 실행(cron) |
| `openclaw agents add` + `set-identity` | 외부 메시지 발송, 결제, 게시 |
| 총괄→전문가 `subagents.allowAgents` (버전별 자동/수동) | 기존 에이전트·설정 수정/삭제 |
| `team.json`(대시보드 빌더 입력) · `team.md`(HIA 조직도) | 아바타 이미지 생성, 호스트 수준 도구 제한 |

## 요구 사항과 버전 내성

- OpenClaw CLI(`agents add`, `agents set-identity`), Node.js 18+. npm 의존성 없음.
- 위임 설정은 `config patch` → `config set` → **수동 안내** 순으로 시도합니다. 자동 설정이 불가능한 버전이면 에이전트 생성은 완료하고 종료코드 2와 함께 사람이 할 2줄을 출력합니다. `subagents.delegationMode`는 `--delegation-mode`를 명시할 때만 씁니다.
- 중간 실패 → `status`로 확인, `apply --resume`로 이어서, `rollback`으로 이 도구가 만든 것만 제거. 기존 에이전트는 건드리지 않습니다.
- 이 저장소의 테스트는 실제 OpenClaw 없이 `tests/fake-openclaw/`로 돕니다: `node --test tests/*.test.mjs`. 실제 OpenClaw 버전에서의 동작은 배포 전 1회 확인이 필요합니다.
- 프로필: `--profile <name>`. 워크스페이스 위치: 기본은 활성 OpenClaw 상태 디렉터리의 `workspaces/<team-id>/`, `--workspace-root`로 변경.

## 개발

```bash
node --test tests/*.test.mjs   # 12 tests, 가짜 CLI 사용
node scripts/pack.mjs          # dist/agent-team-onboarding.skill 재생성
```

## 라이선스

MIT.
