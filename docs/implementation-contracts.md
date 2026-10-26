# 실행·판정·증거 계약

작성일은 2026-10-25예요. 이 문서는 [검증 계획서](visual-regression-skill-plan.md)의 구현 상세안이에요. 제품 범위와 결정 기록은 검증 계획서를 기준으로 하고, 이 문서는 실행 순서와 데이터·실패 처리 조건을 구체화해요. 여기의 파일 이름·필드·기본 시간은 **구현 제안**이며 설치 가능한 API를 뜻하지 않아요. 작업 순서는 [구현 단계와 수용 기준](implementation-roadmap.md)에 있어요.

## 1. 구현 경계

| 구분 | 담당 범위 |
| --- | --- |
| `domain/verdict` | `Status`, `aggregateRun`, `exitCodeFor`, `mergeReview`의 순수 계산을 맡아요. 기존 네 상태와 병합 순서를 유지해요. |
| `domain/compare` | `comparePixels`로 원시 RGBA를 비교하고 `diffRegions`로 차이 영역을 계산해요. PNG 디코딩과 파일 읽기는 맡지 않아요. |
| `domain/run`·`config` | 실행 계획, 필수 검사 목록과 provider 계약을 표현해요. 환경·파일·프로세스 접근은 주입한 경계에서 수행해요. |
| 어댑터·`infrastructure` | 플랫폼 실행, PNG 읽기·쓰기, 외부 API, 증거 저장과 HTML 렌더링을 맡아요. |
| `cli` | 설정을 읽고 실행을 연결하며, 최종 판정과 실행 오류를 종료 코드로 전달해요. |

G-B1의 `a954a13`에 추가된 함수 이름과 데이터 모델을 유지해요. 현재 `aggregateRun`의 입력은 `requiredCases`이고, 아래 `requiredCaseIds`·`expectedChecks`는 저장할 실행 계획의 필드 제안이에요. 아래 실행 계획·증거 메타데이터는 도메인 결과를 저장·전달하는 상위 계약이에요. 모든 필드를 `CaseResult`에 넣거나, 공통 어댑터 인터페이스를 먼저 크게 만들지 않아요.

## 2. 실행 계획 고정

### 입력과 선택 규칙

1. 소비 저장소 설정에서 지원 profile, 시나리오, checkpoint, 검사 종류, 요구사항 근거를 읽어요. CI 전체 검증의 필수 목록은 기본적으로 보호된 기준 revision에서 가져와요. 보호 경로 변경을 승인받았다면 6장의 선택 규칙으로 후보 목록을 고정해요.
2. CLI의 mode와 선택 조건을 적용해요. 알 수 없는 profile, platform과 profile의 충돌, 빈 선택은 준비 전에 실행 오류로 끝내요.
3. 선택한 검사에 필요한 provider·환경 변수·baseline·디자인 입력을 확인해요. 비밀 값은 계획에 저장하지 않고 필요한 환경 변수 이름과 충족 여부만 남겨요.
4. 실제 실행 전에 `plan.json`을 저장해요. 실행 중 설정 파일이 바뀌어도 현재 계획을 다시 읽어 실행 범위를 바꾸지 않아요.
5. 실행 뒤에는 이 계획과 관찰 결과를 대조해요. 테스트를 찾지 못했거나 필수 항목이 빠져도 빈 실행을 정상으로 보지 않아요.

| `plan.json` 필드 제안 | 의미 |
| --- | --- |
| `schemaVersion`, `runId`, `attempt` | 저장 형식 버전, 논리 실행과 재시도 회차를 구분해요. 재실행은 기존 결과를 덮어쓰지 않아요. |
| `mode`, `scope` | `dev`·`validate`, 전체 또는 선택 실행을 기록해요. |
| `projectPlatforms`, `declaredPlatforms`, `selectedProfiles` | 프로젝트가 지원하는 플랫폼, 이번에 실행할 플랫폼과 profile을 각각 남겨요. |
| `requiredCaseIds`, `expectedChecks` | 필수 케이스와 케이스별 검사 종류를 고정해요. 체크 하나를 삭제해도 해당 케이스의 다른 체크로 누락을 가리지 못하게 해요. |
| `excluded` | 선택하지 않은 항목과 사유를 남겨요. 실행하다 실패한 항목을 여기에 옮기지 않아요. |
| `source` | 소비 저장소, PR head SHA, 실제 검사한 commit SHA, 기준 ref와 revision을 남겨요. PR의 merge commit과 head SHA를 혼동하지 않아요. |
| `policyHash`, `configRevision`, `planHash` | 정책과 실행 목록을 식별해요. provider 함수의 `toString()`을 재현성 근거로 쓰지 않고, 코드 revision·설정 파일·lockfile의 식별을 함께 보관해요. |
| `expectedJobs` | CI가 수집해야 할 profile별 job과 실행 회차를 기록해요. 결과 파일에서 역으로 필수 job 목록을 만들지 않아요. |

