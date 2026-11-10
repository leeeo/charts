import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'bullet', heading: '불릿 차트: 이번 달 KPI', note: '막대는 실제 값, 세로 눈금은 목표, 배경 음영은 부진/보통 구간입니다. 목표 대비 %로 맞춰 한 축에 놓았습니다.',
    spec: {
      type: 'bullet', title: '11월 KPI 목표 대비 달성률', unit: { suffix: '%' }, max: 120,
      rows: [
        { id: 'visit', label: '방문자', value: 92, target: 100, ranges: [60, 90] },
        { id: 'install', label: '설치', value: 104, target: 100, ranges: [60, 90] },
        { id: 'revenue', label: '매출', value: 71, target: 100, ranges: [60, 90], quality: '잠정' },
        { id: 'retention', label: '7일 리텐션', value: null, target: 100, ranges: [60, 90] },
      ],
    },
    wide: true,
  },
];
