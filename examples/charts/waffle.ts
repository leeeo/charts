import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'waffle', heading: '와플 차트: 유입 경로 비율', note: '한 칸 = 1%. 집계가 빠진 경로는 칸 없이 "데이터 없음"으로 표시합니다.',
    spec: {
      type: 'waffle', title: '상상플레이 10월 신규 방문자 유입 경로', unit: { suffix: '명' },
      items: [
        { id: 'search', label: '검색', value: 4820 },
        { id: 'sns', label: 'SNS', value: 2310 },
        { id: 'direct', label: '직접 방문', value: 1640 },
        { id: 'ad', label: '광고', value: 910, quality: '추정치' },
        { id: 'partner', label: '제휴', value: null },
      ],
    },
  },
  {
    id: 'waffle-unit', heading: '와플 차트: 한 칸 = 100건', note: '칸 하나가 정해진 단위를 나타내면 행 수가 데이터에 맞게 늘어납니다.',
    spec: {
      type: 'waffle', title: '앱별 10월 설치 수', unit: { suffix: '건' }, cellValue: 100,
      items: [
        { id: 'play', label: '상상플레이', value: 3200 },
        { id: 'note', label: '리오노트', value: 1700 },
        { id: 'cal', label: '리오캘린더', value: 900 },
      ],
    },
  },
];
