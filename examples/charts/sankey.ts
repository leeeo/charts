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
  {
    id: 'sankey-income',
    heading: '매출에서 순이익까지 (의미 색)',
    note: '예시 데이터입니다. tone으로 매출·이익·비용을 칠하고(비용은 빗금), computed 노드에 *를 붙입니다. align: justify와 relax로 띠가 교차하지 않게 놓습니다.',
    wide: true,
    spec: {
      type: 'sankey',
      title: '가상 회사 분기 손익 흐름 (예시)',
      unit: { label: '억원', decimals: 2 },
      align: 'justify',
      relax: true,
      computedNote: '두 수치의 차액',
      nodes: [
        { id: 'revenue', label: '매출', tone: 'revenue' },
        { id: 'gain', label: '세후 순증가', tone: 'profit', computed: true },
        { id: 'loss', label: '순손실', tone: 'cost' },
        { id: 'op', label: '영업이익', tone: 'profit' },
        { id: 'costs', label: '영업비용', tone: 'cost', computed: true },
        { id: 'nonop', label: '영업외 순감소', tone: 'cost', computed: true },
      ],
      links: [
        { source: 'revenue', target: 'costs', value: 900, tone: 'cost' },
        { source: 'revenue', target: 'op', value: 100, tone: 'profit' },
        { source: 'op', target: 'nonop', value: 100 },
        { source: 'gain', target: 'nonop', value: 40 },
        { source: 'loss', target: 'nonop', value: 110 },
      ],
    },
  },
];
