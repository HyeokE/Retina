# Retina 소비자 설정 (web 예제)

이 폴더는 Retina가 이 앱을 검증할 때 읽고 쓰는 자리예요. Retina에는 아직 API가 없어서 설정 코드(`retina.config.ts`)는 두지 않았어요. 폴더 구조와 앱이 이미 지키는 계약만 먼저 맞춰 뒀어요.

## 폴더별 용도

| 경로 | 들어갈 내용 | 커밋 여부 |
| --- | --- | --- |
| `retina/scenarios/` | 화면 진입·입력·저장 같은 검증 시나리오 정의 | 커밋 |
| `retina/design-fixtures/` | 디자인 기준 데이터(Figma에서 추출한 값, 기준 스크린샷 등) | 커밋 |
| `retina/hooks/` | 실행 전후 훅(예: API `POST /__test/reset` 호출로 데이터 초기화) | 커밋 |
| `.retina/baselines/` | 승인한 기준 이미지 | 커밋 |
| `.retina/reviews/` | 사람이 내린 승인·반려 기록 | 커밋 |
| `.retina/runs/` | 실행할 때마다 생기는 결과물 | 커밋 안 함(루트 `.gitignore`) |

## 이 앱이 이미 지키는 계약

- **진입 URL**: 경로 기반이에요. `/`는 Profile, `/edit`는 Edit profile 화면이에요. 해시(`#/edit`)는 쓰지 않아요. Vite 개발 서버(5173)와 preview 서버(4173)는 모르는 경로도 `index.html`로 돌려줘요. 정적 호스팅에 올릴 때는 같은 폴백 설정이 필요해요.
- **`data-testid`**: `profile-name`, `profile-email`, `profile-city`, `edit-button`, `edit-form`, `field-name`, `field-email`, `field-city`, `error-name`, `error-email`, `save-button`. 보조로 `error-city`, `submit-error`, `screen-status`도 있어요. 일반 앱 식별자라서 운영 빌드에도 남아요.
- **API 주소**: `VITE_API_BASE_URL`(기본값 `http://127.0.0.1:4010`).

### 테스트 빌드에만 들어가는 항목 (`VITE_RETINA_TEST_MODE=1`)

플래그를 켜지 않은 빌드(운영 빌드)에는 아래 항목이 없어요. 플래그는 `vite.config.ts`의 `define`이 사용하는 곳마다 `true`/`false` 리터럴로 바꿔요. 그래서 꺼진 빌드에서는 압축 단계가 해당 분기와 문자열을 지워요.

- **준비 표시**: 화면 루트의 `data-retina-ready="profile"` 또는 `data-retina-ready="edit"`. API 데이터를 받은 뒤에만 붙고, 로딩·오류 화면에는 붙지 않아요.
- **빌드 식별자**: `<meta name="retina-build-id" content="...">`. 값은 빌드 시점의 `VITE_BUILD_ID`이고, 없으면 `dev`예요.
- **실행 ID**: `/?retinaRun=<id>`로 열면 ID를 `sessionStorage`에 보관해요. 이후 API 요청마다 `X-Retina-Run: <id>` 헤더로 보내요. ID는 `^[A-Za-z0-9._-]{1,64}$`를 만족해야 하고, 맞지 않으면 무시해요. 실행 ID는 실행할 때마다 바뀌어서 빌드 시점이 아니라 실행 시점에 넣어요.

빌드 결과는 루트에서 확인해요.

- `bun run example:check:prod`: 플래그를 끈 채 빌드하고 `retina-ready`, `retina-build-id`, `__test/`가 한 번도 없어야 통과해요.
- `bun run example:check:test`: 플래그를 켠 채 빌드하고 표시가 실제로 있어야 통과해요. 검사가 빈 껍데기가 아님을 보여 줘요.

## 캡처 지점

실행 전에 `TEST_MODE=1`로 API를 띄우고(`bun run example:api:test`), 실행 ID를 정해 `POST /__test/reset`에 `X-Retina-Run` 헤더와 함께 보내요. 그러면 그 실행의 데이터만 기준값으로 돌아가요.

1. 첫 Profile 화면: `/?retinaRun=<id>` 진입 후 `[data-retina-ready="profile"]`를 기다려요.
2. 검증 오류가 난 Edit 화면: `/edit`에서 이름을 비우거나 이메일을 `not-an-email`로 바꾼 뒤 `save-button`을 눌러요. `error-name` 또는 `error-email`이 보여요.
3. 저장 후 다시 들어온 Profile 화면: 올바른 값으로 저장하면 Profile로 돌아가요. 이때 Profile이 API에서 값을 다시 읽어요.
