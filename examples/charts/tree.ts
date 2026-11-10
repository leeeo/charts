import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'tree',
    heading: '월간 활성 사용자 분해',
    note: '전체 활성 사용자를 앱과 플랫폼으로 나눈 계층입니다. 상상플레이 iOS는 아직 집계 전이라 결측입니다.',
    wide: true,
    spec: {
      type: 'tree',
      title: '10월 월간 활성 사용자',
      description: '전체 › 앱 › 플랫폼',
      unit: { label: '명', suffix: '명' },
      root: { id: 'all', label: '전체', value: 18420, children: [
        { id: 'schedule', label: 'leeeo 일정', value: 11300, children: [
          { id: 'sch-and', label: 'Android', value: 6900 },
          { id: 'sch-ios', label: 'iOS', value: 3800 },
          { id: 'sch-web', label: '웹', value: 600 },
        ] },
        { id: 'trading', label: 'leeeo 트레이딩', value: 5940, children: [
          { id: 'trd-and', label: 'Android', value: 3420 },
          { id: 'trd-ios', label: 'iOS', value: 2520 },
        ] },
        { id: 'play', label: '상상플레이', value: 1180, quality: '베타', children: [
          { id: 'play-and', label: 'Android', value: 1180 },
          { id: 'play-ios', label: 'iOS', value: null },
        ] },
      ] },
    },
  },
];
