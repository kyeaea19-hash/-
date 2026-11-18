import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  addDays,
  createDemoSeedData,
  createInitialUserProfile,
  evaluateDailyBlackoutPenalties,
  formatStudyTime,
  getTodayStr,
  sanitizeDiaryInput,
} from '../lib/plantEngine';
import {
  BriefingQuiz,
  DiaryEntry,
  InterviewTip,
  MoodLabel,
  NewsArticle,
  UserProfile,
} from '../types/powerplant';

type AuthMode = 'loading' | 'unauthenticated' | 'guest' | 'firebase';

const GUEST_STORAGE_KEY = 'powerplant_guest_state_v2';

export interface LiveNewsPayload {
  date: string;
  displayDate: string;
  articles: NewsArticle[];
  quiz: BriefingQuiz | null;
  interviewTips: InterviewTip[];
  groundingSources: { title: string; uri: string }[];
}

interface SaveDiaryPayload {
  date: string;
  studyMinutes: number;
  studyTimeText: string;
  focusModule: string;
  tags: string[];
  mood: MoodLabel;
  moodQuote: string;
  retrospective: string;
  cheerNote: string;
}

interface PowerPlantContextValue {
  mode: AuthMode;
  firebaseUser: User | null;
  profile: UserProfile | null;
  diariesByDate: Record<string, DiaryEntry>;
  authError: string | null;
  isSigningIn: boolean;
  blackoutBanner: { kwhLost: number; blackoutOccurred: boolean } | null;
  dismissBlackoutBanner: () => void;
  signInWithGoogle: () => Promise<void>;
  enterGuestMode: () => void;
  logout: () => Promise<void>;
  saveDiaryEntry: (
    payload: SaveDiaryPayload
  ) => Promise<{ isNewToday: boolean; earnedKwh: number; newLevel: number; streakBonus: number }>;
  completeQuizBonus: (quizId: string, bonusKwh: number) => Promise<boolean>;
  updatePreferences: (patch: {
    targetCompany?: string;
    dailyGoalMinutes?: number;
    reminderEnabled?: boolean;
    displayName?: string;
  }) => Promise<void>;
  liveNews: LiveNewsPayload | null;
  newsLoading: boolean;
  newsError: string | null;
  fetchLiveNews: (opts?: { category?: string; query?: string; refresh?: boolean }) => Promise<void>;
  todayStudyMinutes: number;
  updateTodayStudyMinutes: (minutes: number) => Promise<void>;
}

const TODAY_STUDY_KEY = 'powerplant_today_study_v1';

const PowerPlantContext = createContext<PowerPlantContextValue | null>(null);

