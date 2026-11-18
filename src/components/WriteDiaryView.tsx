import React, { useEffect, useRef, useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import {
  formatStudyTime,
  generateWarmCheerMessage,
  getTodayStr,
} from '../lib/plantEngine';
import { MOOD_OPTIONS, MoodLabel, TabId } from '../types/powerplant';
import { PowerMascot } from './PowerPlantEmblem';

const QUICK_TAGS = [
  '한전 필기',
  'NCS 봉투모고',
  '전력시장·요금',
  '에너지고속도로',
  '면접 시사정리',
];

const DRAFT_KEY = 'powerplant_diary_draft_v1';

export const WriteDiaryView: React.FC<{
  targetDate?: string;
  onSavedNavigate?: (tab: TabId) => void;
}> = ({ targetDate, onSavedNavigate }) => {
  const {
    profile,
    diariesByDate,
    saveDiaryEntry,
    todayStudyMinutes,
    updateTodayStudyMinutes,
  } = usePowerPlant();

  const todayStr = getTodayStr();
  const activeDate = targetDate || todayStr;
  const isToday = activeDate === todayStr;
  const existingEntry = diariesByDate[activeDate];

  const initialMinutes = existingEntry
    ? existingEntry.studyMinutes
    : isToday
    ? todayStudyMinutes
    : 0;
  const initialMood: MoodLabel = existingEntry?.mood || '아이디어 번뜩';

  const [studyHours, setStudyHours] = useState(Math.floor(initialMinutes / 60));
  const [studyMins, setStudyMins] = useState(initialMinutes % 60);
  const [focusModule, setFocusModule] = useState(
    existingEntry?.focusModule || ''
  );
  const [selectedMood, setSelectedMood] = useState<MoodLabel>(initialMood);
  const [retrospective, setRetrospective] = useState(
    existingEntry?.retrospective || ''
  );
  const [cheerSeed, setCheerSeed] = useState(() => new Date().getDate());
  const [isCheerAuto, setIsCheerAuto] = useState(!existingEntry?.cheerNote);
  const [cheerNote, setCheerNote] = useState(
    existingEntry?.cheerNote || generateWarmCheerMessage(initialMood, new Date().getDate())
  );
  const [tags, setTags] = useState<string[]>(existingEntry?.tags || []);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
  }>({ visible: false, title: '', subtitle: '' });

  const lastHydratedKeyRef = useRef<string>('');

  // Hydrate form when switching activeDate or loading an existing diary
  useEffect(() => {
    const entryUpdated = existingEntry
      ? String(existingEntry.updatedAt || existingEntry.retrospective.length)
      : 'none';
    const hydrateKey = `${activeDate}::${existingEntry ? 'existing' : 'new'}::${entryUpdated}`;
    if (lastHydratedKeyRef.current === hydrateKey) return;
    lastHydratedKeyRef.current = hydrateKey;

    if (existingEntry) {
      setStudyHours(Math.floor(existingEntry.studyMinutes / 60));
      setStudyMins(existingEntry.studyMinutes % 60);
      setFocusModule(existingEntry.focusModule);
      setSelectedMood(existingEntry.mood);
      setRetrospective(existingEntry.retrospective);
      setCheerNote(
        existingEntry.cheerNote ||
          generateWarmCheerMessage(existingEntry.mood, cheerSeed)
      );
      setIsCheerAuto(!existingEntry.cheerNote);
      setTags(existingEntry.tags || []);
      setSaveError(null);
    } else {
      const draftRaw = localStorage.getItem(`${DRAFT_KEY}_${activeDate}`);
      if (draftRaw) {
        try {
          const d = JSON.parse(draftRaw);
          const mins =
            typeof d.studyMinutes === 'number'
              ? d.studyMinutes
              : isToday
              ? todayStudyMinutes
              : 0;
          const draftMood: MoodLabel = d.mood || '아이디어 번뜩';
          setStudyHours(Math.floor(mins / 60));
          setStudyMins(mins % 60);
          setFocusModule(d.focusModule || '');
          setSelectedMood(draftMood);
          setRetrospective(d.retrospective || '');
          setCheerNote(
            d.cheerNote || generateWarmCheerMessage(draftMood, cheerSeed)
          );
          setIsCheerAuto(!d.cheerNote);
          setTags(d.tags || []);
          return;
        } catch {
          // ignore
        }
      }
      const fallbackMins = isToday ? todayStudyMinutes : 0;
      setStudyHours(Math.floor(fallbackMins / 60));
      setStudyMins(fallbackMins % 60);
      setFocusModule('');
      setSelectedMood('아이디어 번뜩');
      setRetrospective('');
      setCheerNote(generateWarmCheerMessage('아이디어 번뜩', cheerSeed));
      setIsCheerAuto(true);
      setTags([]);
    }
  }, [activeDate, existingEntry, isToday, todayStudyMinutes, cheerSeed]);

  // Keep study time synced if changed externally (e.g. from Home modal)
  useEffect(() => {
    if (!isToday) return;
    const targetMins = existingEntry ? existingEntry.studyMinutes : todayStudyMinutes;
    setStudyHours(Math.floor(targetMins / 60));
    setStudyMins(targetMins % 60);
  }, [isToday, todayStudyMinutes, existingEntry]);

  // Keep quiet local backup while typing a new entry
  useEffect(() => {
    if (existingEntry) return;
    const totalMinutes = studyHours * 60 + studyMins;
    const timer = setTimeout(() => {
      if (totalMinutes > 0 || focusModule.trim() || retrospective.trim()) {
        localStorage.setItem(
          `${DRAFT_KEY}_${activeDate}`,
          JSON.stringify({
            studyMinutes: totalMinutes,
            focusModule,
            mood: selectedMood,
            retrospective,
            cheerNote: isCheerAuto ? '' : cheerNote,
            tags,
          })
        );
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    activeDate,
    existingEntry,
    studyHours,
    studyMins,
    focusModule,
    selectedMood,
    retrospective,
    cheerNote,
    isCheerAuto,
    tags,
  ]);

  if (!profile) return null;

  const activeMoodObj =
    MOOD_OPTIONS.find((m) => m.label === selectedMood) || MOOD_OPTIONS[1];
  const totalMinutes = Math.max(0, Math.min(960, studyHours * 60 + studyMins));
  const progressPercent = existingEntry
    ? 100
    : profile.storedKwh === 0
    ? 0
    : Math.min(95, Math.max(10, Math.round((profile.storedKwh / 365) * 100)));

  const syncStudyMinutesChange = (nextH: number, nextM: number) => {
    const clampedH = Math.max(0, Math.min(16, nextH));
    const clampedM = Math.max(0, Math.min(59, nextM));
    setStudyHours(clampedH);
    setStudyMins(clampedM);
    const total = Math.max(0, Math.min(960, clampedH * 60 + clampedM));
    if (isToday && !existingEntry) {
      void updateTodayStudyMinutes(total);
    }
  };

  const handleAddQuickStudy = (deltaMinutes: number) => {
    const nextTotal = Math.max(0, Math.min(960, totalMinutes + deltaMinutes));
    syncStudyMinutesChange(Math.floor(nextTotal / 60), nextTotal % 60);
  };

  const handleSelectMood = (mood: MoodLabel) => {
    setSelectedMood(mood);
    if (isCheerAuto) {
      setCheerNote(generateWarmCheerMessage(mood, cheerSeed));
    }
  };

  const handleRefreshWarmCheer = () => {
    const nextSeed = cheerSeed + 1;
    setCheerSeed(nextSeed);
    setIsCheerAuto(true);
    setCheerNote(generateWarmCheerMessage(selectedMood, nextSeed));
  };

  const handleAppendTag = (tagName: string) => {
    setFocusModule((prev) => {
      if (prev.includes(tagName)) return prev;
      return prev ? `${prev}, ${tagName}` : tagName;
    });
    setTags((prev) => (prev.includes(tagName) ? prev : [...prev, tagName].slice(0, 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSaveError(null);

    try {
      const minutes = totalMinutes > 0 ? totalMinutes : 60;
      const normalizedText = formatStudyTime(minutes);
      const finalCheer =
        cheerNote.trim() || generateWarmCheerMessage(selectedMood, cheerSeed);

      const result = await saveDiaryEntry({
        date: activeDate,
        studyMinutes: minutes,
        studyTimeText: normalizedText,
        focusModule: focusModule.trim() || '전공 및 NCS 학습',
        tags,
        mood: selectedMood,
        moodQuote: activeMoodObj.quote,
        retrospective:
          retrospective.trim() ||
          '오늘도 목표 공기업 합격을 향해 꾸준히 학습을 이어갔다.',
        cheerNote: finalCheer,
      });

      localStorage.removeItem(`${DRAFT_KEY}_${activeDate}`);

      setToastInfo({
        visible: true,
        title: result.isNewToday
          ? `일기 저장 & +1 kWh 충전 완료! Lv.${result.newLevel} 달성 🎉${
              result.streakBonus > 0 ? ` (+${result.streakBonus} kWh 스트릭 보너스!)` : ''
            }`
          : '일기 수정 내용이 바로 저장되었어요 ✓',
        subtitle: '기록달력과 홈 화면에 즉시 반영되었습니다.',
      });

      setTimeout(() => {
        setToastInfo((prev) => ({ ...prev, visible: false }));
      }, 2600);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? '저장 중 오류가 발생했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.'
          : '일기를 저장하지 못했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Top Motivation & Plant Energy Bar */}
      <section className="bg-surface-container-low rounded-xl p-space-md mb-space-lg shadow-sm">
        <div className="flex items-center justify-between gap-space-xs mb-space-sm">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm tracking-wide">
              {profile.streak}일 연속 가동 중
            </span>
            <span className="font-label-md text-label-md text-tertiary font-bold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[16px] text-tertiary-container icon-filled">
                bolt
              </span>
              Lv.{profile.level} → Lv.{Math.min(365, profile.level + (existingEntry ? 0 : 1))}{' '}
              {existingEntry ? '저장 완료' : '승급 대기'}
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-primary font-bold shrink-0">
            {isToday ? (existingEntry ? '저장 완료 ✓' : '오늘 기록') : `${activeDate}`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 mb-space-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-2 w-2 rounded-full bg-primary-container animate-ping shrink-0" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {existingEntry ? (
                  <>
                    저장 완료! <span className="text-primary font-bold">기록달력에 바로 반영되었어요</span>
                  </>
                ) : (
                  <>
                    오늘의 첫 일기를 저장하면 <span className="text-primary font-bold">+1 kWh</span>{' '}
                    즉시 충전!
                  </>
                )}
              </h2>
            </div>

            <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
              {existingEntry
                ? '내용을 고친 뒤 아래 "일기 수정하기" 버튼을 누르면 수정 내용이 즉시 반영됩니다.'
                : (
                  <>
                    저장 버튼을 누르면 즉시 발전소와 기록달력에 기록됩니다. 하루 미작성 시 전력량이{' '}
                    <span className="text-error font-bold">-1 kWh</span> 차감될 수 있어요!
                  </>
                )}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest/90 flex items-center justify-center shrink-0 shadow-xs">
            <PowerMascot pose="study" className="w-12 h-12" />
          </div>
        </div>

        <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden p-0.5">
          <div
            className="bg-primary-container h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5 font-label-sm text-label-sm text-secondary">
          <span>현재 보유 전력: {profile.storedKwh} kWh</span>
          {existingEntry && onSavedNavigate ? (
            <button
              type="button"
              onClick={() => onSavedNavigate('calendar')}
              className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>기록달력에서 보기</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          ) : (
            <span className="text-primary font-bold">
              목표: {profile.storedKwh + 1} kWh (+1.0)
            </span>
          )}
        </div>
      </section>

      {/* Editorial Style Banner */}
      <div className="flex items-center justify-center my-space-xs mb-space-lg">
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-[2px] bg-secondary-container" />
          <div className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg tracking-wider shadow-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
            {existingEntry ? '저장된 발전일지 수정' : '취준 발전일지 작성'}
          </div>
          <div className="flex-1 h-[2px] bg-secondary-container" />
        </div>
      </div>

      {/* Diary Form Section */}
      <form className="flex flex-col gap-space-lg" onSubmit={handleSubmit}>
        {/* Section 1: Study Time Tracker */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-on-surface text-surface-container-lowest font-label-sm text-label-sm px-2 py-0.5 rounded">
                공부 시간
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                오늘의 송전 시간 기록
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-tertiary bg-tertiary-fixed px-2 py-0.5 rounded-full font-bold">
              홈 화면 연동
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-sm text-label-sm text-secondary">
                  총 학습 시간 ({formatStudyTime(totalMinutes)})
                </span>
                <span className="font-label-sm text-label-sm text-primary font-bold">
                  목표 {Math.floor(profile.dailyGoalMinutes / 60)}시간
                  {profile.dailyGoalMinutes % 60 > 0 ? ` ${profile.dailyGoalMinutes % 60}분` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-surface-container-lowest rounded-md px-2.5 py-1 flex-1">
                  <input
                    aria-label="공부 시간"
                    type="number"
                    min={0}
                    max={16}
                    value={studyHours}
                    onChange={(e) =>
                      syncStudyMinutesChange(Number(e.target.value) || 0, studyMins)
                    }
                    className="w-full bg-transparent font-headline-md text-headline-md text-on-surface font-bold focus:outline-none"
                  />
                  <span className="font-label-sm text-label-sm text-secondary shrink-0">시간</span>
                </div>
                <div className="flex items-center gap-1 bg-surface-container-lowest rounded-md px-2.5 py-1 flex-1">
                  <input
                    aria-label="공부 분"
                    type="number"
                    min={0}
                    max={59}
                    value={studyMins}
                    onChange={(e) =>
                      syncStudyMinutesChange(studyHours, Number(e.target.value) || 0)
                    }
                    className="w-full bg-transparent font-headline-md text-headline-md text-on-surface font-bold focus:outline-none"
                  />
                  <span className="font-label-sm text-label-sm text-secondary shrink-0">분</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => handleAddQuickStudy(30)}
                  className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-bold hover:bg-primary-fixed transition-colors cursor-pointer"
                >
                  +30분
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuickStudy(60)}
                  className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-bold hover:bg-primary-fixed transition-colors cursor-pointer"
                >
                  +1시간
                </button>
              </div>
            </div>

            <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-center">
              <label
                htmlFor="study-focus"
                className="font-label-sm text-label-sm text-secondary mb-1"
              >
                집중 모듈
              </label>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[18px]">speed</span>
                <input
                  id="study-focus"
                  type="text"
                  value={focusModule}
                  onChange={(e) => setFocusModule(e.target.value)}
                  placeholder="예: NCS & 전공필기"
                  className="w-full bg-transparent font-label-md text-label-md text-on-surface font-semibold focus:outline-none truncate placeholder:text-secondary/50"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAppendTag(tag)}
                className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm hover:bg-primary-container hover:text-on-primary transition-colors cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Mood & Battery Selector */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="bg-on-surface text-surface-container-lowest font-label-sm text-label-sm px-2 py-0.5 rounded">
                내면 돌봄
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                오늘의 배터리 상태
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-primary font-bold">
              {selectedMood}!
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mb-space-md">
            취업 준비는 마라톤이에요. 마음의 잔여 배터리를 점검해주세요.
          </p>

          <div className="grid grid-cols-5 gap-1.5">
            {MOOD_OPTIONS.map((option) => {
              const active = option.label === selectedMood;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSelectMood(option.label)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                    active
                      ? 'bg-primary-fixed text-on-primary-fixed shadow-sm font-bold'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <span className="text-2xl mb-1">{option.emoji}</span>
                  <span className="font-label-sm text-label-sm text-on-surface text-center">
                    {option.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-space-sm p-space-sm bg-surface-container-low rounded-lg flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs p-0.5">
              <PowerMascot pose="bolt" className="w-full h-full" />
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">
              {activeMoodObj.quote}
            </span>
          </div>
        </div>

        {/* Section 3: Today's Retrospective */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-2">
              <span className="bg-on-surface text-surface-container-lowest font-label-sm text-label-sm px-2 py-0.5 rounded">
                발전 일지
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                오늘 하루 가동 회고
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">history_edu</span> 심층 복기
            </span>
          </div>

          <div className="bg-surface-container-low rounded-lg p-space-md">
            <label
              htmlFor="retrospective-input"
              className="block font-label-md text-label-md text-primary font-bold mb-1"
            >
              오늘 공부 &amp; 전력 뉴스 인사이트 정리
            </label>
            <textarea
              id="retrospective-input"
              rows={4}
              value={retrospective}
              onChange={(e) => setRetrospective(e.target.value)}
              placeholder="오늘 하루 어떤 공부를 진행했나요? 오늘 읽은 전력 뉴스나 오답 정리 내용을 자유롭게 적어보세요."
              className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg p-space-sm focus:outline-none placeholder:text-secondary/60 leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Section 4: Auto-Generated Warm Encouragement */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-space-sm">
            <div className="flex items-center gap-2">
              <span className="bg-on-surface text-surface-container-lowest font-label-sm text-label-sm px-2 py-0.5 rounded">
                자가 발전
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                내일의 나에게 보내는 전력 메시지
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefreshWarmCheer}
              className="px-2.5 py-1 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm font-bold hover:bg-primary-container hover:text-on-primary transition-colors cursor-pointer shrink-0"
            >
              다른 문구 ↻
            </button>
          </div>
          <div className="bg-tertiary-fixed/35 rounded-lg p-space-sm">
            <div className="flex items-start gap-2">
              <span className="text-xl mt-0.5">💌</span>
              <p className="w-full text-on-surface font-body-md text-body-md leading-relaxed font-medium">
                {cheerNote}
              </p>
            </div>
            <p className="mt-1.5 pl-7 font-label-sm text-label-sm text-secondary">
              오늘의 배터리 상태({selectedMood})에 맞춰 자동으로 생성된 따뜻한 응원 메시지예요
            </p>
          </div>
        </div>

        {/* Safeguard Notice */}
        <div className="bg-surface-container-high rounded-xl p-space-md flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-1.5">
              스마트 정전 방지 시스템 가동 중
            </span>
            <p className="font-body-sm text-body-sm text-secondary leading-snug mt-0.5">
              소중한 취준 일기 데이터는{' '}
              <span className="font-bold text-on-surface">
                Firestore 보안 데이터베이스에 안전하게 보존
              </span>
              됩니다.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          {saveError && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{saveError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-xl bg-primary-container text-on-primary font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,94,30,0.28)] hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70"
          >
            <span className="material-symbols-outlined text-[24px] icon-filled">
              {submitting ? 'sync' : existingEntry ? 'edit_note' : 'bolt'}
            </span>
            <span>
              {submitting
                ? '저장 중...'
                : existingEntry
                ? '일기 수정하기'
                : isToday
                ? '발전소 충전하고 일기 저장하기 (+1 kWh)'
                : '이 날짜 일기 저장하기'}
            </span>
          </button>

          <div className="flex items-center justify-between px-space-xs text-secondary font-label-sm text-label-sm">
            <div className="flex items-center gap-1.5 text-tertiary">
              <span className="w-2 h-2 rounded-full bg-primary-container" />
              <span>
                {existingEntry
                  ? '저장 완료 · 기록달력에 즉시 반영됨'
                  : '저장 즉시 기록달력과 홈에 바로 반영됩니다'}
              </span>
            </div>
            {existingEntry && onSavedNavigate && (
              <button
                type="button"
                onClick={() => onSavedNavigate('calendar')}
                className="text-primary font-bold hover:underline transition-colors cursor-pointer"
              >
                기록달력 보기 →
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Interactive Toast Notification */}
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] w-[420px] bg-inverse-surface text-inverse-on-surface px-space-md py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 z-50 ${
          toastInfo.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-4'
        }`}
      >
        <span className="material-symbols-outlined text-primary-fixed-dim text-[24px]">
          electric_meter
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-label-lg text-label-lg font-bold">{toastInfo.title}</span>
          <span className="font-body-sm text-body-sm text-secondary-container truncate">
            {toastInfo.subtitle}
          </span>
        </div>
      </div>
    </div>
  );
};

