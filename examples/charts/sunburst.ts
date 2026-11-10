import type { Example } from '../types.ts';

export const examples: Example[] = [
  {
    id: 'sunburst',
    heading: '설치 경로 구성',
    note: '안쪽 고리가 앱, 바깥으로 갈수록 플랫폼·유입 채널입니다. 상상플레이 iOS 검색 유입은 집계 전이라 결측입니다.',
    spec: {
      type: 'sunburst',
      title: '10월 신규 설치',
      description: '앱 › 플랫폼 › 유입 채널',
      unit: { label: '건', suffix: '건' },
      centerLabel: '전체 설치',
      items: [
        { id: 'schedule', label: 'leeeo 일정', children: [
          { id: 'sch-and', label: 'Android', children: [
            { id: 'sch-and-search', label: '스토어 검색', value: 1840 },
            { id: 'sch-and-ref', label: '추천', value: 620 },
          ] },
          { id: 'sch-ios', label: 'iOS', children: [
            { id: 'sch-ios-search', label: '스토어 검색', value: 1310 },
            { id: 'sch-ios-web', label: '웹 링크', value: 280 },
          ] },
        ] },
        { id: 'trading', label: 'leeeo 트레이딩', children: [
          { id: 'trd-and', label: 'Android', value: 760 },
          { id: 'trd-ios', label: 'iOS', value: 540 },
        ] },
        { id: 'play', label: '상상플레이', quality: '베타', children: [
          { id: 'play-and', label: 'Android', children: [
            { id: 'play-and-test', label: '테스트 초대', value: 410 },
          ] },
          { id: 'play-ios', label: 'iOS', children: [
            { id: 'play-ios-search', label: '스토어 검색', value: null },
          ] },
        ] },
      ],
    },
  },
];