`caseId`는 `scenario/profile/checkpoint` 조합으로 유일하게 만들어요. 한 케이스 안에서는 `CheckResult.kind`도 유일해야 해요. 예를 들어 `profile-form/web-desktop/after-save`의 `functional`과 `regression`은 별도 검사예요. 같은 `web` 플랫폼의 데스크톱·모바일 폭도 서로 다른 필수 케이스예요.

실행 계획의 선택 범위는 도메인 `scope.kind`의 `full`·`partial`에 연결하고, 같은 플랫폼 안의 profile·검사 누락도 상위 실행 계층에서 확인해요. 선택 실행은 선택한 범위가 모두 통과하면 종료 코드 `0`일 수 있어요. 다만 `scope: selected`, `gateEligible: false`로 표시하고, 전체 프로젝트 통과로 보고하지 않아요. CI 필수 gate는 승인된 전체 실행 계획을 사용한 `validate`만 대상으로 해요. 범위를 줄이는 CLI 필터로 필수 gate를 통과할 수 없어요.

### Vitest 연결

Retina의 필수 검사 목록과 Vitest가 발견·실행한 테스트를 각각 기록해요. Vitest 성공 코드만으로 Retina 결과를 만들지 않아요. `skip`, `todo`, 수집 오류와 필수 검사 미기록을 누락으로 처리해요. 하나의 필수 케이스에서 실행한 체크 수가 0이어도 미완료예요.