export const PowerPlantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AuthMode>('loading');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diariesByDate, setDiariesByDate] = useState<Record<string, DiaryEntry>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [blackoutBanner, setBlackoutBanner] = useState<{
    kwhLost: number;
    blackoutOccurred: boolean;
  } | null>(null);
  const [penaltyCheckedUid, setPenaltyCheckedUid] = useState<string | null>(null);

  const [liveNews, setLiveNews] = useState<LiveNewsPayload | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [draftStudyState, setDraftStudyState] = useState<{ date: string; minutes: number }>(() => {
    const today = getTodayStr();
    try {
      const raw = localStorage.getItem(TODAY_STUDY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { date?: string; minutes?: number };
        if (parsed.date === today && typeof parsed.minutes === 'number') {
          return {
            date: today,
            minutes: Math.max(0, Math.min(1440, Math.round(parsed.minutes))),
          };
        }
      }
    } catch {
      // ignore invalid storage
    }
    return { date: today, minutes: 0 };
  });

  const fetchLiveNews = useCallback(
    async (opts?: { category?: string; query?: string; refresh?: boolean }) => {
      const category = opts?.category || '전체';
      const query = opts?.query || '';
      const refresh = opts?.refresh ? '1' : '0';

      setNewsLoading(true);
      setNewsError(null);
      try {
        const params = new URLSearchParams();
        params.set('category', category);
        if (query) params.set('q', query);
        if (refresh === '1') params.set('refresh', '1');

        const res = await fetch(`/api/news?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || '오늘의 뉴스를 가져오지 못했습니다.');
        }
        setLiveNews(data as LiveNewsPayload);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : '뉴스 서버와 통신하지 못했습니다.';
        setNewsError(msg);
      } finally {
        setNewsLoading(false);
      }
    },
    []
  );

  // Restore guest mode if previously active and no Firebase user
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubDiaries: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubDiaries) {
        unsubDiaries();
        unsubDiaries = null;
      }

      if (!user) {
        setFirebaseUser(null);
        setPenaltyCheckedUid(null);
        const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
        if (savedGuest) {
          try {
            const parsed = JSON.parse(savedGuest) as {
              profile: UserProfile;
              diaries: Record<string, DiaryEntry>;
            };
            setProfile(parsed.profile);
            setDiariesByDate(parsed.diaries || {});
            setMode('guest');
            return;
          } catch {
            localStorage.removeItem(GUEST_STORAGE_KEY);
          }
        }
        setProfile(null);
        setDiariesByDate({});
        setMode('unauthenticated');
        return;
      }

      setFirebaseUser(user);
      setAuthError(null);

      const userPath = `users/${user.uid}`;
      const userDocRef = doc(db, 'users', user.uid);

      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const initial = createInitialUserProfile({
            uid: user.uid,
            displayName: user.displayName || '예비 전력인',
            email: user.email || '',
          });
          await setDoc(userDocRef, {
            ...initial,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }

      setMode('firebase');

      unsubProfile = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, userPath);
        }
      );

      const diariesPath = `users/${user.uid}/diaries`;
      const diariesQuery = query(
        collection(db, 'users', user.uid, 'diaries'),
        where('userId', '==', user.uid)
      );
      unsubDiaries = onSnapshot(
        diariesQuery,
        (querySnap) => {
          const map: Record<string, DiaryEntry> = {};
          querySnap.forEach((d) => {
            const entry = d.data() as DiaryEntry;
            map[entry.date || d.id] = entry;
          });
          setDiariesByDate(map);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, diariesPath);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubDiaries) unsubDiaries();
    };
  }, []);

  // Automatically fetch today's live power news once authenticated or exploring
  useEffect(() => {
    if ((mode === 'firebase' || mode === 'guest') && !liveNews && !newsLoading && !newsError) {
      fetchLiveNews({ category: '전체' });
    }
  }, [mode, liveNews, newsLoading, newsError, fetchLiveNews]);

  // Evaluate daily blackout penalties once profile & diaries are loaded
  useEffect(() => {
    if (!profile || penaltyCheckedUid === profile.uid) return;
    if (mode !== 'firebase' && mode !== 'guest') return;

    const todayStr = getTodayStr();
    const result = evaluateDailyBlackoutPenalties(profile, diariesByDate, todayStr);
    setPenaltyCheckedUid(profile.uid);

    if (!result.changed) return;

    if (result.kwhLost > 0 || result.blackoutOccurred) {
      setBlackoutBanner({
        kwhLost: result.kwhLost,
        blackoutOccurred: result.blackoutOccurred,
      });
    }

    if (mode === 'guest') {
      setProfile(result.updatedProfile);
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ profile: result.updatedProfile, diaries: diariesByDate })
      );
    } else if (mode === 'firebase' && firebaseUser) {
      const userPath = `users/${firebaseUser.uid}`;
      updateDoc(doc(db, 'users', firebaseUser.uid), {
        level: result.updatedProfile.level,
        storedKwh: result.updatedProfile.storedKwh,
        streak: result.updatedProfile.streak,
        blackoutCount: result.updatedProfile.blackoutCount,
        lastPenaltyCheckDate: result.updatedProfile.lastPenaltyCheckDate,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      });
    }
  }, [profile, diariesByDate, mode, firebaseUser, penaltyCheckedUid]);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Google 로그인 중 오류가 발생했습니다.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const enterGuestMode = useCallback(() => {
    const todayStr = getTodayStr();
    const existingRaw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw) as {
          profile: UserProfile;
          diaries: Record<string, DiaryEntry>;
        };
        setProfile(parsed.profile);
        setDiariesByDate(parsed.diaries || {});
        setMode('guest');
        return;
      } catch {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    }
    const seed = createDemoSeedData(todayStr);
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(seed));
    setProfile(seed.profile);
    setDiariesByDate(seed.diaries);
    setPenaltyCheckedUid(null);
    setMode('guest');
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    localStorage.removeItem(TODAY_STUDY_KEY);
    if (firebaseUser) {
      await signOut(auth);
    }
    setProfile(null);
    setDiariesByDate({});
    setDraftStudyState({ date: getTodayStr(), minutes: 0 });
    setPenaltyCheckedUid(null);
    setMode('unauthenticated');
  }, [firebaseUser]);

  const saveDiaryEntry = useCallback(
    async (payload: SaveDiaryPayload) => {
      if (!profile) {
        throw new Error('프로필이 초기화되지 않았습니다.');
      }

      const todayStr = getTodayStr();
      const targetDate = payload.date || todayStr;
      const existingEntry = diariesByDate[targetDate];
      const isNewEntry = !existingEntry;
      const isToday = targetDate === todayStr;

      const cleanEntry = sanitizeDiaryInput({
        userId: profile.uid,
        date: targetDate,
        studyMinutes: payload.studyMinutes,
        studyTimeText: payload.studyTimeText,
        focusModule: payload.focusModule,
        tags: payload.tags,
        mood: payload.mood,
        moodQuote: payload.moodQuote,
        retrospective: payload.retrospective,
        cheerNote: payload.cheerNote,
        kwhEarned: existingEntry ? existingEntry.kwhEarned : isToday ? 1 : 0,
        targetCompany: profile.targetCompany,
      });

      let earnedKwh = 0;
      let streakBonus = 0;
      let nextLevel = profile.level;
      let nextStoredKwh = profile.storedKwh;
      let nextStreak = profile.streak;
      let nextLongestStreak = profile.longestStreak;
      let nextTotalDiaries = profile.totalDiaries;
      let nextLastWrittenDate = profile.lastWrittenDate;

      if (isNewEntry && isToday) {
        earnedKwh = 1;
        nextLevel = Math.min(365, profile.level + 1);
        nextTotalDiaries = profile.totalDiaries + 1;

        const yesterdayStr = addDays(todayStr, -1);
        if (profile.lastWrittenDate === yesterdayStr) {
          nextStreak = profile.streak + 1;
        } else if (profile.lastWrittenDate === todayStr) {
          nextStreak = profile.streak;
        } else {
          nextStreak = 1;
        }

        if (nextStreak > 0 && nextStreak % 14 === 0) {
          streakBonus = 5;
        }

        nextStoredKwh = Math.min(365, profile.storedKwh + 1 + streakBonus);
        nextLongestStreak = Math.max(profile.longestStreak, nextStreak);
        nextLastWrittenDate = todayStr;
      }

      const nextProfile: UserProfile = {
        ...profile,
        level: nextLevel,
        storedKwh: nextStoredKwh,
        streak: nextStreak,
        longestStreak: nextLongestStreak,
        totalDiaries: nextTotalDiaries,
        lastWrittenDate: nextLastWrittenDate,
      };

      if (isToday) {
        const syncedStudy = { date: todayStr, minutes: cleanEntry.studyMinutes };
        setDraftStudyState(syncedStudy);
        localStorage.setItem(TODAY_STUDY_KEY, JSON.stringify(syncedStudy));
      }

      if (mode === 'guest') {
        const nextDiaries = {
          ...diariesByDate,
          [targetDate]: {
            ...cleanEntry,
            createdAt: existingEntry?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
        setProfile(nextProfile);
        setDiariesByDate(nextDiaries);
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({ profile: nextProfile, diaries: nextDiaries })
        );
        return { isNewToday: isNewEntry && isToday, earnedKwh, newLevel: nextLevel, streakBonus };
      }

      if (!firebaseUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const diaryPath = `users/${firebaseUser.uid}/diaries/${targetDate}`;
      const diaryRef = doc(db, 'users', firebaseUser.uid, 'diaries', targetDate);
      const userRef = doc(db, 'users', firebaseUser.uid);

      try {
        if (isNewEntry) {
          const batch = writeBatch(db);
          batch.set(diaryRef, {
            ...cleanEntry,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (isToday) {
            batch.update(userRef, {
              level: nextLevel,
              storedKwh: nextStoredKwh,
              streak: nextStreak,
              longestStreak: nextLongestStreak,
              totalDiaries: nextTotalDiaries,
              lastWrittenDate: nextLastWrittenDate,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } else {
          await updateDoc(diaryRef, {
            studyMinutes: cleanEntry.studyMinutes,
            studyTimeText: cleanEntry.studyTimeText,
            focusModule: cleanEntry.focusModule,
            tags: cleanEntry.tags,
            mood: cleanEntry.mood,
            moodQuote: cleanEntry.moodQuote,
            retrospective: cleanEntry.retrospective,
            cheerNote: cleanEntry.cheerNote,
            targetCompany: cleanEntry.targetCompany,
            updatedAt: serverTimestamp(),
          });
        }

        const immediateEntry: DiaryEntry = {
          ...cleanEntry,
          createdAt: existingEntry?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDiariesByDate((prev) => ({
          ...prev,
          [targetDate]: immediateEntry,
        }));
        if (isNewEntry && isToday) {
          setProfile(nextProfile);
        }
      } catch (err) {
        handleFirestoreError(
          err,
          isNewEntry ? OperationType.CREATE : OperationType.UPDATE,
          diaryPath
        );
      }

      return { isNewToday: isNewEntry && isToday, earnedKwh, newLevel: nextLevel, streakBonus };
    },
    [profile, diariesByDate, mode, firebaseUser]
  );

  const completeQuizBonus = useCallback(
    async (quizId: string, bonusKwh: number): Promise<boolean> => {
      if (!profile) return false;
      if (profile.completedQuizIds.includes(quizId)) return false;

      const updatedQuizIds = [...profile.completedQuizIds, quizId].slice(-100);
      const nextStoredKwh = Math.min(365, profile.storedKwh + bonusKwh);
      const nextProfile: UserProfile = {
        ...profile,
        storedKwh: nextStoredKwh,
        completedQuizIds: updatedQuizIds,
      };

      if (mode === 'guest') {
        setProfile(nextProfile);
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({ profile: nextProfile, diaries: diariesByDate })
        );
        return true;
      }

      if (!firebaseUser) return false;
      const userPath = `users/${firebaseUser.uid}`;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          storedKwh: nextStoredKwh,
          completedQuizIds: updatedQuizIds,
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [profile, diariesByDate, mode, firebaseUser]
  );

  const updatePreferences = useCallback(
    async (patch: {
      targetCompany?: string;
      dailyGoalMinutes?: number;
      reminderEnabled?: boolean;
      displayName?: string;
    }) => {
      if (!profile) return;
      const nextProfile: UserProfile = {
        ...profile,
        targetCompany: patch.targetCompany
          ? patch.targetCompany.trim().slice(0, 60)
          : profile.targetCompany,
        dailyGoalMinutes:
          typeof patch.dailyGoalMinutes === 'number'
            ? Math.max(30, Math.min(960, Math.round(patch.dailyGoalMinutes)))
            : profile.dailyGoalMinutes,
        reminderEnabled:
          typeof patch.reminderEnabled === 'boolean'
            ? patch.reminderEnabled
            : profile.reminderEnabled,
        displayName: patch.displayName
          ? patch.displayName.trim().slice(0, 80)
          : profile.displayName,
      };

      if (mode === 'guest') {
        setProfile(nextProfile);
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({ profile: nextProfile, diaries: diariesByDate })
        );
        return;
      }

      if (!firebaseUser) return;
      const userPath = `users/${firebaseUser.uid}`;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          targetCompany: nextProfile.targetCompany,
          dailyGoalMinutes: nextProfile.dailyGoalMinutes,
          reminderEnabled: nextProfile.reminderEnabled,
          displayName: nextProfile.displayName,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [profile, diariesByDate, mode, firebaseUser]
  );

  const todayStrForStudy = getTodayStr();
  const todayDiaryForStudy = diariesByDate[todayStrForStudy];
  const todayStudyMinutes = todayDiaryForStudy
    ? todayDiaryForStudy.studyMinutes
    : draftStudyState.date === todayStrForStudy
    ? draftStudyState.minutes
    : 0;

  const updateTodayStudyMinutes = useCallback(
    async (minutes: number) => {
      const today = getTodayStr();
      const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
      const nextState = { date: today, minutes: clamped };
      setDraftStudyState(nextState);
      localStorage.setItem(TODAY_STUDY_KEY, JSON.stringify(nextState));

      const existing = diariesByDate[today];
      if (existing && profile) {
        await saveDiaryEntry({
          date: today,
          studyMinutes: clamped,
          studyTimeText: formatStudyTime(clamped),
          focusModule: existing.focusModule,
          tags: existing.tags,
          mood: existing.mood,
          moodQuote: existing.moodQuote,
          retrospective: existing.retrospective,
          cheerNote: existing.cheerNote,
        });
      }
    },
    [diariesByDate, profile, saveDiaryEntry]
  );

  return (
    <PowerPlantContext.Provider
      value={{
        mode,
        firebaseUser,
        profile,
        diariesByDate,
        authError,
        isSigningIn,
        blackoutBanner,
        dismissBlackoutBanner: () => setBlackoutBanner(null),
        signInWithGoogle,
        enterGuestMode,
        logout,
        saveDiaryEntry,
        completeQuizBonus,
        updatePreferences,
        liveNews,
        newsLoading,
        newsError,
        fetchLiveNews,
        todayStudyMinutes,
        updateTodayStudyMinutes,
      }}
    >
      {children}
    </PowerPlantContext.Provider>
  );
};

export function usePowerPlant(): PowerPlantContextValue {
  const ctx = useContext(PowerPlantContext);
  if (!ctx) {
    throw new Error('usePowerPlant must be used within a PowerPlantProvider');
  }
  return ctx;
}
