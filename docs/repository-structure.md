# 저장소 구조

Bun 워크스페이스로 구성해요. 패키지는 설치할 의존성의 무게를 기준으로 세 개로 나눴어요. 웹만 쓰는 프로젝트는 Appium을, 앱만 쓰는 프로젝트는 Playwright를 설치하지 않게 하려는 거예요. 더 나누는 것은 실제 구현에서 필요가 확인된 뒤에 해요. 결정 배경은 [검증 계획서](visual-regression-skill-plan.md) 6장에 있어요.

현재 `packages/`는 빈 진입 파일만 있고 실행 코드는 없어요. `examples/`는 Retina API 없이 동작하는 예제 앱이에요.

```text
retina/
├── AGENTS.md
├── README.md
├── package.json            # Bun 워크스페이스(packages/*, examples/*)
├── bunfig.toml             # hoisted linker(Expo 네이티브 모듈 중복 방지)
├── tsconfig.base.json
├── vitest.config.ts
├── packages/
│   ├── retina/             # 코어 + CLI
│   │   └── src/
│   │       ├── cli/
│   │       ├── config/
│   │       ├── domain/{run,verdict,compare,design-data,review}/
│   │       └── infrastructure/{figma,mock-server,storage,report}/
│   ├── adapter-web/        # Playwright 번들 Chromium(headless)
│   └── adapter-native/     # Appium + WebdriverIO, src/{shared,ios,android}
├── skills/retina/          # 에이전트 스킬 지침
├── actions/                # composite GitHub Actions
├── .github/workflows/      # 소비 저장소가 호출하는 reusable workflow
├── examples/
│   ├── shared/             # 예제 공용 검증 규칙·API 클라이언트
│   ├── api/                # 예제 API(node:http, 메모리 저장소)
│   ├── web/                # Vite + React 예제
│   └── expo/               # Expo 예제
└── docs/
```

## 폴더별 역할

| 경로 | 역할 |
| --- | --- |
| `packages/retina/src/cli/` | 로컬·CI 명령 진입점(`retina run`, `review`, `finalize`, `report --open`)과 종료 코드 처리 |
| `packages/retina/src/config/` | 공개 API: `defineConfig`, 설정 스키마, provider 인터페이스 |
| `packages/retina/src/domain/` | 실행 계획, 판정·집계, 이미지 비교·일치율, 디자인 데이터 매핑, 검토 병합. 프레임워크 import 없음 |
| `packages/retina/src/infrastructure/` | Figma API 클라이언트, mock 서버, `.retina/` 파일 저장, 정적 HTML 리포트 렌더링 |
| `packages/adapter-web/` | 웹 촬영·조작 어댑터 |
| `packages/adapter-native/` | iOS Simulator·Android Emulator 어댑터, 기기 고정, 메모리 가드 |
| `skills/retina/` | 에이전트가 두 검증 모드를 고르고 결과를 해석하는 지침. 실행 엔진을 복제하지 않아요 |
| `actions/`, `.github/workflows/` | 소비 저장소가 호출하는 CI 자산 |
| `examples/` | 특정 도메인과 무관한 예제. Retina가 특정 프로젝트에 묶이지 않았는지 확인하는 데 써요 |
| `docs/` | 설계, 구현 계획, 검토 기록 |

## 소비 저장소에 두는 것

시나리오, 설정, 기준 이미지는 Retina 저장소가 아니라 Retina를 쓰는 저장소에 둬요.

```text
retina.config.ts
retina/{scenarios,design-fixtures,hooks}/
.retina/baselines/   # 커밋
.retina/reviews/     # 커밋
.retina/runs/        # Git 제외
```
