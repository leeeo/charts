import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'waterfall', heading: '폭포 차트 (10월 → 11월 매출 변화)', note: '시작 매출에서 항목별 증감을 쌓아 최종 매출에 이릅니다. 집계되지 않은 항목은 결측으로 표시하고 합계에서 제외합니다.', wide: true, spec: {
    type: 'waterfall', title: '월 매출 변화 요인', unit: { label: '만원', suffix: '만원' }, startLabel: '10월 매출', start: 1240,
    steps: [
      { id: 'sub', label: '신규 구독', value: 310 },
      { id: 'iap', label: '인앱 결제', value: 145 },
      { id: 'churn', label: '구독 해지', value: -220 },
      { id: 'refund', label: '환불', value: -48 },
      { id: 'mid', label: '중간 합계', kind: 'subtotal' },
      { id: 'ads', label: '광고 수익', value: null, quality: '정산 지연' },
      { id: 'promo', label: '프로모션 할인', value: -95 },
      { id: 'end', label: '11월 매출', kind: 'total' },
    ] } },
];
