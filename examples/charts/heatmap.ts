import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'heatmap',
  heading: '설치 주차별 리텐션',
  note: '코호트(설치 주)별 N주차 재방문율입니다. 아직 지나지 않은 주차는 데이터 없음으로 표시합니다.',
  spec: {
    type: 'heatmap',
    title: '상상플레이 주간 코호트 리텐션',
    unit: { suffix: '%', label: '%' },
    xLabel: '설치 후 주차',
    yLabel: '설치 주',
    showValues: true,
    min: 0,
    max: 100,
    rows: ['10월 1주', '10월 2주', '10월 3주', '10월 4주', '11월 1주'],
    columns: ['0주', '1주', '2주', '3주', '4주'],
    values: [
      [100, 42, 31, 26, 22],
      [100, 45, 33, 27, null],
      [100, 39, 29, null, null],
      [100, 48, null, null, null],
      [100, null, null, null, null],
    ],
  },
}];
