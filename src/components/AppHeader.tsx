import React, { useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import { diffDays } from '../lib/plantEngine';
import { POWER_COMPANIES, TabId } from '../types/powerplant';
import { UserAvatarBadge } from './PowerPlantEmblem';

const TAB_SUBTITLES: Record<TabId, string> = {
  home: 'Home Dashboard',
  news: 'News Briefs',
  write: 'Write Diary',
  calendar: 'Record Calendar',
};

export const AppHeader: React.FC<{ activeTab: TabId }> = ({ activeTab }) => {
  const {
    profile,
    mode,
    firebaseUser,
    diariesByDate,
    signInWithGoogle,
    updatePreferences,
    logout,
    currentDate: todayStr,
  } = usePowerPlant();
  const [showNoti, setShowNoti] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [targetCompany, setTargetCompany] = useState(profile?.targetCompany || '한국전력공사');
  const [goalHours, setGoalHours] = useState(
    Math.round(((profile?.dailyGoalMinutes || 360) / 60) * 10) / 10
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const wroteToday = Boolean(diariesByDate[todayStr]);
  const storedKwh = profile?.storedKwh ?? 0;
  const inGrace = profile
    ? diffDays(profile.signupDate, todayStr) >= 0 &&
      diffDays(profile.signupDate, todayStr) <= 3
    : false;

  const isBlackout = storedKwh <= 0 && !inGrace;
  const statusText = isBlackout
    ? '블랙아웃 발생'
    : storedKwh <= 2 && !inGrace
    ? '정전 주의'
    : '정상 가동 중';

  const openProfile = () => {
    setTargetCompany(profile?.targetCompany || '한국전력공사');
    setGoalHours(Math.round(((profile?.dailyGoalMinutes || 360) / 60) * 10) / 10);
    setShowProfileModal(true);
    setShowNoti(false);
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      await updatePreferences({
        targetCompany,
        dailyGoalMinutes: Math.max(30, Math.min(960, Math.round(goalHours * 60))),
      });
      setShowProfileModal(false);
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(11,28,48,0.04)] pt-safe">
        <div className="h-16 px-margin max-w-[680px] mx-auto flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-[0_4px_12px_rgba(255,94,30,0.25)]">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                  발전소 키우기
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm shrink-0 flex items-center gap-1 ${
                    isBlackout
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-tertiary-fixed text-on-tertiary-fixed'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      isBlackout ? 'bg-error' : 'bg-tertiary-container'
                    }`}
                  />
                  {statusText}
                </span>
              </div>
              <span className="font-label-md text-label-md text-primary font-bold truncate">
                {TAB_SUBTITLES[activeTab]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-xs shrink-0">
            <button
              type="button"
              aria-label="에너지 알림"
              onClick={() => {
                setShowNoti((prev) => !prev);
                setShowProfileModal(false);
              }}
              className="relative w-11 h-11 flex items-center justify-center rounded-full text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {!wroteToday && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary-container" />
              )}
            </button>
            <button
              type="button"
              onClick={openProfile}
              aria-label="계정 및 목표 설정"
              className="rounded-full p-0.5 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <UserAvatarBadge
                photoUrl={firebaseUser?.photoURL}
                displayName={profile?.displayName}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Popover */}
      {showNoti && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setShowNoti(false)}
        >
          <div
            className="max-w-[680px] mx-auto px-margin pt-[72px] flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-80 bg-surface-container-lowest rounded-2xl p-4 shadow-xl border border-surface-container space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  전력망 상태 알림
                </span>
                <button
                  type="button"
                  onClick={() => setShowNoti(false)}
                  className="text-secondary hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-surface-container-low space-y-1">
                  <div className="font-label-md text-label-md text-primary font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    {wroteToday ? '오늘 발전 일기 완료!' : '오늘 일기 미작성 알림'}
                  </div>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {wroteToday
                      ? '오늘 +1 kWh 송전이 완료되어 발전소가 안정적으로 가동 중이에요.'
                      : '자정 전까지 오늘의 발전 일기를 작성해 +1 kWh를 충전하세요!'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-tertiary-fixed/40 space-y-1">
                  <div className="font-label-md text-label-md text-on-tertiary-fixed font-bold">
                    현재 보유 전력: {storedKwh} kWh
                  </div>
                  <p className="font-body-sm text-body-sm text-on-tertiary-fixed-variant">
                    {storedKwh > 0
                      ? `정전 위험까지 앞으로 ${storedKwh}일간 안전하게 버틸 수 있어요.`
                      : inGrace
                      ? '첫 일기를 작성하면 Lv.1 승급과 함께 +1 kWh가 저장돼요.'
                      : '저장 전력이 0 kWh입니다. 오늘 바로 일기를 써서 발전소를 복구하세요!'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Target Utility Modal */}
      {showProfileModal && profile && (
        <div
          className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatarBadge
                  photoUrl={firebaseUser?.photoURL}
                  displayName={profile.displayName}
                  sizeClass="w-11 h-11"
                />
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-surface">
                    {profile.displayName}
                  </div>
                  <div className="font-body-sm text-body-sm text-secondary">
                    {mode === 'firebase' ? profile.email : '체험 모드 (로컬 저장 중)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-secondary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {mode === 'guest' && (
              <div className="p-3 rounded-xl bg-primary-fixed/40 flex items-center justify-between gap-2">
                <span className="font-body-sm text-body-sm text-on-surface">
                  Google 계정을 연결하면 Firestore에 영구 저장돼요!
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    signInWithGoogle();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shrink-0"
                >
                  구글 연동
                </button>
              </div>
            )}

            <form onSubmit={handleSavePrefs} className="space-y-3">
              <div>
                <label className="block font-label-md text-label-md text-secondary mb-1">
                  목표 전력 공기업
                </label>
                <select
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none"
                >
                  {!(POWER_COMPANIES as readonly string[]).includes(targetCompany) &&
                    targetCompany && (
                      <option value={targetCompany}>{targetCompany}</option>
                    )}
                  {POWER_COMPANIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-label-md text-label-md text-secondary mb-1">
                  일일 목표 공부 시간 (시간)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  value={goalHours}
                  onChange={(e) => setGoalHours(parseFloat(e.target.value) || 6)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingPrefs}
                className="w-full h-11 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-sm cursor-pointer"
              >
                {savingPrefs ? '저장 중...' : '목표 설정 저장'}
              </button>
            </form>

            <button
              type="button"
              onClick={async () => {
                setShowProfileModal(false);
                await logout();
              }}
              className="w-full h-10 rounded-xl bg-surface-container-low text-secondary hover:text-error font-label-md text-label-md font-bold transition-colors cursor-pointer"
            >
              {mode === 'firebase' ? '로그아웃' : '온보딩 화면으로 돌아가기'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
