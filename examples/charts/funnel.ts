import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'funnel', heading: '퍼널 차트: 방문에서 결제까지', note: '단계 사이 숫자는 이전 단계 대비 전환율입니다. 결측 단계 앞뒤의 전환율은 계산하지 않습니다.',
    spec: {
      type: 'funnel', title: '상상플레이 10월 전환 퍼널', unit: { suffix: '명' },
      stages: [
        { id: 'visit', label: '스토어 방문', value: 18400 },
        { id: 'install', label: '설치', value: 5230 },
        { id: 'signup', label: '가입', value: 3120 },
        { id: 'trial', label: '체험 시작', value: null },
        { id: 'pay', label: '첫 결제', value: 412 },
      ],
    },
  },
];
