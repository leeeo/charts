import type { Example } from '../types.ts';

// One year of daily visitors to leeeo 일정 (deterministic synthetic series): weekly rhythm, a slow upward trend,
// a launch spike in March, and a three-day logging outage in August that is missing (null), not zero.
const start = Date.UTC(2025, 10, 10);
const values = Array.from({ length: 365 }, (_, i) => {
  const day = new Date(start + i * 86400000);
  if (day.getUTCFullYear() === 2026 && day.getUTCMonth() === 7 && day.getUTCDate() >= 12 && day.getUTCDate() <= 14) return null;
  const wd = day.getUTCDay();
  const weekly = wd === 0 || wd === 6 ? 0.72 : 1;
  const trend = 820 + i * 2.1;
  const launch = i >= 120 && i < 134 ? 1.6 - (i - 120) * 0.04 : 1;
  const wobble = ((i * 37) % 23) * 9;
  return Math.round(trend * weekly * launch + wobble);
});

export const examples: Example[] = [
  {
    id: 'skyline',
    heading: '1년 일별 방문자',
    note: '하루 한 칸씩 붙여 만든 실루엣입니다. 8월 로그 수집 장애 사흘은 0이 아니라 결측(음영)으로 표시됩니다.',
    wide: true,
    spec: {
      type: 'skyline',
      title: 'leeeo 일정 일별 방문자',
      description: '2025-11-10부터 365일, 웹·앱 합산',
      unit: { label: '명', suffix: '명' },
      name: '방문자',
      start: '2025-11-10',
      values,
    },
  },
];
