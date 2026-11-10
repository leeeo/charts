# Notice

## Reference for scope only

No code from ztd-charts (MIT, github.com/Junhan2/ztd-charts) is copied. Its public README and public docs
(charts.ztd.app/docs) informed the feature scope only: JSON spec, keyboard and screen-reader support, and the list of chart
types to cover. Every renderer, layout and validator here is an independent implementation. If a snippet is ever reused,
add its MIT copyright notice here.

## Map boundary data

`src/geo/kr-sido.ts` (used by the `map` chart type) is derived from:

- 통계청 SGIS 행정구역 경계 (2026.10.01), 공공누리 제1유형 (출처표시)
- processed by github.com/vuski/admdongkor, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- taken from the leeeo-atlas project's `svg/01_전국/전국_시도_17개.svg` (code MIT, data under the licences above)

Changes: simplified (Douglas-Peucker, about 1.5 px at 1200 px width), small rings dropped except Ulleungdo, coordinates
rounded and translated. 독도 is not part of the source boundary; it is added as a small location marker. The map chart
prints the attribution line "통계청 SGIS 행정구역 경계(2026.10.01), github.com/vuski/admdongkor (CC BY 4.0)" under every map.
Boundaries are simplified and are not suitable for survey or legal use.
