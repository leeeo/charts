import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'bubble', heading: '버블 차트 (광고 채널 효율)', note: '설치당 비용과 전환율을 축으로, 원 넓이를 매출에 비례시켜 채널을 비교합니다.', spec: {
    type: 'bubble', title: '광고 채널별 효율', unit: { suffix: '%' }, xUnit: { suffix: '원' }, sizeUnit: { suffix: '만원' },
    xLabel: '설치당 비용', yLabel: '구매 전환율', sizeLabel: '매출',
    series: [
      { id: 'search', name: '검색 광고', points: [
        { x: 1800, y: 6.2, size: 420, label: '키워드 A' }, { x: 2400, y: 7.9, size: 610, label: '키워드 B' }] },
      { id: 'sns', name: 'SNS 광고', points: [
        { x: 900, y: 2.1, size: 180, label: '피드' }, { x: 1300, y: 3.4, size: 260, label: '스토리' }, { x: 700, y: 1.6, size: null, label: '릴스', }] },
      { id: 'partner', name: '제휴', quality: '추정치', points: [
        { x: 3100, y: 9.5, size: 90, label: '블로그 제휴' }, { x: 2700, y: 5.0, size: 140, label: '커뮤니티' }] },
    ] } },
];
