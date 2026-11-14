# 릴리스 규칙

대표 지시(2026-11-13): "charts 고도화하면 npm도 계속 반영하고 토대로 네이버 블로그 초안도 작성해".
**고도화 한 번 = 아래 다섯 가지를 모두 한 번에.** 라이브러리가 그대로이고 소개 사이트만 바뀐 경우도 같다(0.8.2가 그 예).

1. **버전 올리기** — `npm version <x.y.z> --no-git-tag-version`. 0.x 동안 새 기능·눈에 보이는 변화는 patch 이상,
   스펙이나 출력이 바뀌면 minor. 소개 사이트 머리글의 버전 표기는 `package.json`에서 읽는다.
2. **CHANGELOG** — `CHANGELOG.md` 맨 위에 그 버전 절을 먼저 쓴다. 출력이 바뀌면 무엇이 바뀌고 무엇이 그대로인지
   (예: "430px 이상은 0.8.0과 바이트까지 같다")를 적는다.
3. **사설 레지스트리 게시** — `npm publish`. `prepublishOnly`가 타입 검사·테스트·빌드를 다시 돌린다. 끝나면
   `npm view @leeeo/charts version`과 `npm view @leeeo/charts@<버전> dist.integrity`를 확인해 작업 기록에 남긴다.
   레지스트리 주소와 토큰은 사용자 `~/.npmrc`에만 있고 이 저장소에는 적지 않는다.
4. **공개 npm** — npm 조직 `leeeo`가 생기고 대표가 공개를 승인한 뒤부터, 같은 버전을
   `.github/workflows/publish-npm.yml`(provenance 포함, 준비 브랜치 `chore/public-npm-prep-20261113`에 있고 승인 후
   main에 합친다)로 올린다. **그 전까지는 꺼 둔다.** 저장소 변수
   `NPM_PUBLISH_ENABLED`가 `true`가 아니면 워크플로가 아무것도 올리지 않는다.
5. **네이버 블로그 초안** — 그 회차 내용을 `leeeo-company/blog/WEEKLY-BLOG.md` 절차대로 초안으로 만든다
   (카테고리 바이브코딩, 임시저장까지만, 발행은 대표).

배포(소개 사이트)는 `deploy/DEPLOY.md`, 앱에 들여오는 방법은 `docs/INSTALL.md`를 따른다.
커밋·push는 신원 게이트(pre-push 훅)를 통과해야 한다.
