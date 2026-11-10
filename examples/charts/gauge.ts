import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'gauge', heading: '게이지: 월 매출 목표 달성', note: '회색 구간은 기준선, 굵은 눈금은 목표입니다.',
    spec: {
      type: 'gauge', title: '11월 매출 진행', unit: { suffix: '만원' }, label: '11월 누적 매출',
      value: 212, max: 400, target: 300, quality: '잠정',
      bands: [{ to: 150, label: '부진' }, { to: 300, label: '보통' }, { to: 400, label: '초과' }],
    },
  },
  {
    id: 'gauge-retention', heading: '게이지: 7일 리텐션', note: '0~100% 범위에 목표선을 함께 표시합니다.',
    spec: { type: 'gauge', title: '상상플레이 7일 리텐션', unit: { suffix: '%', decimals: 1 }, label: '10월 코호트', value: 31.4, max: 100, target: 35 },
  },
];
