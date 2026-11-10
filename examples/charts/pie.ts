import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'pie', heading: '파이 차트', note: '비율이 한눈에 보여야 할 때. 미집계 항목은 원에서 빠지고 범례에 남습니다.', spec: {
    type: 'pie', title: '가입 경로', unit: { suffix: '명' }, slices: [
      { id: 'kakao', label: '카카오', value: 520 }, { id: 'google', label: '구글', value: 310 },
      { id: 'email', label: '이메일', value: 140 }, { id: 'etc', label: '기타', value: null, quality: '미집계' }] } },
];
