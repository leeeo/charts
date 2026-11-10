import type { Example } from '../types.ts';

// Daily visitors 2026-06-01..2026-10-31: weekday rhythm plus a slow trend (deterministic, no randomness).
// 2026-08-14..16 is a logging outage (null) and 2026-09-25..27 (추석) has no rows at all; both read as missing, never as 0.
const data: { date: string; value: number | null }[] = [];
const start = Date.UTC(2026, 5, 1);
for (let i = 0; i < 153; i++) {
  const date = new Date(start + i * 86400000).toISOString().slice(0, 10);
  if (date >= '2026-09-25' && date <= '2026-09-27') continue;
  const wd = i % 7; // 2026-06-01 is a Monday
  const weekend = wd >= 5 ? 1.45 : 1;
  const value = date >= '2026-08-14' && date <= '2026-08-16' ? null : Math.round((420 + i * 3.1 + ((i * 37) % 90)) * weekend);
  data.push({ date, value });
}

export const examples: Example[] = [{
  id: 'calendar',
  heading: '일별 방문자 캘린더',
  note: '6월부터 10월까지 상상플레이 일별 방문자입니다. 로그 장애일과 추석 연휴(집계 없음)는 결측으로 표시합니다.',
  wide: true,
  spec: {
    type: 'calendar',
    title: '상상플레이 일별 방문자 (2026년 6~10월)',
    unit: { suffix: '명', label: '명' },
    start: '2026-06-01',
    end: '2026-10-31',
    quality: '8월 로그 장애',
    data,
  },
}];
