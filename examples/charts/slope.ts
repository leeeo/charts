import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'slope', heading: '기울기 차트 (분기별 앱 매출 비교)', note: '두 시점 사이 앱별 매출 변화를 한눈에 비교합니다. 결측 항목은 선 없이 표시됩니다.', spec: {
    type: 'slope', title: '앱별 분기 매출', unit: { label: '만원', suffix: '만원' }, startLabel: '2026년 2분기', endLabel: '2026년 3분기',
    items: [
      { id: 'sang', label: '상상플레이', start: 420, end: 610 },
      { id: 'wiki', label: '스톡위키', start: 380, end: 355 },
      { id: 'lesson', label: '레슨', start: 150, end: 240, quality: '추정치' },
      { id: 'earn', label: '어닝스', start: 90, end: 130 },
      { id: 'new', label: '신규 앱', start: null, end: 45, quality: '3분기 출시' },
    ] } },
];
