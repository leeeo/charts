import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'beeswarm',
  heading: 'API 응답 시간과 SLO',
  note: '점 하나가 요청 표본 하나입니다. 점선은 SLO 300ms이며 넘은 표본은 진하게 표시됩니다.',
  spec: {
    type: 'beeswarm',
    title: '엔드포인트별 응답 시간 (어제 표본)',
    unit: { suffix: 'ms', label: 'ms' },
    xLabel: '응답 시간',
    threshold: { value: 300, label: 'SLO' },
    groups: [
      { id: 'login', label: '로그인', values: [88, 95, 102, 110, 112, 118, 120, 125, 131, 140, 142, 150, 158, 166, 171, 185, 192, 210, 245, 320] },
      { id: 'feed', label: '피드', values: [140, 152, 160, 171, 176, 182, 190, 198, 205, 214, 220, 236, 248, 255, 270, 288, 301, 315, 342, 410, null] },
      { id: 'pay', label: '결제', values: [180, 196, 205, 221, 230, 242, 251, 263, 270, 284, 295, 299, 306, 330, 365], quality: '외부 PG 포함' },
    ],
  },
}];
