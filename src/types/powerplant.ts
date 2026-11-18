export type TabId = 'home' | 'news' | 'write' | 'calendar';

export type MoodLabel =
  | '활력 충전'
  | '아이디어 번뜩'
  | '평온함'
  | '방전 직전'
  | '휴식 필요';

export interface MoodOption {
  label: MoodLabel;
  shortLabel: string;
  emoji: string;
  quote: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  {
    label: '활력 충전',
    shortLabel: '활력 충전',
    emoji: '⚡',
    quote: '⚡ 100% 풀충전! 문제 풀이 쾌속 질주',
  },
  {
    label: '아이디어 번뜩',
    shortLabel: '번뜩임',
    emoji: '💡',
    quote: '💡 오답 분석 중 킬러 공식 완전 정복!',
  },
  {
    label: '평온함',
    shortLabel: '평온함',
    emoji: '🔋',
    quote: '🔋 기복 없이 루틴대로 담담하게 진행',
  },
  {
    label: '방전 직전',
    shortLabel: '방전 직전',
    emoji: '🪫',
    quote: '🪫 집중력이 흐려진 하루, 따뜻한 차 한 잔 필요',
  },
  {
    label: '휴식 필요',
    shortLabel: '휴식 요망',
    emoji: '🔌',
    quote: '🔌 오늘은 발전기 냉각 모드. 푹 쉬고 리셋!',
  },
];

export const POWER_COMPANIES = [
  '한국전력공사',
  '한국수력원자력',
  '한국남동발전',
  '한국중부발전',
  '한국서부발전',
  '한국남부발전',
  '한국동서발전',
  '전력거래소',
  '한전KPS',
  '한전KDN',
  '한국전력기술',
  '한전원자력연료',
  '한국가스공사',
  '한국도로공사',
  '한국철도공사(코레일)',
  '한국수자원공사',
  '한국지역난방공사',
] as const;

export const VALIDATION_LIMITS = {
  displayNameMax: 80,
  targetCompanyMax: 60,
  studyTimeTextMax: 40,
  focusModuleMax: 120,
  tagsMaxCount: 10,
  tagItemMax: 40,
  moodQuoteMax: 200,
  retrospectiveMax: 3000,
  cheerNoteMax: 500,
  newsMemoMax: 1500,
  completedQuizIdsMax: 100,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  targetCompany: string;
  dailyGoalMinutes: number;
  level: number;
  storedKwh: number;
  streak: number;
  longestStreak: number;
  blackoutCount: number;
  totalDiaries: number;
  signupDate: string; // YYYY-MM-DD
  lastWrittenDate: string; // YYYY-MM-DD or ''
  lastPenaltyCheckDate: string; // YYYY-MM-DD
  completedQuizIds: string[];
  reminderEnabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DiaryEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  studyMinutes: number;
  studyTimeText: string;
  focusModule: string;
  tags: string[];
  mood: MoodLabel;
  moodQuote: string;
  retrospective: string;
  cheerNote: string;
  newsMemo?: string;
  kwhEarned: number;
  targetCompany: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsArticle {
  id: string;
  company: string;
  category: string;
  badgeType: 'lead' | 'brief';
  title: string;
  subtitle: string;
  publishedLabel: string;
  readTimeLabel: string;
  intro?: string;
  bullets: string[];
  interviewTip?: string;
  ncsNote?: string;
  sourceName: string;
  sourceUrl: string;
  visualTheme: 'nuclear' | 'grid' | 'smr' | 'hydrogen' | 'offshore' | 'solar';
  visualCaption?: string;
  featuredOnHome?: boolean;
}

export interface BriefingQuiz {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  bonusKwh: number;
}

export interface InterviewTip {
  id: string;
  question: string;
  answer: string;
  company: string;
}
