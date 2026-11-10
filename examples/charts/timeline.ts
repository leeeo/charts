import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'timeline',
    heading: '4분기 앱 출시 일정',
    note: '같은 레인에서 겹치는 작업은 아래 줄로 쌓입니다. 상상플레이 정식 출시일은 아직 미정이라 결측입니다.',
    wide: true,
    spec: {
      type: 'timeline',
      axis: 'date',
      title: '4분기 출시 로드맵',
      description: '앱별 개발·테스트·출시 구간 (종료일 포함)',
      items: [
        { id: 'sch-dev', lane: 'leeeo 일정', label: '위젯 개발', start: '2026-10-01', end: '2026-10-24' },
        { id: 'sch-qa', lane: 'leeeo 일정', label: 'QA', start: '2026-10-20', end: '2026-10-31' },
        { id: 'sch-rel', lane: 'leeeo 일정', label: '스토어 배포', start: '2026-11-03', end: '2026-11-07' },
        { id: 'trd-dev', lane: 'leeeo 트레이딩', label: '알림 개편', start: '2026-10-06', end: '2026-11-14' },
        { id: 'trd-paper', lane: 'leeeo 트레이딩', label: '모의투자 검증', start: '2026-11-10', end: '2026-12-12', quality: '추정치' },
        { id: 'play-beta', lane: '상상플레이', label: '비공개 테스트', start: '2026-10-13', end: '2026-11-21' },
        { id: 'play-launch', lane: '상상플레이', label: '정식 출시', start: '2026-12-01', end: null },
      ],
      milestones: [
        { id: 'ms-review', label: '분기 점검', at: '2026-11-10' },
        { id: 'ms-close', label: '연말 마감', at: '2026-12-19' },
      ],
    },
  },
];
