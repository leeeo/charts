import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'parallel',
  heading: '앱별 핵심 지표 평행 좌표',
  note: '축마다 자체 범위를 가집니다. 웹의 설치 수는 해당 없음이라 선이 끊깁니다.',
  wide: true,
  spec: {
    type: 'parallel',
    title: '앱별 10월 핵심 지표',
    dimensions: [
      { id: 'visits', label: '방문자', unit: { suffix: '명' } },
      { id: 'installs', label: '설치', unit: { suffix: '건' } },
      { id: 'd7', label: 'D7 리텐션', unit: { suffix: '%', decimals: 1 }, min: 0 },
      { id: 'revenue', label: '매출', unit: { suffix: '만원' } },
      { id: 'rating', label: '평점', unit: { decimals: 1 }, min: 1, max: 5 },
    ],
    items: [
      { id: 'sangsang', label: '상상플레이', values: [18400, 2310, 31.5, 412, 4.6] },
      { id: 'trading', label: '트레이딩', values: [6200, 640, 44.2, 958, 4.2] },
      { id: 'schedule', label: '일정', values: [9800, 1480, 27.9, 120, 4.4] },
      { id: 'web', label: '웹', values: [25100, null, 12.4, 230, null], quality: '설치·평점 해당 없음' },
    ],
  },
}];
