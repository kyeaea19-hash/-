import React, { useEffect, useMemo, useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import {
  formatLocalDate,
  getGridTierLabel,
  getTodayStr,
  isGracePeriodDate,
  parseDateStr,
} from '../lib/plantEngine';
import { MOOD_OPTIONS, TabId } from '../types/powerplant';
import { PowerMascot } from './PowerPlantEmblem';

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const RecordCalendarView: React.FC<{
  initialDate?: string;
  onEditDate: (dateStr: string) => void;
  onNavigate: (tab: TabId) => void;
}> = ({ initialDate, onEditDate }) => {
  const { profile, diariesByDate, updatePreferences } = usePowerPlant();
  const todayStr = getTodayStr();
  const focusDateStr = initialDate || todayStr;
  const focusDate = parseDateStr(focusDateStr);

  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(focusDateStr);
  const [reminderSavedToast, setReminderSavedToast] = useState(false);

  useEffect(() => {
    if (initialDate) {
      const parsed = parseDateStr(initialDate);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth() + 1);
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const monthData = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(formatLocalDate(new Date(viewYear, viewMonth - 1, d)));
    }
    return { daysInMonth, firstWeekday, days };
  }, [viewYear, viewMonth]);

  if (!profile) return null;

  const writtenInMonth = monthData.days.filter((d) => Boolean(diariesByDate[d])).length;
  const monthProgress = Math.round((writtenInMonth / monthData.daysInMonth) * 100);
  const monthKwh = monthData.days.reduce(
    (sum, d) => sum + (diariesByDate[d]?.kwhEarned ?? 0),
    0
  );

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectedEntry = diariesByDate[selectedDate];
  const selectedParsed = parseDateStr(selectedDate);
  const selectedWeekday = WEEKDAYS_KO[selectedParsed.getDay()];
  const selectedMoodObj = MOOD_OPTIONS.find((m) => m.label === selectedEntry?.mood);
  const inGrace = isGracePeriodDate(profile.signupDate, todayStr);

  const recentEntries = Object.values(diariesByDate)
    .filter((e) => e.date !== selectedDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4);

  const handleToggleReminder = async () => {
    await updatePreferences({ reminderEnabled: !profile.reminderEnabled });
    setReminderSavedToast(true);
    setTimeout(() => setReminderSavedToast(false), 2200);
  };

  const safetyLabel =
    profile.storedKwh >= 7 || inGrace
      ? '매우 낮음 (안전 지대)'
      : profile.storedKwh >= 2
      ? '보통 (꾸준한 충전 권장)'
      : '높음 (즉시 충전 필요)';

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Top Editorial Pill Header */}
      <div className="relative flex items-center justify-center my-space-md">
        <div className="absolute inset-x-0 h-2 bg-gradient-to-r from-transparent via-primary/20 to-transparent flex items-center justify-center">
          <div className="w-full border-t-2 border-dashed border-primary-container/40" />
        </div>
        <div className="relative z-10 px-5 py-1.5 rounded-full bg-primary-container text-on-primary shadow-[0_4px_14px_rgba(255,94,30,0.35)] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          <span className="font-headline-sm text-headline-sm tracking-tight">
            발전 캘린더 리포트
          </span>
        </div>
      </div>

      {/* Monthly Stats Bento Card */}
      <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm mb-space-md flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm">
              {viewYear}년 {viewMonth}월 리포트
            </span>
            <span className="flex items-center text-primary font-label-sm text-label-sm gap-0.5">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
              실시간 연동 중
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="이전 달"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container-low text-secondary hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-headline-sm text-headline-sm text-on-surface px-1">
              {viewMonth}월
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="다음 달"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container-low text-secondary hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="font-label-md text-label-md text-secondary">
              월간 누적 전력 생산 달성률
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg-mobile text-display-lg-mobile text-primary-container">
                {monthProgress}
              </span>
              <span className="font-label-md text-label-md text-primary">%</span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-tertiary-container via-primary-container to-primary rounded-full transition-all duration-700"
              style={{ width: `${monthProgress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-secondary font-label-sm text-label-sm">
            <span>목표 {monthData.daysInMonth} kWh</span>
            <span className="text-primary font-bold">{monthKwh} kWh 생산 완료</span>
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-lowest shadow-sm text-center">
            <span className="font-label-sm text-label-sm text-secondary">누적 발전량</span>
            <span className="font-headline-md text-headline-md text-on-surface mt-1">
              {profile.storedKwh}{' '}
              <span className="font-label-sm text-label-sm text-primary">kWh</span>
            </span>
            <span className="font-label-sm text-label-sm text-tertiary mt-0.5">
              {profile.storedKwh > 0 ? '⚡ 활력 우수' : '⚡ 시작 대기'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-lowest shadow-sm text-center">
            <span className="font-label-sm text-label-sm text-secondary">작성 일수</span>
            <span className="font-headline-md text-headline-md text-on-surface mt-1">
              {writtenInMonth}
              <span className="text-secondary font-body-sm text-body-sm">
                /{monthData.daysInMonth}일
              </span>
            </span>
            <span className="font-label-sm text-label-sm text-primary-container mt-0.5 font-bold">
              연속 {profile.streak}일째
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-lowest shadow-sm text-center">
            <span className="font-label-sm text-label-sm text-secondary">정전 횟수</span>
            <span className="font-headline-md text-headline-md text-on-surface mt-1">
              {profile.blackoutCount}{' '}
              <span className="font-label-sm text-label-sm text-secondary">회</span>
            </span>
            <span className="font-label-sm text-label-sm text-on-secondary-container mt-0.5">
              {profile.blackoutCount === 0 ? '무정전 운전' : '복구 가동 중'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary-container text-on-secondary-fixed gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary icon-filled shrink-0">
              verified
            </span>
            <span className="font-label-md text-label-md truncate">
              정전 위험률: <strong className="text-primary font-bold">{safetyLabel}</strong>
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm shrink-0">
            {getGridTierLabel(profile.level)}
          </span>
        </div>
      </section>

      {/* Power Plant Calendar Grid Section */}
      <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm mb-space-md">
        <div className="flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              electric_bolt
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              데일리 전력 잔디밭
            </h2>
          </div>
          <div className="flex items-center gap-2 text-secondary font-label-sm text-label-sm">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-container" /> 발전 성공
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim" /> 미가동
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center font-label-sm text-label-sm text-secondary mb-2">
          <span className="text-error">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-secondary">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {Array.from({ length: monthData.firstWeekday }).map((_, idx) => (
            <div key={`empty-${idx}`} className="p-1 min-h-[52px]" />
          ))}

          {monthData.days.map((dateStr, idx) => {
            const dayNum = idx + 1;
            const weekday = (monthData.firstWeekday + idx) % 7;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const hasEntry = Boolean(diariesByDate[dateStr]);
            const isGrace = isGracePeriodDate(profile.signupDate, dateStr);
            const isMissedPast =
              !isFuture && !isToday && !hasEntry && !isGrace && dateStr >= profile.signupDate;
            const isSelected = dateStr === selectedDate;

            const dayTextColor = isToday
              ? 'text-on-primary font-bold mt-1'
              : weekday === 0
              ? 'text-error'
              : weekday === 6
              ? 'text-secondary'
              : 'text-on-surface';

            if (isToday) {
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex flex-col items-center justify-center p-1 rounded-xl bg-primary-container text-on-primary shadow-[0_6px_16px_rgba(255,94,30,0.4)] scale-105 z-10 transition-transform min-h-[52px] cursor-pointer ${
                    isSelected ? 'ring-2 ring-on-surface/40' : ''
                  }`}
                >
                  <span className="absolute -top-1.5 px-1.5 py-0.2 rounded-full bg-surface-container-lowest text-primary font-label-sm text-[9px] shadow-sm font-bold">
                    오늘
                  </span>
                  <span className={`font-label-sm text-label-sm ${dayTextColor}`}>{dayNum}</span>
                  <span
                    className={`material-symbols-outlined text-[18px] text-on-primary icon-filled ${
                      hasEntry ? '' : 'animate-bounce'
                    }`}
                  >
                    bolt
                  </span>
                </button>
              );
            }

            if (isFuture) {
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled
                  className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface-container-low text-secondary/50 min-h-[52px]"
                >
                  <span className="font-label-sm text-label-sm">{dayNum}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/60 mt-2" />
                </button>
              );
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`relative flex flex-col items-center justify-center p-1 rounded-lg transition-all min-h-[52px] cursor-pointer active:scale-95 ${
                  hasEntry
                    ? 'bg-primary-fixed/40 hover:bg-primary-fixed/60'
                    : isMissedPast
                    ? 'bg-surface-container-high hover:bg-surface-dim opacity-80'
                    : 'bg-surface-container-low hover:bg-surface-container'
                } ${isSelected ? 'ring-2 ring-primary-container' : ''}`}
              >
                <span className={`font-label-sm text-label-sm ${dayTextColor}`}>{dayNum}</span>
                {hasEntry ? (
                  <span className="material-symbols-outlined text-[16px] text-primary-container icon-filled">
                    bolt
                  </span>
                ) : isMissedPast ? (
                  <span className="material-symbols-outlined text-[15px] text-outline">
                    battery_alert
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/50 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Detailed View of Selected Day */}
      <article className="rounded-xl bg-surface-container-lowest p-space-md shadow-md mb-space-md relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary-container to-tertiary-container" />

        <div className="flex items-center justify-between mt-1 mb-space-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedEntry ? (
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>+
                {selectedEntry.kwhEarned} kWh 발전 완료
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
                미작성일
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm">
              {selectedEntry?.targetCompany || profile.targetCompany} 목표반
            </span>
          </div>
          <button
            type="button"
            onClick={() => onEditDate(selectedDate)}
            className="text-secondary hover:text-primary transition-colors flex items-center gap-0.5 font-label-sm text-label-sm cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            {selectedEntry ? '수정' : '작성'}
          </button>
        </div>

        <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-2">
          {selectedParsed.getFullYear()}년 {selectedParsed.getMonth() + 1}월{' '}
          {selectedParsed.getDate()}일 ({selectedWeekday}요일)
        </h3>

        {selectedEntry ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-space-md">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] text-tertiary icon-filled">
                  bolt
                </span>
                기분:{' '}
                <strong className="font-bold">
                  {selectedMoodObj?.emoji || '⚡'} {selectedEntry.mood}
                </strong>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  schedule
                </span>
                총 순공:{' '}
                <strong className="font-bold text-primary">
                  {selectedEntry.studyTimeText}
                </strong>
              </div>
            </div>

            <div className="p-space-sm rounded-xl bg-surface-container-low mb-space-sm">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-1.5">
                오늘 집중 전력 투입 모듈
              </span>
              <div className="p-2.5 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2">
                <span className="font-label-md text-label-md flex items-center gap-1.5 text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-primary-container shrink-0" />
                  {selectedEntry.focusModule}
                </span>
                <span className="font-label-md text-label-md font-bold text-primary shrink-0">
                  {selectedEntry.studyTimeText}
                </span>
              </div>
            </div>

            <div className="p-space-md rounded-xl bg-primary-fixed/20 text-on-surface mb-space-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-primary font-label-lg text-label-lg">
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                  오늘의 발전 회고
                </div>
                <PowerMascot pose="study" className="w-11 h-11 shrink-0" />
              </div>
              <p className="font-body-md text-body-md leading-relaxed text-on-surface whitespace-pre-line">
                "{selectedEntry.retrospective}"
              </p>
            </div>

            <div className="p-space-sm rounded-xl bg-secondary-container/60 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm p-1">
                <PowerMascot pose="cheer" className="w-full h-full" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-secondary">나에게 한마디</span>
                <span className="font-label-lg text-label-lg text-on-surface font-bold">
                  "{selectedEntry.cheerNote}"
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-xl bg-surface-container-low text-center space-y-2.5">
            <p className="font-body-md text-body-md text-secondary">
              {selectedDate === todayStr
                ? '아직 오늘의 발전 일기를 작성하지 않았어요. 지금 기록하고 +1 kWh를 충전해 보세요!'
                : '해당 날짜에 작성된 발전 일기가 없습니다.'}
            </p>
            <button
              type="button"
              onClick={() => onEditDate(selectedDate)}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-sm cursor-pointer"
            >
              {selectedDate === todayStr ? '오늘 일기 작성하기 ⚡' : '이 날짜 기록 추가하기'}
            </button>
          </div>
        )}
      </article>

      {/* Previous History Accordion Timeline */}
      {recentEntries.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[20px]">history</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                이전 발전 타임라인
              </h3>
            </div>
            <span className="font-label-sm text-label-sm text-secondary">
              최근 {recentEntries.length}일 기록
            </span>
          </div>

          {recentEntries.map((entry) => {
            const d = parseDateStr(entry.date);
            const wd = WEEKDAYS_KO[d.getDay()];
            const moodObj = MOOD_OPTIONS.find((m) => m.label === entry.mood);
            return (
              <details
                key={entry.date}
                className="group rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-all open:shadow-md cursor-pointer"
              >
                <summary className="flex items-center justify-between list-none select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary-container flex items-center justify-center shrink-0 font-bold">
                      <span className="material-symbols-outlined text-[20px]">bolt</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-label-lg text-label-lg text-on-surface font-bold">
                          {d.getMonth() + 1}월 {d.getDate()}일 ({wd})
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold">
                          +{entry.kwhEarned} kWh
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-secondary truncate mt-0.5">
                        {entry.focusModule}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-secondary group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>

                <div className="pt-space-md mt-space-sm text-body-md text-on-surface flex flex-col gap-2">
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex justify-between font-label-md text-label-md">
                    <span className="text-secondary">학습 시간</span>
                    <span className="font-bold text-on-surface">
                      {entry.studyTimeText} · 기분 {moodObj?.emoji || '⚡'} {entry.mood}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {entry.retrospective}
                  </p>
                </div>
              </details>
            );
          })}
        </section>
      )}

      {/* Motivational Floating Call-to-Action */}
      <aside className="mt-space-md p-space-md rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-[0_8px_24px_rgba(255,94,30,0.25)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-surface-container-lowest text-primary-container flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-lg text-label-lg font-bold">내일 전력 가동 예약</span>
            <span className="font-body-sm text-body-sm text-on-primary/90 truncate">
              {profile.reminderEnabled
                ? `매일 자정 전 가동 알림 켜짐 (${profile.streak + 1}일 연속 도전!)`
                : '연속 발전 시 보너스 kWh와 터빈 배지를 획득해요!'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleReminder}
          className="px-3.5 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md font-bold shrink-0 hover:bg-surface-container transition-transform active:scale-95 shadow-sm cursor-pointer"
        >
          {reminderSavedToast
            ? '저장됨 ✓'
            : profile.reminderEnabled
            ? '알림 켜짐 ✓'
            : '알림 설정'}
        </button>
      </aside>
    </div>
  );
};
