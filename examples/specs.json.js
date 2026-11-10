export const examples = [
 {
  "id": "line",
  "spec": {
   "type": "line",
   "title": "일간 방문자",
   "unit": {
    "label": "명",
    "suffix": "명"
   },
   "labels": [
    "11/03",
    "11/04",
    "11/05",
    "11/06",
    "11/07",
    "11/08",
    "11/09"
   ],
   "xLabel": "날짜",
   "description": "11/06은 집계 누락(추정 없음).",
   "series": [
    {
     "id": "web",
     "name": "웹",
     "values": [
      320,
      340,
      310,
      null,
      405,
      380,
      420
     ]
    },
    {
     "id": "app",
     "name": "앱",
     "values": [
      120,
      135,
      150,
      148,
      160,
      158,
      171
     ],
     "quality": "추정치"
    }
   ]
  }
 },
 {
  "id": "area",
  "spec": {
   "type": "area",
   "stacked": true,
   "title": "월별 수익 구성",
   "unit": {
    "label": "원",
    "suffix": "원"
   },
   "labels": [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월"
   ],
   "series": [
    {
     "id": "ad",
     "name": "광고",
     "values": [
      120000,
      135000,
      128000,
      150000,
      160000,
      158000,
      171000,
      180000,
      176000,
      190000,
      205000,
      210000
     ]
    },
    {
     "id": "sub",
     "name": "구독",
     "values": [
      40000,
      42000,
      45000,
      null,
      null,
      52000,
      58000,
      60000,
      64000,
      70000,
      72000,
      80000
     ]
    }
   ]
  }
 },
 {
  "id": "bar-grouped",
  "spec": {
   "type": "bar",
   "title": "앱별 신규 설치",
   "unit": {
    "label": "건",
    "suffix": "건"
   },
   "labels": [
    "상상플레이",
    "레슨",
    "스톡위키",
    "어닝스"
   ],
   "series": [
    {
     "id": "w1",
     "name": "이번 주",
     "values": [
      420,
      180,
      95,
      null
     ]
    },
    {
     "id": "w0",
     "name": "지난 주",
     "values": [
      380,
      210,
      60,
      0
     ]
    }
   ]
  }
 },
 {
  "id": "bar-stacked",
  "spec": {
   "type": "bar",
   "stacked": true,
   "title": "채널별 유입",
   "unit": {
    "label": "%",
    "suffix": "%"
   },
   "labels": [
    "월",
    "화",
    "수",
    "목",
    "금"
   ],
   "series": [
    {
     "id": "o",
     "name": "검색",
     "values": [
      40,
      35,
      42,
      38,
      30
     ]
    },
    {
     "id": "s",
     "name": "소셜",
     "values": [
      25,
      30,
      20,
      28,
      35
     ]
    },
    {
     "id": "d",
     "name": "직접",
     "values": [
      15,
      15,
      18,
      14,
      20
     ]
    }
   ]
  }
 },
 {
  "id": "bar-horizontal",
  "spec": {
   "type": "bar",
   "horizontal": true,
   "title": "화면별 평균 체류 시간",
   "unit": {
    "label": "초",
    "suffix": "초"
   },
   "labels": [
    "오늘의 퍼즐 풀이 화면",
    "설정 및 개인정보 처리방침 안내",
    "결과 공유",
    "튜토리얼"
   ],
   "series": [
    {
     "id": "t",
     "name": "체류 시간",
     "values": [
      182,
      24,
      61,
      97
     ]
    }
   ]
  }
 },
 {
  "id": "donut",
  "spec": {
   "type": "donut",
   "title": "플랫폼 비중",
   "unit": {
    "suffix": "건"
   },
   "centerLabel": "설치 합계",
   "slices": [
    {
     "id": "a",
     "label": "안드로이드",
     "value": 640
    },
    {
     "id": "i",
     "label": "iOS",
     "value": 280
    },
    {
     "id": "w",
     "label": "웹",
     "value": 90
    },
    {
     "id": "x",
     "label": "기타",
     "value": null,
     "quality": "미집계"
    }
   ]
  }
 },
 {
  "id": "sparkline",
  "spec": {
   "type": "sparkline",
   "title": "7일 추이",
   "unit": {
    "suffix": "명"
   },
   "labels": [
    "11/03",
    "11/04",
    "11/05",
    "11/06",
    "11/07",
    "11/08",
    "11/09"
   ],
   "series": [
    {
     "id": "v",
     "name": "방문자",
     "values": [
      320,
      340,
      310,
      null,
      405,
      380,
      420
     ]
    }
   ]
  }
 },
 {
  "id": "multiples",
  "spec": {
   "type": "multiples",
   "panelType": "line",
   "title": "앱별 일간 사용자",
   "unit": {
    "suffix": "명"
   },
   "labels": [
    "11/03",
    "11/04",
    "11/05",
    "11/06",
    "11/07",
    "11/08",
    "11/09"
   ],
   "sharedY": true,
   "panels": [
    {
     "id": "sang",
     "title": "상상플레이",
     "series": [
      {
       "id": "u",
       "name": "사용자",
       "values": [
        120,
        135,
        150,
        148,
        160,
        158,
        171
       ]
      }
     ]
    },
    {
     "id": "lesson",
     "title": "레슨",
     "quality": "추정치",
     "series": [
      {
       "id": "u",
       "name": "사용자",
       "values": [
        40,
        42,
        38,
        null,
        51,
        49,
        55
       ]
      }
     ]
    },
    {
     "id": "wiki",
     "title": "스톡위키",
     "series": [
      {
       "id": "u",
       "name": "사용자",
       "values": [
        300,
        310,
        295,
        320,
        330,
        345,
        360
       ]
      }
     ]
    },
    {
     "id": "earn",
     "title": "어닝스",
     "quality": "집계 지연",
     "series": [
      {
       "id": "u",
       "name": "사용자",
       "values": [
        null,
        null,
        12,
        15,
        14,
        null,
        18
       ]
      }
     ]
    },
    {
     "id": "empty",
     "title": "신규 앱",
     "quality": "데이터 없음",
     "series": [
      {
       "id": "u",
       "name": "사용자",
       "values": [
        null,
        null,
        null,
        null,
        null,
        null,
        null
       ]
      }
     ]
    }
   ]
  }
 }
];
