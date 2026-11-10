import type { Example } from './types.ts';
import { examples as waffle } from './charts/waffle.ts';
import { examples as segmented } from './charts/segmented.ts';
import { examples as funnel } from './charts/funnel.ts';
import { examples as gauge } from './charts/gauge.ts';
import { examples as bullet } from './charts/bullet.ts';
import { examples as slope } from './charts/slope.ts';
import { examples as bump } from './charts/bump.ts';
import { examples as stream } from './charts/stream.ts';
import { examples as scatter } from './charts/scatter.ts';
import { examples as bubble } from './charts/bubble.ts';
import { examples as box } from './charts/box.ts';
import { examples as histogram } from './charts/histogram.ts';
import { examples as heatmap } from './charts/heatmap.ts';
import { examples as calendar } from './charts/calendar.ts';
import { examples as treemap } from './charts/treemap.ts';
import { examples as sankey } from './charts/sankey.ts';
import { examples as pie } from './charts/pie.ts';
import { examples as lollipop } from './charts/lollipop.ts';
import { examples as dumbbell } from './charts/dumbbell.ts';
import { examples as waterfall } from './charts/waterfall.ts';
import { examples as pareto } from './charts/pareto.ts';
import { examples as marimekko } from './charts/marimekko.ts';
import { examples as radar } from './charts/radar.ts';
import { examples as parallel } from './charts/parallel.ts';
import { examples as ridgeline } from './charts/ridgeline.ts';
import { examples as beeswarm } from './charts/beeswarm.ts';
import { examples as candlestick } from './charts/candlestick.ts';
import { examples as timeline } from './charts/timeline.ts';
import { examples as skyline } from './charts/skyline.ts';
import { examples as sunburst } from './charts/sunburst.ts';
import { examples as tree } from './charts/tree.ts';
import { examples as network } from './charts/network.ts';
import { examples as chord } from './charts/chord.ts';
import { examples as map } from './charts/map.ts';


const days = ['11/03', '11/04', '11/05', '11/06', '11/07', '11/08', '11/09'];
const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const core: Example[] = [
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
  { id: 'bar-percent', heading: '막대 차트 (100% 누적)', note: '칸마다 합을 100%로 맞추고, 값 상자에는 원래 값도 함께 나옵니다.', spec: {
    type: 'bar', stacked: true, percent: true, horizontal: true, title: '채널별 기기 비중', unit: { suffix: '건' }, labels: ['검색', '소셜', '직접', '추천'],
    series: [
      { id: 'm', name: '모바일', values: [620, 840, 300, 120] },
      { id: 'd', name: '데스크톱', values: [310, 90, 260, null] },
      { id: 't', name: '태블릿', values: [70, 70, 40, 30] }] } },
  { id: 'bar-diverging', heading: '막대 차트 (양방향)', note: '음수는 0에서 아래로 쌓입니다. 만족도·증감 비교에 씁니다.', spec: {
    type: 'bar', stacked: true, horizontal: true, title: '기능별 만족도', unit: { suffix: '%' }, labels: ['검색', '알림', '결제', '설정'],
    series: [
      { id: 'bad', name: '불만족', values: [-12, -30, -8, -20], color: 'var(--lc-s7)' },
      { id: 'meh', name: '보통 이하', values: [-8, -15, -6, null], color: 'var(--lc-s5)' },
      { id: 'good', name: '만족', values: [55, 35, 60, 40], color: 'var(--lc-s3)' },
      { id: 'great', name: '매우 만족', values: [25, 20, 26, 22], color: 'var(--lc-s1)' }] } },
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

export const examples: Example[] = [
  ...core,
  ...waffle, ...segmented, ...funnel, ...gauge, ...bullet, ...slope, ...bump, ...stream, ...scatter, ...bubble, ...box, ...histogram, ...heatmap, ...calendar, ...treemap, ...sankey, ...pie, ...lollipop, ...dumbbell, ...waterfall, ...pareto, ...marimekko, ...radar, ...parallel, ...ridgeline, ...beeswarm, ...candlestick, ...timeline, ...skyline, ...sunburst, ...tree, ...network, ...chord, ...map,
];
