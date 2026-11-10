import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'network',
  heading: '앱 간 사용자 이동',
  note: '한 달 동안 두 앱을 함께 쓴 사용자 수입니다. 선 두께가 공유 사용자 수, 점 크기가 연결 합계입니다. 집계가 끝나지 않은 연결은 점선입니다.',
  spec: {
    type: 'network',
    title: 'leeeo 앱 공동 사용자 (10월)',
    unit: { suffix: '명', label: '명' },
    nodes: [
      { id: 'play', label: '상상플레이', group: '게임' },
      { id: 'quiz', label: '퀴즈왕', group: '게임' },
      { id: 'puzzle', label: '퍼즐숲', group: '게임' },
      { id: 'note', label: '하루노트', group: '생산성' },
      { id: 'todo', label: '할일메이트', group: '생산성' },
      { id: 'budget', label: '가계부온', group: '금융' },
      { id: 'stock', label: '모의투자', group: '금융', quality: '베타' },
    ],
    links: [
      { source: 'play', target: 'quiz', value: 1840 },
      { source: 'play', target: 'puzzle', value: 1260 },
      { source: 'quiz', target: 'puzzle', value: 640 },
      { source: 'note', target: 'todo', value: 2210 },
      { source: 'note', target: 'budget', value: 480 },
      { source: 'todo', target: 'budget', value: 390 },
      { source: 'budget', target: 'stock', value: 920 },
      { source: 'play', target: 'note', value: 310 },
      { source: 'stock', target: 'todo', value: null },
    ],
  },
}];
