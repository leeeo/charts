import type { ChartSpec } from '../src/types.ts';

const days = ['11/03', '11/04', '11/05', '11/06', '11/07', '11/08', '11/09'];
const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export const examples: { id: string; heading: string; note: string; spec: ChartSpec }[] = [
  { id: 'line', heading: '선 차트 (결측은 끊김)', note: '11/06 값이 없으면 0이 아니라 선이 끊깁니다.', spec: {
    type: 'line', title: '일간 방문자', unit: { label: '명', suffix: '명' }, labels: days, xLabel: '날짜',
    description: '11/06은 집계 누락(추정 없음).',
    series: [
      { id: 'web', name: '웹', values: [320, 340, 310, null, 405, 380, 420] },
      { id: 'app', name: '앱', values: [120, 135, 150, 148, 160, 158, 171], quality: '추정치' }] } },
  { id: 'area', heading: '영역 차트 (누적)', note: '누적 영역, 단위는 원.', spec: {
    type: 'area', stacked: true, title: '월별 수익 구성', unit: { label: '원', suffix: '원' }, labels: months,
    series: [
      { id: 'ad', name: '광고', values: [120000, 135000, 128000, 150000, 160000, 158000, 171000, 180000, 176000, 190000, 205000, 210000] },
      { id: 'sub', name: '구독', values: [40000, 42000, 45000, null, null, 52000, 58000, 60000, 64000, 70000, 72000, 80000] }] } },
  { id: 'bar-grouped', heading: '막대 차트 (묶음)', note: '데이터가 없는 칸은 막대가 없습니다.', spec: {
    type: 'bar', title: '앱별 신규 설치', unit: { label: '건', suffix: '건' }, labels: ['상상플레이', '레슨', '스톡위키', '어닝스'],
    series: [
      { id: 'w1', name: '이번 주', values: [420, 180, 95, null] },
      { id: 'w0', name: '지난 주', values: [380, 210, 60, 0] }] } },
  { id: 'bar-stacked', heading: '막대 차트 (누적)', note: '', spec: {
    type: 'bar', stacked: true, title: '채널별 유입', unit: { label: '%', suffix: '%' }, labels: ['월', '화', '수', '목', '금'],
    series: [
      { id: 'o', name: '검색', values: [40, 35, 42, 38, 30] },
      { id: 's', name: '소셜', values: [25, 30, 20, 28, 35] },
      { id: 'd', name: '직접', values: [15, 15, 18, 14, 20] }] } },
  { id: 'bar-horizontal', heading: '가로 막대 (긴 한글 라벨)', note: '긴 라벨은 영역을 계산해 잘리지 않습니다.', spec: {
    type: 'bar', horizontal: true, title: '화면별 평균 체류 시간', unit: { label: '초', suffix: '초' },
    labels: ['오늘의 퍼즐 풀이 화면', '설정 및 개인정보 처리방침 안내', '결과 공유', '튜토리얼'],
    series: [{ id: 't', name: '체류 시간', values: [182, 24, 61, 97] }] } },
  { id: 'donut', heading: '도넛 차트', note: '결측 슬라이스는 고리에서 빠지고 범례에 표시됩니다.', spec: {
    type: 'donut', title: '플랫폼 비중', unit: { suffix: '건' }, centerLabel: '설치 합계', slices: [
      { id: 'a', label: '안드로이드', value: 640 }, { id: 'i', label: 'iOS', value: 280 },
      { id: 'w', label: '웹', value: 90 }, { id: 'x', label: '기타', value: null, quality: '미집계' }] } },
  { id: 'sparkline', heading: '스파크라인', note: '표는 스크린 리더에서만 읽힙니다.', spec: {
    type: 'sparkline', title: '7일 추이', unit: { suffix: '명' }, labels: days,
    series: [{ id: 'v', name: '방문자', values: [320, 340, 310, null, 405, 380, 420] }] } },
  { id: 'multiples', heading: '작은 다중 차트 (앱별, 데이터 품질 표시)', note: '같은 축을 공유해 앱 규모를 비교할 수 있습니다.', spec: {
    type: 'multiples', panelType: 'line', title: '앱별 일간 사용자', unit: { suffix: '명' }, labels: days, sharedY: true,
    panels: [
      { id: 'sang', title: '상상플레이', series: [{ id: 'u', name: '사용자', values: [120, 135, 150, 148, 160, 158, 171] }] },
      { id: 'lesson', title: '레슨', quality: '추정치', series: [{ id: 'u', name: '사용자', values: [40, 42, 38, null, 51, 49, 55] }] },
      { id: 'wiki', title: '스톡위키', series: [{ id: 'u', name: '사용자', values: [300, 310, 295, 320, 330, 345, 360] }] },
      { id: 'earn', title: '어닝스', quality: '집계 지연', series: [{ id: 'u', name: '사용자', values: [null, null, 12, 15, 14, null, 18] }] },
      { id: 'empty', title: '신규 앱', quality: '데이터 없음', series: [{ id: 'u', name: '사용자', values: [null, null, null, null, null, null, null] }] }] } },
];
