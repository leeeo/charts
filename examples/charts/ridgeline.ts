import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'ridgeline',
  heading: '요일별 세션 길이 분포',
  note: '표본 세션의 커널 밀도입니다. 주말로 갈수록 긴 세션이 늘어납니다. 일요일 일부는 수집 누락입니다.',
  spec: {
    type: 'ridgeline',
    title: '상상플레이 요일별 세션 길이 (지난주 표본)',
    unit: { suffix: '분', label: '분' },
    xLabel: '세션 길이',
    xMin: 0,
    groups: [
      { id: 'mon', label: '월', values: [2.1, 3.4, 3.8, 4.0, 4.5, 5.1, 5.3, 6.0, 6.8, 7.2, 8.5, 12.0] },
      { id: 'wed', label: '수', values: [2.5, 3.0, 3.9, 4.4, 4.8, 5.5, 5.9, 6.4, 7.0, 7.7, 9.1, 13.4] },
      { id: 'fri', label: '금', values: [3.0, 4.2, 5.1, 5.8, 6.5, 7.0, 7.9, 8.6, 9.4, 10.8, 12.5, 16.0] },
      { id: 'sat', label: '토', values: [4.5, 6.0, 7.2, 8.8, 9.5, 10.4, 11.8, 12.6, 13.9, 15.2, 18.0, 22.5] },
      { id: 'sun', label: '일', values: [5.2, 6.8, 8.1, 9.9, 11.0, 12.3, 13.5, 14.1, 16.4, null, null, 24.0], quality: '일부 누락' },
    ],
  },
}];
