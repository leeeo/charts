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
    note: '예시 데이터입니다. tone으로 매출·이익·비용을 칠하고(비용은 빗금), computed 노드에 *를 붙입니다. 비용은 생긴 단계에서 아래로 빠지고, 이익은 오른쪽 끝까지 흐릅니다.',
    wide: true,
    spec: {
      type: 'sankey',
      title: '가상 회사 분기 손익 흐름 (예시)',
      unit: { label: '억원', suffix: '억' },
      relax: true,
      computedNote: '앞 단계에서 비용을 뺀 값',
      nodes: [
        { id: 'revenue', label: '매출', tone: 'revenue' },
        { id: 'gross', label: '매출총이익', tone: 'profit', computed: true },
        { id: 'cogs', label: '매출원가', tone: 'cost' },
        { id: 'op', label: '영업이익', tone: 'profit', computed: true },
        { id: 'sga', label: '판매관리비', tone: 'cost' },
        { id: 'net', label: '순이익', tone: 'profit', computed: true },
        { id: 'tax', label: '법인세 등', tone: 'cost' },
      ],
      links: [
        { source: 'revenue', target: 'gross', value: 420 },
        { source: 'revenue', target: 'cogs', value: 580 },
        { source: 'gross', target: 'op', value: 150 },
        { source: 'gross', target: 'sga', value: 270 },
        { source: 'op', target: 'net', value: 110 },
        { source: 'op', target: 'tax', value: 40 },
      ],
    },
  },
];
