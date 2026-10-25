# Retina 소비자 설정 (Expo 예제)

이 폴더는 Retina가 이 앱을 검증할 때 읽고 쓰는 자리예요. Retina에는 아직 API가 없어서 설정 코드(`retina.config.ts`)는 두지 않았어요. 폴더 구조와 앱이 이미 지키는 계약만 먼저 맞춰 뒀어요.

## 폴더별 용도

| 경로 | 들어갈 내용 | 커밋 여부 |
| --- | --- | --- |
| `retina/scenarios/` | 딥링크 진입·입력·저장 같은 검증 시나리오 정의 | 커밋 |
| `retina/design-fixtures/` | 디자인 기준 데이터(Figma에서 추출한 값, 기준 스크린샷 등) | 커밋 |
| `retina/hooks/` | 실행 전후 훅(예: API `POST /__test/reset` 호출로 데이터 초기화) | 커밋 |
| `.retina/baselines/` | 승인한 기준 이미지(플랫폼·기기별) | 커밋 |
| `.retina/reviews/` | 사람이 내린 승인·반려 기록 | 커밋 |
| `.retina/runs/` | 실행할 때마다 생기는 결과물 | 커밋 안 함(루트 `.gitignore`) |

## 이 앱이 이미 지키는 계약

- **딥링크**: 스킴은 `retina-example`이에요. `retina-example://profile`, `retina-example://edit`(`retina-example:///edit`도 돼요). Expo Go에서는 `exp://<host>:8081/--/edit` 형태예요. 같은 링크를 다시 열어도 화면을 새로 그리고 데이터를 다시 읽어요.
- **`testID`**: `profile-name`, `profile-email`, `profile-city`, `edit-button`, `edit-form`, `field-name`, `field-email`, `field-city`, `error-name`, `error-email`, `save-button`. 보조로 `error-city`, `submit-error`, `screen-status`, `screen-scroll`도 있어요. 일반 앱 식별자라서 운영 빌드에도 남아요.
- **API 주소**: `EXPO_PUBLIC_API_BASE_URL`. 없으면 iOS는 `http://127.0.0.1:4010`, Android 에뮬레이터는 `http://10.0.2.2:4010`을 써요.
- **앱 식별자**: iOS `bundleIdentifier`, Android `package` 모두 `com.example.retinaexample`이에요.
- **키보드·스크롤**: 두 화면 모두 `ScrollView`(`keyboardShouldPersistTaps="handled"`) 안에 있고, iOS에서는 `KeyboardAvoidingView`(`padding`)가 키보드 위로 내용을 올려요. 그래서 키보드가 열려 있거나 글자 크기가 커도 Save에 닿을 수 있어요. Save를 누르면 먼저 키보드를 닫고 검증해서, 검증 오류 화면이 매번 같은 배치로 찍혀요.

### 테스트 빌드에만 들어가는 항목 (`EXPO_PUBLIC_RETINA_TEST_MODE=1`)

플래그를 켜지 않은 번들(운영 빌드)에는 아래 항목이 없어요. Expo는 `EXPO_PUBLIC_*` 값을 파일마다 번들 시점에 리터럴로 바꾸고, Metro는 모듈 사이의 상수를 접지 않아요. 그래서 비교식을 쓰는 곳마다 직접 적어 뒀어요. 이렇게 해야 압축 단계가 꺼진 분기와 문자열을 지워요.

- **준비 표시**: `testID="retina-ready-profile"`, `testID="retina-ready-edit"` 요소는 API 데이터를 받은 뒤에만 그려져요. 1x1 크기의 투명한 요소라 스크린샷에는 보이지 않아요.
- **빌드 식별자**: `testID="retina-build-id"`인 투명 텍스트에 `EXPO_PUBLIC_BUILD_ID` 값(없으면 `dev`)이 들어가요. 실제 프로젝트에서는 expo-updates나 별도 제공자로 바꿔도 돼요.
- **실행 ID**: 딥링크에 `run` 쿼리를 붙여요(`retina-example://profile?run=<id>`). ID는 메모리에만 두고, 이후 API 요청마다 `X-Retina-Run: <id>` 헤더로 보내요. 네이티브 환경 변수는 번들 시점에 고정되므로 실행 ID는 실행 시점에 딥링크로 받아요. `^[A-Za-z0-9._-]{1,64}$`에 맞지 않으면 무시해요.

빌드 결과는 루트의 `bun run example:check:prod`(표시가 없어야 통과)와 `bun run example:check:test`(표시가 있어야 통과)로 확인해요. Hermes 바이트코드(`.hbc`)는 바이트 단위로 검사해요.

## 확인하지 못한 부분

시뮬레이터·에뮬레이터를 띄우지 않고 JS 번들(`expo export`)까지만 확인했어요. 투명 마커가 Appium(XCUITest, UiAutomator2) 요소 트리에서 실제로 보이는지, 키보드가 열렸을 때 실제 배치가 어떤지(특히 Android의 edge-to-edge 화면)는 기기에서 확인해야 해요.

## 캡처 지점

실행 전에 `TEST_MODE=1`로 API를 띄우고, 실행 ID를 `X-Retina-Run` 헤더에 넣어 `POST /__test/reset`을 호출해요. 그러면 그 실행의 데이터만 기준값으로 돌아가요.

1. 첫 Profile 화면: `retina-example://profile?run=<id>`로 연 뒤 `retina-ready-profile`을 기다려요.
2. 검증 오류가 난 Edit 화면: `retina-example://edit`에서 이름을 비우거나 이메일을 잘못 넣고 `save-button`을 눌러요.
3. 저장 후 다시 들어온 Profile 화면: 올바른 값으로 저장하면 Profile로 돌아가고 API에서 값을 다시 읽어요.
