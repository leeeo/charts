import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'stream', heading: '스트림 그래프 (유입 경로별 방문자)', note: '주간 방문자를 유입 경로별로 쌓아 가운데 기준선 둘레로 흐르게 그립니다.', wide: true, spec: {
    type: 'stream', title: '유입 경로별 주간 방문자', unit: { suffix: '명' },
    labels: ['1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주'],
    series: [
      { id: 'search', name: '검색', values: [1200, 1350, 1280, 1500, 1620, 1580, 1710, 1800] },
      { id: 'sns', name: 'SNS', values: [400, 520, 900, 1400, 1100, 800, 650, 600] },
      { id: 'direct', name: '직접 방문', values: [800, 820, 860, 880, 910, 950, 990, 1020] },
      { id: 'ads', name: '광고', values: [0, 0, 300, 650, null, 700, 500, 200], quality: '5주 집계 누락' },
    ] } },
];
