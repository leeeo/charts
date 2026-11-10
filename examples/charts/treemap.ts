import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'treemap',
    heading: '앱별 · 채널별 월 매출',
    note: '사각형 넓이가 매출에 비례합니다. 상상플레이 광고 매출은 아직 정산 전이라 결측으로 표시됩니다.',
    wide: true,
    spec: {
      type: 'treemap',
      title: '10월 매출 구성',
      description: '앱(그룹)과 매출 채널별 금액',
      unit: { label: '원', suffix: '원' },
      items: [
        { id: 'schedule', label: 'leeeo 일정', children: [
          { id: 'sch-sub', label: '구독', value: 1840000 },
          { id: 'sch-iap', label: '인앱 결제', value: 620000 },
          { id: 'sch-ad', label: '광고', value: 210000 },
        ] },
        { id: 'trading', label: 'leeeo 트레이딩', children: [
          { id: 'trd-sub', label: '구독', value: 1320000 },
          { id: 'trd-pro', label: '프로 플랜', value: 480000 },
        ] },
        { id: 'play', label: '상상플레이', quality: '베타', children: [
          { id: 'play-iap', label: '인앱 결제', value: 390000 },
          { id: 'play-ad', label: '광고', value: null },
        ] },
        { id: 'etc', label: '기타 수익', value: 95000 },
      ],
    },
  },
];
