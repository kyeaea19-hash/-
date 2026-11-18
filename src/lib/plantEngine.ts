import {
  DiaryEntry,
  MoodLabel,
  UserProfile,
  VALIDATION_LIMITS,
} from '../types/powerplant';

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function diffDays(fromStr: string, toStr: string): number {
  const from = parseDateStr(fromStr).getTime();
  const to = parseDateStr(toStr).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function formatStudyTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간 00분`;
  return `${h}시간 ${m}분`;
}

export function parseStudyTimeToMinutes(input: string): number {
  const hourMatch = input.match(/(\d+)\s*시간/);
  const minMatch = input.match(/(\d+)\s*분/);
  if (hourMatch || minMatch) {
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    return Math.max(0, Math.min(1440, hours * 60 + mins));
  }
  const numOnly = parseFloat(input.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(numOnly)) {
    if (numOnly <= 24) return Math.round(numOnly * 60);
    return Math.min(1440, Math.round(numOnly));
  }
  return 0;
}

export function getPlantTierName(level: number): string {
  if (level >= 300) return '초대형 국가 기간 복합화력 발전소';
  if (level >= 200) return '차세대 SMR·수소 융합 메가 발전소';
  if (level >= 100) return '고효율 HVDC 스마트 그리드 발전소';
  if (level >= 50) return '친환경 해상풍력·복합발전소';
  if (level >= 20) return '스마트 원자력 & 신재생 발전소';
  if (level >= 10) return '도약기 청정 태양광·ESS 발전소';
  if (level >= 4) return '새싹 계통연계 소형 발전소';
  if (level >= 1) return '스타트업 미니 태양광 발전소';
  return '대기 중인 예비 발전소';
}

export function getGridTierLabel(level: number): string {
  if (level >= 100) return 'Level 5 국가 기간망';
  if (level >= 50) return 'Level 4 스마트 그리드';
  if (level >= 20) return 'Level 3 전력망';
  if (level >= 10) return 'Level 2 배전망';
  if (level >= 1) return 'Level 1 마이크로 그리드';
  return 'Level 0 시작 전력망';
}

/**
 * First 3 days after starting the app (signupDate + 0..3 days) are protected
 * so new users don't get penalized or experience blackout before building buffer.
 */
export function isGracePeriodDate(signupDate: string, dateStr: string): boolean {
  const delta = diffDays(signupDate, dateStr);
  return delta >= 0 && delta <= 3;
}

/**
 * Evaluates missed-day blackout rules between lastPenaltyCheckDate and yesterday.
 * Rule:
 * - First 3 days from signupDate are exempt from deduction/blackout.
 * - Each missed day after grace period deducts -1 kWh (and breaks streak).
 * - Reaching 0 kWh triggers a blackout: plant level drops by -10 (minimum Lv.0) and blackoutCount++.
 */
export function evaluateDailyBlackoutPenalties(
  profile: UserProfile,
  diariesByDate: Record<string, DiaryEntry>,
  todayStr: string
): { updatedProfile: UserProfile; changed: boolean; blackoutOccurred: boolean; kwhLost: number } {
  const yesterdayStr = addDays(todayStr, -1);
  if (diffDays(profile.lastPenaltyCheckDate, yesterdayStr) <= 0) {
    return { updatedProfile: profile, changed: false, blackoutOccurred: false, kwhLost: 0 };
  }

  let level = profile.level;
  let storedKwh = profile.storedKwh;
  let streak = profile.streak;
  let blackoutCount = profile.blackoutCount;
  let kwhLost = 0;
  let blackoutOccurred = false;

  const daysToCheck = diffDays(profile.lastPenaltyCheckDate, yesterdayStr);
  const cappedDays = Math.min(365, daysToCheck);
  for (let i = 1; i <= cappedDays; i++) {
    const checkDate = addDays(profile.lastPenaltyCheckDate, i);
    const hasDiary = Boolean(diariesByDate[checkDate]);
    const isGrace = isGracePeriodDate(profile.signupDate, checkDate);
    if (!hasDiary && !isGrace) {
      streak = 0;
      if (storedKwh > 0) {
        storedKwh -= 1;
        kwhLost += 1;
        if (storedKwh === 0) {
          level = Math.max(0, level - 10);
          blackoutCount += 1;
          blackoutOccurred = true;
        }
      } else {
        level = Math.max(0, level - 10);
        blackoutCount += 1;
        blackoutOccurred = true;
      }
    }
  }

  const updatedProfile: UserProfile = {
    ...profile,
    level,
    storedKwh,
    streak,
    blackoutCount,
    lastPenaltyCheckDate: yesterdayStr,
  };

  return {
    updatedProfile,
    changed: true,
    blackoutOccurred,
    kwhLost,
  };
}

export function sanitizeDiaryInput(input: {
  userId: string;
  date: string;
  studyMinutes: number;
  studyTimeText: string;
  focusModule: string;
  tags: string[];
  mood: MoodLabel;
  moodQuote: string;
  retrospective: string;
  cheerNote: string;
  kwhEarned: number;
  targetCompany: string;
}): Omit<DiaryEntry, 'createdAt' | 'updatedAt'> {
  const cleanTags = input.tags
    .map((t) => t.trim().slice(0, VALIDATION_LIMITS.tagItemMax))
    .filter(Boolean)
    .slice(0, VALIDATION_LIMITS.tagsMaxCount);

  return {
    userId: input.userId.trim().slice(0, 128),
    date: input.date,
    studyMinutes: Math.max(0, Math.min(1440, Math.round(input.studyMinutes))),
    studyTimeText:
      (input.studyTimeText.trim() || formatStudyTime(input.studyMinutes)).slice(
        0,
        VALIDATION_LIMITS.studyTimeTextMax
      ),
    focusModule:
      (input.focusModule.trim() || '전공 및 NCS 학습').slice(
        0,
        VALIDATION_LIMITS.focusModuleMax
      ),
    tags: cleanTags,
    mood: input.mood,
    moodQuote: input.moodQuote.trim().slice(0, VALIDATION_LIMITS.moodQuoteMax),
    retrospective:
      (input.retrospective.trim() || '오늘도 한 걸음 성장했다.').slice(
        0,
        VALIDATION_LIMITS.retrospectiveMax
      ),
    cheerNote:
      (input.cheerNote.trim() || '내일도 꾸준히 발전소를 가동하자!').slice(
        0,
        VALIDATION_LIMITS.cheerNoteMax
      ),
    kwhEarned: Math.max(0, Math.min(1, input.kwhEarned)),
    targetCompany:
      (input.targetCompany.trim() || '한국전력공사').slice(
        0,
        VALIDATION_LIMITS.targetCompanyMax
      ),
  };
}

export function createInitialUserProfile(params: {
  uid: string;
  displayName: string;
  email: string;
  todayStr?: string;
}): UserProfile {
  const today = params.todayStr || getTodayStr();
  return {
    uid: params.uid,
    displayName: (params.displayName || '예비 전력인').slice(0, VALIDATION_LIMITS.displayNameMax),
    email: (params.email || 'guest@powerplant.local').slice(0, 160),
    targetCompany: '한국전력공사',
    dailyGoalMinutes: 360,
    level: 0,
    storedKwh: 0,
    streak: 0,
    longestStreak: 0,
    blackoutCount: 0,
    totalDiaries: 0,
    signupDate: today,
    lastWrittenDate: '',
    lastPenaltyCheckDate: addDays(today, -1),
    completedQuizIds: [],
    reminderEnabled: true,
  };
}

export function createDemoSeedData(todayStr: string): {
  profile: UserProfile;
  diaries: Record<string, DiaryEntry>;
} {
  return {
    profile: createInitialUserProfile({
      uid: 'guest-demo',
      displayName: '예비 전력인 (체험)',
      email: 'guest@powerplant.local',
      todayStr,
    }),
    diaries: {},
  };
}

const WARM_CHEER_MESSAGES: Record<MoodLabel, string[]> = {
  '활력 충전': [
    '오늘 뿜어낸 밝은 에너지가 내일의 합격 소식을 한 걸음 더 가까이 데려다줄 거예요. 참 잘했어요!',
    '뜨겁게 달린 오늘의 열정이 내일의 너를 든든하게 지켜줄 거야. 오늘도 정말 고생 많았어요 ⚡',
    '기분 좋은 흐름을 탔네요! 오늘 쌓은 1kWh의 성실함이 곧 빛나는 결과로 돌아올 거예요.',
  ],
  '아이디어 번뜩': [
    '오늘 깨달은 작은 개념 하나가 시험장에서는 결정적인 한 문제가 될 거예요. 내일의 나도 응원해 💡',
    '고민 끝에 풀려낸 그 뿌듯함을 기억해요. 천천히, 하지만 분명하게 성장하고 있어요!',
    '오늘 머릿속에 켜진 작은 전구들이 모여 내일의 큰 발전소를 밝힐 거예요. 정말 멋져요!',
  ],
  '평온함': [
    '요란하지 않아도 괜찮아요. 매일 묵묵히 쌓아 올리는 오늘의 루틴이 결국 가장 강력한 무기가 됩니다 🔋',
    '잔잔하고 꾸준한 오늘 하루가 내일의 흔들리지 않는 자신감이 될 거예요. 오늘도 고마워요.',
    '조급해하지 않고 나만의 속도로 잘 걸어가고 있어요. 내일도 오늘처럼만 편안하게 나아가요!',
  ],
  '방전 직전': [
    '오늘 많이 지쳤죠? 그래도 포기하지 않고 여기까지 온 것만으로도 충분히 대단해요. 오늘은 따뜻하게 푹 쉬어요 🪫',
    '잠시 흔들려도 괜찮아요. 어두운 밤이 지나야 아침 해가 뜨듯, 오늘의 고단함도 곧 지나갈 거예요.',
    '남들과 비교하지 말아요. 오늘 버텨낸 것만으로도 너는 충분히 빛나고 있어요. 토닥토닥!',
  ],
  '휴식 필요': [
    '잠시 전원을 끄고 냉각하는 시간도 발전소가 오래 가동되기 위한 소중한 과정이에요. 마음 편히 푹 쉬어요 🔌',
    '오늘 하루 정말 애썼어요. 죄책감은 내려놓고 좋아하는 음악과 함께 온전히 나를 돌보는 밤 보내요.',
    '내일 다시 환하게 켜질 수 있도록 오늘은 다정하게 나를 안아주는 시간 가지기. 언제나 네 편이야!',
  ],
};

export function generateWarmCheerMessage(
  mood: MoodLabel,
  seedOffset = 0
): string {
  const pool = WARM_CHEER_MESSAGES[mood] || WARM_CHEER_MESSAGES['평온함'];
  const idx = Math.abs(seedOffset) % pool.length;
  return pool[idx];
}

