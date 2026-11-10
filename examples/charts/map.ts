import type { Example } from '../types.ts';

export const examples: Example[] = [{
  id: 'map',
  heading: '시도별 신규 설치',
  note: '10월 시도별 신규 설치 수입니다. 위치 권한을 거부해 집계하지 못한 시도는 빗금(데이터 없음)으로 표시합니다.',
  spec: {
    type: 'map',
    title: '상상플레이 시도별 신규 설치 (10월)',
    unit: { suffix: '건', label: '건' },
    labels: true,
    values: {
      '서울': 4820, '부산': 1630, '대구': 1040, '인천': 1310, '광주': 590, '대전': 640, '울산': 410, '세종': null,
      '경기': 5960, '강원': 380, '충북': 450, '충남': 610, '전북': 470, '전남': 420, '경북': 690, '경남': 1080,
    },
  },
}];
