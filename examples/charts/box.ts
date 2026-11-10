import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'box',
  heading: '앱별 세션 길이 분포',
  note: '지난주 표본 세션의 분포입니다. 수염은 1.5 IQR, 점은 이상값이며 웹은 집계 요약값만 있습니다.',
  spec: {
    type: 'box',
    title: '앱별 세션 길이 (지난주 표본)',
    unit: { suffix: '분', label: '분' },
    yLabel: '세션 길이',
    groups: [
      { id: 'sangsang', label: '상상플레이', values: [3.2, 4.1, 5.0, 5.4, 6.2, 6.8, 7.1, 7.5, 8.0, 8.4, 9.1, 9.9, 10.5, 11.2, 12.0, 24.5, null] },
      { id: 'trading', label: '트레이딩', values: [1.1, 1.4, 1.9, 2.2, 2.5, 2.8, 3.0, 3.3, 3.9, 4.4, 5.1, 9.8, null, null] },
      { id: 'schedule', label: '일정', values: [0.8, 1.0, 1.2, 1.3, 1.5, 1.7, 1.9, 2.0, 2.4, 2.6, 3.1] },
      { id: 'web', label: '웹', summary: { min: 0.5, q1: 1.8, median: 3.4, q3: 5.6, max: 11.0 }, quality: '집계 요약' },
    ],
  },
}];
