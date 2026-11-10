import type { Example } from '../types.ts';

export const examples: Example[] = [
  { id: 'pareto', heading: '파레토 차트 (고객 문의 유형)', note: '문의가 많은 유형부터 정렬하고 누적 비율을 오른쪽 축에 표시합니다. 80% 기준선으로 우선 대응할 유형을 찾습니다.', wide: true, spec: {
    type: 'pareto', title: '10월 고객 문의 유형', unit: { label: '건', suffix: '건' },
    items: [
      { id: 'pay', label: '결제 오류', value: 148 },
      { id: 'login', label: '로그인', value: 96 },
      { id: 'refund', label: '환불 요청', value: 61 },
      { id: 'sync', label: '데이터 동기화', value: 34 },
      { id: 'push', label: '알림', value: 22 },
      { id: 'ui', label: '화면 표시', value: 15 },
      { id: 'etc', label: '기타', value: 9 },
      { id: 'unk', label: '미분류', value: null, quality: '태깅 누락' },
    ] } },
];
