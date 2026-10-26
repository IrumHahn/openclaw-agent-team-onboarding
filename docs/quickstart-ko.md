# 10분 퀵스타트 — 에이전트 팀 온보딩

> 처음 OpenClaw를 쓰는 분을 위한 가장 짧은 길. 명령은 **VPS 터미널**(OpenClaw가 설치된 곳)에서 실행합니다. 내 PC의 PowerShell이 아닙니다.

## 1. 설치 (VPS 터미널, 1분)

```bash
cd ~
git clone https://github.com/IrumHahn/openclaw-agent-team-onboarding.git
openclaw skills install ./openclaw-agent-team-onboarding/skill/agent-team-onboarding --as agent-team-onboarding --agent main
openclaw skills list | grep agent-team-onboarding
```

`ready │ agent-team-onboarding` 이 보이면 설치된 것입니다. `--agent main` 은 에이전트가 여러 명일 때 꼭 필요합니다. 안 보이면 새 OpenClaw 세션을 열고 "agent-team-onboarding 스킬이 보이는지 알려줘"라고 물어보세요.

> Git이 없다면: GitHub 페이지의 **Releases**에서 `agent-team-onboarding.skill` 파일을 받아 압축을 풀고, 푼 폴더를 위 `openclaw skills install <폴더> …` 로 설치합니다.

## 2. 시작 (OpenClaw 채팅, 5분)

대시보드(또는 텔레그램)에서 비서에게 이렇게 보냅니다:

```
에이전트 팀 만들어줘. 우리 조직과 첫 목표를 먼저 질문해줘.
답변을 바탕으로 필요한 최소한의 에이전트와 그 이유를 제안해줘.
각 에이전트의 성격·말투와 첫 과제도 보여주고, 생성 전에는 내 확인을 받아줘.
```

> 실행학교 1주차라면 과제1에서 먼저 "내 업무 지도 만들어줘"라고 보내 `my-work-map.md`부터 만드세요. 이 단계는 에이전트를 만들지 않습니다.

질문 4개가 옵니다. 모르면 **"미정"**, 성격은 **"추천해줘"** 라고 답해도 됩니다.

## 3. 확인하고 승인 (2분)

제안서에서 볼 것 세 가지:
1. 에이전트가 **왜 지금** 필요한지 이유가 적혀 있는가
2. 각자 **첫 과제**가 있는가
3. 내가 승인하기 전에는 아무것도 **발송·게시하지 않는다**고 써 있는가

이름·역할 수를 고친 뒤 "이대로 만들어줘"라고 하면 생성됩니다.

## 4. 됐는지 확인 (1분)

```bash
openclaw agents list
```

`main` 외에 이름 없는 에이전트가 없고, 화면에 한글 이름(예: 루미·노바)이 보이면 성공. 총괄은 새로 생기지 않고 `main`이 총괄 이름으로 바뀝니다. 비서가 알려준 `team.md`(조직도) 위치도 열어 보세요.

## 막혔을 때

| 증상 | 해결 |
|---|---|
| "스킬이 안 보여요" | `openclaw skills list | grep onboarding` → 없으면 설치 명령에 `--agent main` 을 붙여 다시 → 새 세션 열기 |
| 중간에 실패했어요 | 비서에게 "팀 생성 상태 확인해줘" → 남은 것만 이어서 만들거나(`--resume`) 되돌리기(`rollback`)를 안내받습니다 |
| "위임 설정은 수동으로 하라"고 나와요 | 에이전트는 만들어진 것입니다. 안내된 설정 2줄만 설정 파일에 넣으면 됩니다. 1주차에는 없어도 괜찮습니다 |
| 토큰을 넣었더니 거부돼요 | 정상입니다. 인터뷰 답에는 비밀번호·키를 넣지 않습니다 |

다음 단계: **dashboard-builder** 스킬로 이 팀이 보이는 내 AI 오피스를 만듭니다.
