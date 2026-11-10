import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'histogram',
  heading: '첫 구매까지 걸린 일수',
  note: '설치 후 첫 결제까지의 일수를 7일 단위로 묶었습니다. 기록이 없는 사용자는 결측으로 따로 셉니다.',
  spec: {
    type: 'histogram',
    title: '설치 후 첫 구매까지 걸린 일수',
    unit: { suffix: '일', label: '일' },
    xLabel: '설치 후 경과 일수',
    yLabel: '사용자 수',
    binWidth: 7,
    binStart: 0,
    values: [
      0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 6, 8, 9, 9, 10, 11, 12, 13, 13, 15, 16, 18, 20, 21, 23, 25, 27, 29, 33, 36, 41, 47, 52, 58,
      null, null, null,
    ],
  },
}];
