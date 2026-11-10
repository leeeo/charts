import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'sankey',
    heading: '방문에서 구독까지의 흐름',
    note: '띠의 두께가 사용자 수에 비례합니다. 검색 → 체험 경로는 집계 누락으로 결측입니다.',
    wide: true,
    spec: {
      type: 'sankey',
      title: '10월 유입 경로별 전환 흐름',
      unit: { label: '명', suffix: '명' },
      nodes: [
        { id: 'search', label: '검색' },
        { id: 'sns', label: 'SNS' },
        { id: 'store', label: '스토어 추천' },
        { id: 'install', label: '설치' },
        { id: 'trial', label: '무료 체험' },
        { id: 'sub', label: '구독' },
        { id: 'churn', label: '이탈', quality: '추정치' },
      ],
      links: [
        { source: 'search', target: 'install', value: 4200 },
        { source: 'sns', target: 'install', value: 2600 },
        { source: 'store', target: 'install', value: 3100 },
        { source: 'search', target: 'trial', value: null },
        { source: 'install', target: 'trial', value: 5400 },
        { source: 'install', target: 'churn', value: 4500, quality: '추정치' },
        { source: 'trial', target: 'sub', value: 1250 },
        { source: 'trial', target: 'churn', value: 4150, quality: '추정치' },
      ],
    },
  },
];
