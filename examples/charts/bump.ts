import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'bump', heading: '순위 변동 차트 (월간 설치 순위)', note: '설치 수로 계산한 앱 순위의 월별 변화입니다. 집계가 없는 달은 선이 끊깁니다.', spec: {
    type: 'bump', title: '월간 설치 순위', unit: { suffix: '건' }, labels: ['6월', '7월', '8월', '9월', '10월'],
    series: [
      { id: 'sang', name: '상상플레이', values: [820, 940, 1210, 1180, 1350] },
      { id: 'wiki', name: '스톡위키', values: [1020, 990, 1050, 1240, 1190] },
      { id: 'lesson', name: '레슨', values: [610, 720, null, 830, 1220], quality: '8월 집계 누락' },
      { id: 'earn', name: '어닝스', values: [450, 760, 690, 640, 580] },
    ] } },
];
