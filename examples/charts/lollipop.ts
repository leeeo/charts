import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'lollipop', heading: '롤리팝 차트 (앱별 주간 방문자)', note: '방문자가 많은 순으로 정렬했습니다. 집계가 없는 앱은 0이 아닌 결측으로 표시됩니다.', spec: {
    type: 'lollipop', title: '앱별 주간 방문자', unit: { label: '명', suffix: '명' }, name: '방문자', sort: 'desc', horizontal: true,
    items: [
      { id: 'sang', label: '상상플레이', value: 12840 },
      { id: 'wiki', label: '스톡위키', value: 9310 },
      { id: 'lesson', label: '레슨', value: 4120, quality: '추정치' },
      { id: 'earn', label: '어닝스', value: 2750 },
      { id: 'status', label: '상태 페이지', value: 860 },
      { id: 'new', label: '신규 앱', value: null },
    ] } },
  { id: 'lollipop-change', heading: '롤리팝 차트 (월별 순설치 증감)', note: '0선에서 위아래로 뻗는 막대로 증가와 감소를 함께 보여줍니다.', spec: {
    type: 'lollipop', title: '상상플레이 월별 순설치 증감', unit: { label: '건', suffix: '건' }, name: '순설치',
    items: [
      { id: 'm5', label: '5월', value: 320 }, { id: 'm6', label: '6월', value: 410 }, { id: 'm7', label: '7월', value: -120 },
      { id: 'm8', label: '8월', value: 90 }, { id: 'm9', label: '9월', value: null }, { id: 'm10', label: '10월', value: 260 },
    ] } },
];
