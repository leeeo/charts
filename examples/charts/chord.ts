import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'chord',
  heading: '유입 경로 사이의 이동',
  note: '첫 방문 채널에서 두 번째 방문 채널로 옮겨 간 방문자 수입니다. 리본은 출발 채널 색이고 도착 쪽 끝이 뾰족합니다. 추적이 빠진 구간은 데이터 없음입니다.',
  spec: {
    type: 'chord',
    title: '첫 방문 → 재방문 채널 (11월 1주)',
    unit: { suffix: '명', label: '명' },
    groups: [
      { id: 'search', label: '검색' },
      { id: 'sns', label: 'SNS' },
      { id: 'direct', label: '직접 방문' },
      { id: 'store', label: '앱스토어' },
      { id: 'mail', label: '이메일', quality: '추정치' },
    ],
    matrix: [
      [820, 140, 360, 210, 40],
      [260, 540, 180, 330, null],
      [120, 60, 950, 90, 70],
      [80, 110, 240, 410, 20],
      [30, null, 150, 15, 120],
    ],
  },
}];
