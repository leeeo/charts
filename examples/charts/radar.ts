import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'radar',
  heading: '앱별 품질 점수 비교',
  note: '6개 품질 축을 0~100점 공통 척도로 비교합니다. 트레이딩의 접근성 점수는 아직 측정 전이라 빈 칸입니다.',
  spec: {
    type: 'radar',
    title: '앱 품질 점수 (11월 점검)',
    unit: { suffix: '점', label: '점' },
    max: 100,
    axes: ['성능', '안정성', '접근성', '리텐션', '설치 전환', '평점'],
    series: [
      { id: 'sangsang', name: '상상플레이', values: [82, 91, 74, 63, 58, 88] },
      { id: 'trading', name: '트레이딩', values: [76, 95, null, 71, 44, 80], quality: '접근성 미측정' },
      { id: 'schedule', name: '일정', values: [90, 87, 81, 55, 67, 84] },
    ],
  },
}];
