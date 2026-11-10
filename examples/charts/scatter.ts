import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'scatter', heading: '산점도 (세션 시간과 7일 리텐션)', note: '사용자 코호트별 평균 세션 시간과 7일 리텐션의 관계를 앱별 색으로 구분합니다.', spec: {
    type: 'scatter', title: '세션 시간 대비 7일 리텐션', unit: { suffix: '%' }, xUnit: { suffix: '분' },
    xLabel: '평균 세션 시간', yLabel: '7일 리텐션',
    series: [
      { id: 'sang', name: '상상플레이', points: [
        { x: 4.2, y: 18.5, label: '9월 1주' }, { x: 6.8, y: 24.1, label: '9월 2주' }, { x: 8.1, y: 29.4, label: '9월 3주' },
        { x: 9.5, y: 31.2, label: '9월 4주' }, { x: 11.3, y: 35.8, label: '10월 1주' }] },
      { id: 'lesson', name: '레슨', quality: '표본 적음', points: [
        { x: 12.4, y: 41.0, label: '9월 1주' }, { x: 14.9, y: 44.6, label: '9월 2주' }, { x: null, y: 39.2, label: '9월 3주' },
        { x: 16.2, y: 48.3, label: '9월 4주' }] },
      { id: 'wiki', name: '스톡위키', points: [
        { x: 3.1, y: 12.2, label: '9월 1주' }, { x: 3.8, y: 15.0, label: '9월 2주' }, { x: 5.2, y: 14.1, label: '9월 3주' },
        { x: 5.9, y: 19.7, label: '9월 4주' }] },
    ] } },
];
