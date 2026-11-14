import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'dumbbell', heading: '덤벨 차트 (앱별 7일 리텐션, 1분기 → 3분기)', note: '두 시점의 값을 선으로 연결해 변화 폭을 비교합니다. 변화가 큰 순으로 정렬했습니다.', spec: {
    type: 'dumbbell', title: '앱별 7일 리텐션', unit: { label: '%', suffix: '%', decimals: 1 }, startLabel: '2026년 1분기', endLabel: '2026년 3분기', sort: 'change',
    items: [
      { id: 'sang', label: '상상플레이', start: 21.4, end: 28.9 },
      { id: 'wiki', label: '스톡위키', start: 33.0, end: 31.2 },
      { id: 'lesson', label: '레슨', start: 18.5, end: 24.1, quality: '표본 적음' },
      { id: 'earn', label: '어닝스', start: 26.7, end: 27.5 },
      { id: 'new', label: '신규 앱', start: null, end: 15.8, quality: '3분기 출시' },
    ] } },
];
