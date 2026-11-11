# 소개 사이트 배포 (charts.leeeo.app)

- 대상: leeeo 개인 VM의 정적 nginx. 다른 leeeo 정적 앱(size·country)과 같은 방식이다.
- 컨테이너 `leeeo-charts-web`, 공용 패치 이미지 `leeeo-nginx-base:20261111`, loopback `127.0.0.1:8818` → nginx 80.
- 공개 경로: Cloudflare Tunnel → 방문자 관문(visitors) → 이 컨테이너. 터널 규칙과 DNS 레코드는 `charts.leeeo.app` 하나만 추가한다.
- 설정 원본: 이 폴더의 `compose.yaml`, `nginx.conf`. 서버 주소·터널 식별값·비밀값은 이 저장소에 적지 않는다.

## 릴리스

1. `npm ci && npm run site`로 `site/dist`를 만든다. 올리는 것은 `site/dist`의 파일뿐이다.
2. 파일별 SHA-256 목록과 함께 서버의 `releases/<날짜>-<커밋>/html`에 풀고, 목록 대조가 통과해야 다음으로 간다.
3. 배포 루트의 `html` 링크를 새 릴리스로 바꾸고 `docker compose up -d --force-recreate`로 다시 만든다.
   Docker bind mount는 링크만 바꿔서는 새 대상을 따라가지 않는다.
4. 공개 주소에서 응답 헤더·CSP·없는 경로 404·POST 405와 390·1440 밝게·어둡게 콘솔 오류 0을 확인한다.

## CSP

`style-src-attr 'unsafe-inline'`만 허용한다. 렌더러가 색을 지정한 시리즈의 색(`style="--c:..."`)을
style 속성으로 쓰기 때문이다(0.8.0부터 도넛 가운데 글자 크기는 style 속성을 쓰지 않는다). 색 값은 검증기가 `#hex`, `var(--토큰)`, 색 이름만 받고, 글자는 모두 이스케이프한다.
`<style>` 블록과 인라인 스크립트는 계속 막는다.

## 롤백

- 이전 릴리스로: `html` 링크를 이전 `releases/...`로 바꾸고 컨테이너를 다시 만든다.
- 공개 중단: 터널 설정에서 `charts.leeeo.app` 규칙만 지우고 `ingress validate` 후 터널을 재시작한다. 방문자 관문의
  `hosts.json`·`hosts.conf`에서 같은 호스트 한 줄만 지운다. Cloudflare DNS에서 `charts` 레코드만 지운다.
  다른 호스트나 터널 자체는 건드리지 않는다. 마지막으로 `docker compose down`.
- 공유 파일 전체를 백업으로 되돌리는 것은 그 뒤 다른 변경이 없을 때만 한다.
