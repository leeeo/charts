import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'marimekko', heading: '마리메코 차트 (앱별 · 유입 경로별 설치)', note: '열 너비는 앱의 전체 설치 비중, 칸 높이는 앱 안에서 유입 경로 비중입니다. 집계가 없는 칸은 0이 아닌 결측입니다.', wide: true, spec: {
    type: 'marimekko', title: '10월 앱별 설치 유입 경로', unit: { label: '건', suffix: '건' },
    labels: ['상상플레이', '스톡위키', '레슨', '어닝스'],
    series: [
      { id: 'store', name: '스토어 검색', values: [5200, 2100, 900, 640] },
      { id: 'ads', name: '광고', values: [3100, 800, 1200, null], quality: '일부 추정치' },
      { id: 'share', name: '공유 링크', values: [1400, 950, 300, 210] },
      { id: 'web', name: '웹사이트', values: [600, 1300, 180, 450] },
    ] } },
];
