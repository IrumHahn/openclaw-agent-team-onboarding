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
openclaw skills install ./openclaw-agent-team-onboarding/skill/agent-team-onboarding --as agent-team-onboarding --agent main
openclaw skills list | grep agent-team-onboarding     # ready 가 보이면 성공
```

`--agent main` 은 에이전트가 2명 이상일 때 필수입니다(없으면 "Pass --agent <id>" 오류). Git이 없으면 [Releases](https://github.com/IrumHahn/openclaw-agent-team-onboarding/releases)의 `agent-team-onboarding.skill`(zip)을 받아 압축을 푼 폴더를 같은 명령으로 설치합니다. 설치 후 **새 세션**에서 시작합니다. (OpenClaw 2026.10.3 호스팅어 템플릿에서 확인. 구버전에 `skills install` 이 없으면 `cp -R skill/agent-team-onboarding ~/.openclaw/skills/`.)

## 사용

**업무 지도 모드** — "내 업무 지도 만들어줘": 5문항(하는 일·반복 업무·시간 많이 드는 일·맡기고 싶은 일·절대 맡기기 싫은 일) 인터뷰 후 main 워크스페이스에 `my-work-map.md`(상위 3개 업무 + 업무·빈도·소요시간·위임 희망도·필요한 연결 표)를 씁니다. 에이전트·성격·설정은 바꾸지 않습니다. 수동용 빈 템플릿: `references/work-map-template.md`.

**팀 모드** — 채팅에서 "에이전트 팀 만들어줘" / "Help me set up an agent team". 스킬이 ① 환경 확인 → ② 인터뷰(핵심 4장 + 관계·이름 2장 필수, 외형 선택) → ③ 제안서 미리보기 → ④ 승인 후 생성 → ⑤ 검증 → ⑥ 첫 주 과제 순으로 진행합니다. 답은 비공개 초안 JSON에 저장돼 중단 후 이어집니다.

**총괄은 새로 만들지 않고 기본 에이전트 `main`을 바꿉니다.** 그래서 이름 없는 `main`이 팀 옆에 남지 않습니다. 화면에는 한글 이름(「루미」)이 보이고, ID는 `main`으로 유지됩니다. `my-work-map.md`와 HIA 블록은 보존됩니다.

## 페르소나 템플릿

`skill/agent-team-onboarding/references/personas/` — 비서형·운영형·콘텐츠형 템플릿 3종(IDENTITY.md·SOUL.md)과 실제 운영 예시 「지혜」 공개본. 인터뷰에서 "추천해줘"라고 하면 이 파일들로 2~3안을 제안하고, 수동 트랙은 폴더를 골라 복사해 빈칸을 채웁니다. 모든 페르소나에 들어갈 5가지: 이름 · 원하는 성격 3 + 반대 성격 3 · 말투 예시 3줄 · 싫어하는 것 3 · 경계.

## 만들어지는 것 / 만들지 않는 것

| 만든다 | 만들지 않는다 |
|---|---|
| main을 총괄로: IDENTITY/SOUL/TEAM 백업 후 교체, AGENTS/USER에 팀 구역 추가 | 채널 연결, 예약 실행(cron) |
| 전문가: 새 워크스페이스 + `openclaw agents add` + `set-identity` | 외부 메시지 발송, 결제, 게시 |
| 화면 이름 `agents.entries.<id>.name`(한글) + 총괄→전문가 `subagents.allowAgents` | main 삭제, main 이외 기존 에이전트 수정/삭제 |
| `team.json`(대시보드 빌더 입력) · `team.md`(HIA 조직도) | 아바타 이미지 생성, 호스트 수준 도구 제한 |

## 요구 사항과 버전 내성

- OpenClaw CLI(`agents add`, `agents set-identity`), Node.js 18+. npm 의존성 없음.
- 위임 설정은 `config patch` → `config set` → **수동 안내** 순으로 시도합니다. 자동 설정이 불가능한 버전이면 에이전트 생성은 완료하고 종료코드 2와 함께 사람이 할 2줄을 출력합니다. `subagents.delegationMode`는 `--delegation-mode`를 명시할 때만 씁니다.
- 중간 실패 → `status`로 확인, `apply --resume`로 이어서, `rollback`으로 이 도구가 만든 것만 제거. 기존 에이전트는 건드리지 않습니다.
- 이 저장소의 테스트는 실제 OpenClaw 없이 `tests/fake-openclaw/`로 돕니다: `node --test tests/*.test.mjs`(20개). 호스팅어 VPS(OpenClaw 2026.10.3)에서 preview→apply→위임 설정까지 실증했습니다. 알려진 이슈: 그 버전의 `openclaw agents delete` 가 "not found" 를 내는 경우가 있어 rollback 은 수동 단계를 출력합니다.
- 프로필: `--profile <name>`. 워크스페이스 위치: 기본은 활성 OpenClaw 상태 디렉터리의 `workspaces/<team-id>/`, `--workspace-root`로 변경.

## 개발

```bash
node --test tests/*.test.mjs   # 20 tests, 가짜 CLI 사용
node scripts/pack.mjs          # dist/agent-team-onboarding.skill 재생성
```

## 라이선스

MIT.