Vitest 연결 방식은 G-A3에서 3.2.x와 5를 각각 시험한 뒤 정해요. reporter 이벤트는 버전과 수집·실행 단계에 의존하므로, 파일별 결과와 전체 종료 오류가 모두 전달되는지 확인해요. 현재 공식 문서도 reporter를 고급 API로 분류하고, 테스트 파일이 없는 실행을 별도로 설명해요. [Vitest reporter 문서](https://vitest.dev/api/advanced/reporters)

## 3. provider 실행과 복구

| 순서 | 동작 | 실패했을 때 |
| --- | --- | --- |
| 1. 사전 검사 | 필수 입력, 장치, 메모리, 지원 profile과 준비 명령을 확인해요. | 설치·부팅·데이터 변경 전에 중단해요. |
| 2. 자원 확보 | run·profile별 fixture 네임스페이스와 장치·포트 점유를 확보해요. 소유한 자원 식별자를 기록해요. | 다른 실행 자원을 재사용하거나 종료하지 않아요. |
| 3. fixture 준비 | 필요한 공유 상태를 snapshot하고 멱등 `setup`을 실행해요. | 부분 변경의 복구 가능 여부를 기록하고 정리 단계로 가요. |
| 4. 환경·데이터·인증 | 시계·로캘·fixture·인증을 적용해요. 서로 필요한 단계는 provider 의존 순서로 명시해요. | 준비 실패 후 정상 화면을 촬영한 것처럼 검사하지 않아요. |
| 5. 이동·준비·식별 | 화면으로 이동하고 ready 신호, 실제 빌드·bundle, 예상 화면을 확인해요. | 준비 실패·잘못된 bundle·화면 오인식을 `INCONCLUSIVE`로 남겨요. |
| 6. 실행·촬영 | assertion, 콘텐츠 확인, 촬영, 비교를 수행해요. | 기능 실패와 실행 오류를 구분하고 확보한 증거를 보존해요. |
| 7. 정리 | fixture restore·run 종료, 소유 세션·프로세스·기기 정리와 점유 해제를 수행해요. | 정리 실패를 별도 실행 오류로 남겨요. 앞선 검사 실패는 지우지 않아요. |
| 8. 결과 저장 | 원본 결과, 정리 결과와 증거 목록을 저장해요. | 저장 실패를 성공으로 끝내지 않아요. 디스크 기록도 불가능하면 stderr와 CI 종료 상태가 최소 증거예요. |

모든 provider 호출에는 `runId`, `profileId`, `fixtureScope`, 취소 신호와 deadline을 전달하는 안을 사용해요. 읽기 전용 조회와 상태를 바꾸는 호출을 구분하고, 실패한 상태 변경을 일반 재시도로 반복하지 않아요. fixture setup/reset의 멱등성은 별도 수용 실험으로 확인해요.

초기 시간 상한 제안은 ready 30초, fixture·인증 훅 각각 60초, 촬영 10초, 정리 30초예요. 앱 빌드·부팅은 이 값과 분리해 측정하고, CI job 전체 상한은 계획서 22장을 따라요. 파일럿 측정으로 조정하되 무제한 대기는 허용하지 않아요. 강제 종료에서는 정리를 보장할 수 없으므로 다음 실행이 잔존 자원과 복구 기록을 확인해요.

같은 프로세스의 잠금만으로 여러 CI runner가 공유 계정을 보호했다고 보지 않아요. 기본은 run·profile별 계정이나 데이터 네임스페이스예요. 공유 자원이 불가피하면 소비 프로젝트가 외부 점유·복구 방법을 제공해야 해요. 자격 증명은 실행 시점에 주입하고 snapshot·artifact·빌드에 넣지 않아요.

## 4. 판정과 종료 코드

대표 상태는 기존 순서인 `FAIL > INCONCLUSIVE > REVIEW_REQUIRED > PASS`로 집계해요. 모든 원인은 별도로 남겨요. 종료 코드는 상태 문자열만으로 정하지 않고 **실행 오류 존재 여부**를 함께 사용해요.

| 우선순위 | 조건 | 종료 코드 |
| --- | --- | --- |
| 1 | 설정·provider·실행·집계·필수 산출물 생성 오류가 있어요. | `2`예요. |
| 2 | 실행 오류 없이 필수 검사에 `FAIL`이 있어요. | `1`이에요. |
| 3 | 실행 오류·`FAIL` 없이 필수 검토나 미완료가 남아요. | `3`이에요. |
| 4 | 필수 결과가 모두 `PASS`예요. | `0`이에요. |

이 우선순위는 계획서 11.1장의 혼합 상황을 구체화한 제안이에요. `exitCodeFor`의 실행 오류 입력으로 전달하고, 자유로운 오류 메시지를 파싱해 코드를 추론하지 않아요. `aggregateRun`에 넣기 전·후의 증거 검증 오류도 같은 실행 오류 목록에 포함해요.

| 재현 입력 | 대표 상태 | 종료 코드·기대 결과 |
| --- | --- | --- |
| 웹·iOS·Android의 필수 결과가 모두 통과해요. | `PASS` | `0`이에요. 전체 검증 요건도 충족해야 gate 후보예요. |
| 저장값 assertion만 실패해요. | `FAIL` | `1`이에요. |
| 저장값이 실패하고 앱 provider도 오류를 내요. | `FAIL` | `2`예요. 두 원인을 모두 보여줘요. |
| 새 baseline의 승인이 없어요. | `REVIEW_REQUIRED` | `3`이에요. |
| 로컬과 승인 baseline의 fingerprint가 달라 필수 회귀를 비교할 수 없어요. | `INCONCLUSIVE` | `3`이에요. |
| 계획한 job이 취소되거나 결과 JSON이 없어요. | `INCONCLUSIVE` | `2`예요. 이미 확인한 다른 `FAIL`이 있으면 대표 상태는 `FAIL`로 유지해요. |
| 필수 테스트 0개 또는 결과가 중복돼요. | `INCONCLUSIVE` | `2`예요. |
| 자동 검사는 통과했지만 HTML 생성·필수 이미지 확보·정리에 실패해요. | `INCONCLUSIVE` | `2`예요. |

이유 코드는 구조화해요. 도메인의 `missing`, `platform_missing`, `no_checks`는 유지하고, 실행 계층은 `provider_error`, `result_invalid`, `evidence_missing`, `cleanup_failed`, `report_failed` 같은 코드를 구분하는 안이에요. 코드 목록은 스키마와 함께 버전 관리해요.

## 5. 결과 파일과 CI 집계

### 저장 형식 제안

```text
.retina/runs/<runId>/attempt-<n>/
  plan.json
  jobs/<profileId>/
    automatic.json
    artifacts.json
    images/
    logs/
  result.json
  report.html
  assets/
  reviews/<reviewId>/
    review.json
    result.json
    report.html
```

job마다 자기 디렉터리에만 쓰고, 집계 job이 최종 `result.json`과 `report.html`을 만들어요. 서로 다른 job이 같은 JSON을 덮어쓰지 않아요. 파일은 임시 파일에 완전히 쓴 뒤 같은 파일시스템에서 이름을 바꾸는 방식으로 완료 여부를 구분해요. 강제 종료로 남은 부분 파일은 정상 결과로 읽지 않아요.

| 결과 메타데이터 필드 제안 | 검사 조건 |
| --- | --- |
| `schemaVersion`, `runId`, `attempt`, `planHash` | 계획과 정확히 같아야 해요. 알 수 없는 스키마 버전은 거부해요. |
| `profileId`, `platform`, `source`, `buildIdentity` | 예정된 job, 후보 revision과 실제 빌드·bundle을 확인해요. |
| `execution.state`, `execution.errors`, `cleanup` | 검사 완료와 실행·정리 실패를 구분해요. 프로세스 종료 자체를 검사 완료로 보지 않아요. |
| `cases: CaseResult[]` | `caseId`·profile·platform과 기대한 `CheckResult.kind` 집합이 맞아야 해요. 중복 키는 오류예요. |
| `environment` | fingerprint와 측정 단위를 기록해요. 실제로 읽지 못한 값을 빈 문자열·기본값으로 채워 일치시키지 않아요. |
| `artifacts` | 각 파일의 상대 경로·용도·바이트 수·SHA-256을 남겨요. 이미지가 없는 검사도 사유를 기록해요. |
| `startedAt`, `finishedAt`, `timings` | 전체 실행과 단계별 시간을 따로 기록해요. |

`finalize`는 보호된 실행 계획 → CI job 상태 → 결과 메타데이터 → 필수 검사 목록 → 파일·해시 → 정책·승인 순으로 확인해요. 과거 실행·다른 attempt·다른 plan의 artifact를 가져와 누락을 채우지 않아요. 같은 키가 두 번 오면 마지막 파일을 고르는 대신 오류로 남겨요.

부분 job 재실행의 artifact를 자동 혼합하는 기능은 처음에는 넣지 않아요. 필수 gate 재실행은 같은 계획의 전체 행렬을 새 attempt로 실행해요. 나중에 부분 재사용을 지원하려면 job별 출처와 선택된 attempt를 명시한 별도 계약이 필요해요.

파손 JSON, 경로 탈출, 해시 불일치, 누락 job도 최종 리포트의 원인 목록에 보여줘요. 검사가 확인한 `FAIL`은 남기고, 모르는 결과를 `PASS`로 추정하지 않아요. HTML은 같은 집계 결과를 렌더링하며 별도의 판정 로직을 갖지 않아요. 사후 검토는 원본 `automatic.json`과 초기 결과를 보존하고 새 `reviews/<reviewId>/`에 파생 결과를 만들어요.

### CI 신뢰 경계

필수 계획과 승인 판정 코드까지 후보 PR의 변경본만으로 실행하면, PR이 검사 삭제·정책 완화와 성공 출력을 함께 만들 수 있어요. 필수 gate의 집계기·정책 출처는 보호된 revision으로 고정해요. 후보 코드는 테스트 대상이고, artifact의 해시는 출처 기록의 일부이며 그 자체가 신뢰 증명은 아니에요.

권한 있는 집계 job에서는 후보의 config·provider·스크립트를 실행하지 않고 선언형 결과만 읽어요. 외부 PR의 코드 실행에 비밀 값을 넘기지 않는다는 원칙을 유지해요. GitHub도 권한 있는 `pull_request_target`·`workflow_run`과 신뢰하지 않는 코드를 함께 실행하는 위험을 설명해요. [GitHub 보안 지침](https://docs.github.com/en/actions/reference/security/secure-use)

현재 공개 Retina workflow를 호출할 때도 소비 조직의 Actions 허용 정책을 확인해야 해요. 재사용 workflow가 있다는 사실만으로 다른 조직에서 실행된다고 완료 처리하지 않아요. [GitHub 재사용 workflow 접근 규칙](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)

## 6. 기준 이미지와 승인 단위

baseline 키는 `scenarioId + checkpointId + profileId + environmentFingerprint`예요. fingerprint는 버전 있는 구조로 저장하고, 플랫폼·OS/runtime·렌더러·폰트·논리 크기·물리 크기·DPR/density·언어·테마를 포함해요. 플랫폼별 필수 항목이 없으면 비교 가능한 것으로 보지 않아요.

JSON 해시는 UTF-8과 고정된 키 정렬 규칙으로 계산해요. 집합인 ID 목록은 정렬하고, 실행 순서를 뜻하는 배열은 순서를 보존해요. 원본 PNG의 바이트 해시와 비교용 RGBA·정렬 결과는 구분하고, 변환 내역도 정책 해시에 포함해요.

보호 경로 변경이 없으면 기존 승인 revision의 baseline·정책·필수 목록을 사용해요. 앱 코드의 head SHA가 바뀌었다는 이유만으로 기존 기준을 재승인받지는 않아요. 보호 경로가 바뀌면 정확한 후보 head·해시의 승인을 확인한 뒤, 승인된 후보 목록·정책·baseline을 새 run의 계획에 고정해요. 검토자 자격과 집계 코드는 계속 보호된 revision에서 가져와요. 후보 설정의 선언형 manifest는 비권한 단계에서 만들고, 권한 있는 집계 단계에서는 후보 코드를 실행하지 않아요.

보호 경로를 바꾼 PR의 승인 대상은 **후보 head SHA + baseline manifest 해시 + 정책 해시 + 필수 목록 해시**로 묶어요. 이미지가 같아도 마스크·임계값·필수 목록이 바뀌면 다시 검토해요. 승인자 자격은 후보가 수정한 CODEOWNERS로 스스로 부여할 수 없어요. GitHub의 PR 검토 요청도 base branch의 CODEOWNERS를 사용해요. [CODEOWNERS 기준](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

| 상황 | 처리 |
| --- | --- |
| 유효한 승인 증거가 없어요. | `REVIEW_REQUIRED`, 종료 코드 `3`이에요. |
| 승인 조회 API가 실패하거나 검토자 자격을 확인할 수 없어요. | `INCONCLUSIVE`, 실행 오류로 종료 코드 `2`예요. |
| 승인 후 head·정책·baseline이 바뀌었어요. | 이전 승인을 적용하지 않고 새 승인을 요구해요. |
| 승인을 얻었어요. | 승인 기준을 반영한 새 전체 run으로 검사해요. 과거 실패 run은 그대로 둬요. |

최초 기준은 별도 bootstrap 결과로 남겨요. 기준 생성 자체를 프로젝트 유효성 통과로 보지 않아요. 로컬 사용자 수락과 Figma 참조는 baseline 승인 증거가 아니에요. 지정 검토자 확인·승인 취소·보호 규칙의 실제 연동은 G-C5의 시험 PR에서 검증하고, 이 연결 전에는 PR 필수 gate 지원을 완료로 표시하지 않아요.

## 7. 디자인 비교의 수치와 유효성

Figma 파일 버전, node ID, 내보내기 옵션, 수신 PNG 해시와 node 데이터 해시를 같은 참조 묶음으로 저장해요. 파일 메타데이터와 이미지 요청의 버전을 맞추고, 반환 이미지가 없는 node는 실패로 처리해요. 내려받기 URL 대신 실제 바이트를 캐시에 보관해 만료된 URL에 실행을 의존시키지 않아요. [Figma 파일·이미지 API](https://developers.figma.com/docs/rest-api/file-endpoints/)

다음 순서로 유효성을 확인해요: 참조·매핑 버전 → fixture 스키마 → 콘텐츠 일치 → 좌표·크기 정렬 → 마스크 → 픽셀 비교 → 상태 판정. 앞 단계가 미완료인데 높은 픽셀 일치율만으로 통과시키지 않아요.

- `comparedPixels`는 비교 영역에서 **마스크의 합집합**을 제외한 픽셀 수예요. 겹친 마스크를 중복 차감하지 않아요.
- 비교 픽셀이 0이면 `nothing_compared`이고 일치율은 `null`이에요. 100%로 만들지 않아요.
- 크기가 다른 원시 이미지는 `size_mismatch`로 반환해요. 자르기·리샘플링이 필요하면 비교 전에 명시적인 변환 단계가 수행하고 기록해요.
- 원본과 비교 영역의 면적, 제외한 safe area, 마스크 면적·비율, 프레임 밖 영역을 같이 보여줘요. 잘라낸 오류가 높은 일치율에 가려지지 않게 해요.
- 픽셀 일치율은 `1 - mismatchedPixels / comparedPixels`예요. 내부 값으로 판정하고 화면 표시용 반올림 값으로 판정하지 않아요.
- 설정한 최소 일치율과 **같으면 충족**, 낮으면 `REVIEW_REQUIRED`예요. 필수 콘텐츠 불일치도 `REVIEW_REQUIRED`, 명시한 구조 규칙 위반은 `FAIL`이에요.
- 임계값이 없거나 명시적 리샘플링으로 신뢰가 낮아지면 자동 `PASS`를 내지 않아요. 비교 자체는 가능하면 `REVIEW_REQUIRED`, 좌표·증거를 확보하지 못하면 `INCONCLUSIVE`예요.

색 tolerance·마스크 한도·일치율 기본값은 측정 전까지 확정하지 않아요. 임의의 95% 같은 값으로 gate를 먼저 만들지 않아요. 요소 bounds 매칭과 Pairwise 확대는 기존 후속 범위에 남겨요.

## 8. 최소 계약 시험

| 시험 ID | 입력·조작 | 기대 결과 |
| --- | --- | --- |
| CT-01 | config에 없는 profile, 충돌한 CLI 필터를 전달해요. | provider 호출 0회, 실행 오류 `2`예요. |
| CT-02 | 같은 웹 플랫폼의 필수 profile 하나 또는 필수 체크 하나를 제거해요. | 전체 통과가 아니며 누락 키가 결과에 남아요. |
| CT-03 | assertion 실패와 provider 오류를 함께 넣고 입력 순서를 바꿔요. | 항상 대표 `FAIL`, 종료 코드 `2`, 원인 두 개예요. |
| CT-04 | fixture setup 일부 성공 후 오류·취소·restore 실패를 각각 넣어요. | 미준비 검사는 실행하지 않고, 소유 자원 정리·복구 사유를 남겨요. |
| CT-05 | 다른 run·attempt·plan의 결과, 중복 케이스, 잘린 JSON을 넣어요. | 조용히 채택하지 않고 집계 오류 `2`예요. |
| CT-06 | job 하나 취소, 필수 이미지 유실·변조, HTML 생성 실패를 각각 넣어요. | 비성공 종료와 누락·실패 이유가 남아요. |
| CT-07 | 결과 묶음을 다른 폴더로 옮겨 오프라인·JavaScript 비활성 상태로 열어요. | 판정·건수·이미지가 보이고 JSON과 같아요. 외부 요청은 0건이에요. |
| CT-08 | 승인 뒤 이미지 대신 마스크·필수 목록만 바꿔요. | 기존 승인이 무효이며 새 승인과 새 run이 필요해요. |
| CT-09 | 디자인 마스크를 전부 채우거나 겹치게 넣어요. | 분모 0은 미완료이고, 겹친 면적은 한 번만 제외해요. |
| CT-10 | 같은 이미지에 낮은 신뢰 변환을 붙이거나 임계값을 제거해요. | 높은 일치율이어도 자동 `PASS`가 아니에요. |

각 시험은 입력 fixture, 명령, 실제 종료 코드, run·plan·commit 식별자와 결과 파일을 남겨요. 도메인 단위 시험, 실제 CLI 시험, CI 시험, 실제 화면 확인은 별도 증거로 기록해요.
