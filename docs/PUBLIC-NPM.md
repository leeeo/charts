# 공개 npm 게시 준비

`@leeeo/charts`를 공개 npm(registry.npmjs.org)에 올리기 위한 준비 문서입니다. 이 브랜치는 준비만 합니다.
**대표가 npm 조직을 만들고 공개를 승인하기 전에는 아무것도 올라가지 않습니다.**

## 무엇이 준비됐나

| 항목 | 위치 | 상태 |
|---|---|---|
| 패키지 정보(저장소·홈페이지·이슈·키워드·`types`·`main`·`publishConfig.access`) | `package.json` | 준비 |
| `sideEffects: ["*.css"]` | `package.json` | `import '@leeeo/charts/styles.css'`가 번들러에서 지워지지 않게 함 (전에는 `false`) |
| 영어 README + 짧은 한국어 절 | `README.md` | 준비. 한국어 전체 안내는 `README.ko.md` |
| 게시 워크플로(provenance) | `.github/workflows/publish-npm.yml` | 꺼짐. 저장소 변수 `NPM_PUBLISH_ENABLED`가 `true`일 때만 동작 |
| 묶음에 내부 주소·비밀값 없음 | `npm pack --dry-run` | 확인함(작업 기록 참고) |

## 사설 레지스트리와 함께 쓰는 법 (추천)

npm은 레지스트리를 **scope 단위**로만 고릅니다. 지금 leeeo 앱과 개발 PC의 사용자 `.npmrc`는 `@leeeo` scope 전체를
사설 레지스트리로 보냅니다. 같은 scope의 일부만 공개 npm으로 보내는 설정은 npm에 없습니다.

추천은 **사설 레지스트리가 `@leeeo/charts` 하나만 공개 npm에서 받아 오게(프록시) 하는 것**입니다.

```yaml
# 사설 레지스트리(Verdaccio) 설정 예시. 실제 주소·계정은 저장소에 적지 않는다.
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@leeeo/charts':          # 구체적인 이름을 먼저 둔다
    access: $all
    publish: $authenticated
    proxy: npmjs
  '@leeeo/*':               # 나머지 공통 패키지는 사설 전용. 공개 npm으로 새지 않는다
    access: $authenticated
    publish: $authenticated
```

- 앱 쪽 `.npmrc`는 바꾸지 않아도 됩니다. 사설 레지스트리에 없는 버전은 공개 npm에서 받아 옵니다.
- 공개 게시를 시작한 뒤에는 charts를 사설 레지스트리에 따로 `npm publish`하지 않습니다. 같은 버전이 두 곳에 다른 묶음으로
  있으면 lockfile의 integrity가 어긋날 수 있습니다. 원본은 공개 npm 하나로 둡니다.
- 바깥 사용자는 설정 없이 `npm install @leeeo/charts`를 씁니다.
- 덤: npm에 `leeeo` 조직이 생기면 다른 사람이 `@leeeo/auth` 같은 이름을 공개 npm에 먼저 올릴 수 없습니다(의존성 혼동 공격 예방).

다른 방법(공개 전용 scope를 새로 만들기, 앱마다 `.npmrc`를 바꾸기)은 이름이 갈리거나 앱 수만큼 설정이 늘어서 추천하지 않습니다.

## 대표만 할 수 있는 일

1. npmjs.com 계정 만들기(브랜드 메일, 실명 없이)와 **2단계 인증(쓰기에도 요구)** 켜기.
2. npm 조직 `leeeo` 만들기(무료, 공개 패키지). 이름이 이미 있으면 알려 주세요.
3. 공개 문안 승인: `README.md`(영어)·`package.json`의 설명·키워드.
4. GitHub 저장소 설정:
   - Environment `npm` 만들기. 필요하면 승인자로 대표를 지정합니다(게시 전에 한 번 더 누르게 됨).
   - 첫 게시용 npm 토큰(granular, `@leeeo/charts` 쓰기만)을 Environment 비밀값 `NPM_TOKEN`에 넣기. 값은 Bitwarden에도 둡니다.
   - 저장소 변수 `NPM_PUBLISH_ENABLED` = `true`.
5. 첫 게시 뒤 npm 패키지 설정에서 **신뢰 게시자(Trusted Publisher)**를 GitHub Actions `leeeo/charts`
   · `publish-npm.yml` · environment `npm`으로 등록하고 토큰을 지웁니다(npm은 패키지가 있어야 이 설정을 받습니다).
6. 이 브랜치를 main에 합치는 것을 승인. 그 뒤 GitHub 릴리스 `v<버전>`을 만들면 워크플로가 게시합니다.

## 게시 뒤 확인

- `npm view @leeeo/charts version --registry https://registry.npmjs.org`가 그 버전인지.
- npmjs.com 패키지 화면에 provenance(빌드 출처) 표시가 있는지.
- 사설 레지스트리 프록시 설정 뒤 앱에서 `npm view @leeeo/charts version`이 같은 버전인지.
