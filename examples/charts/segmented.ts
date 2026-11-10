import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'segmented', heading: '구성 막대: 매출 구성', note: '하나의 100% 막대로 비율을 짧게 보여 줍니다. 결측 항목은 막대에서 빠집니다.',
    spec: {
      type: 'segmented', title: '10월 매출 구성', unit: { suffix: '원' },
      items: [
        { id: 'sub', label: '구독', value: 1840000 },
        { id: 'iap', label: '인앱 구매', value: 620000 },
        { id: 'ad', label: '광고', value: 310000, quality: '잠정' },
        { id: 'etc', label: '기타', value: null },
      ],
    },
    wide: true,
  },
];
