import React, { useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import { FALLBACK_INTERVIEW_TIPS } from '../data/newsData';
import {
  getPlantTierName,
  isGracePeriodDate,
} from '../lib/plantEngine';
import { NewsArticle, POWER_COMPANIES, TabId } from '../types/powerplant';
import { NewsDetailModal } from './NewsDetailModal';
import { NewsVisualBanner, PowerMascot } from './PowerPlantEmblem';

export const HomeDashboard: React.FC<{ onNavigate: (tab: TabId) => void }> = ({
  onNavigate,
}) => {
  const {
    profile,
    diariesByDate,
    blackoutBanner,
    dismissBlackoutBanner,
    liveNews,
    newsLoading,
    newsError,
    fetchLiveNews,
    todayStudyMinutes,
    updateTodayStudyMinutes,
    updatePreferences,
    currentDate: todayStr,
  } = usePowerPlant();
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);

  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [modalStudyH, setModalStudyH] = useState(0);
  const [modalStudyM, setModalStudyM] = useState(0);
  const [modalGoalH, setModalGoalH] = useState(6);
  const [modalGoalM, setModalGoalM] = useState(0);
  const [savingStudyGoal, setSavingStudyGoal] = useState(false);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [modalCompany, setModalCompany] = useState(profile?.targetCompany || '한국전력공사');
  const [savingCompany, setSavingCompany] = useState(false);

  if (!profile) return null;

  const todayDiary = diariesByDate[todayStr];
  const inGrace = isGracePeriodDate(profile.signupDate, todayStr);
  const isBlackout = profile.storedKwh <= 0 && !inGrace;
  const plantTierName = getPlantTierName(profile.level);
  const kwhPercent =
    profile.storedKwh === 0
      ? 0
      : Math.max(2, Math.min(100, Math.round((profile.storedKwh / 365) * 100)));

  const todayMinutes = todayStudyMinutes;
  const todayH = Math.floor(todayMinutes / 60);
  const todayM = todayMinutes % 60;
  const goalH = Math.floor(profile.dailyGoalMinutes / 60);
  const goalM = profile.dailyGoalMinutes % 60;
  const goalLabel = goalM > 0 ? `${goalH}시간 ${goalM}분` : `${goalH}시간`;
  const remainingMinutes = Math.max(0, profile.dailyGoalMinutes - todayMinutes);
  const remH = Math.floor(remainingMinutes / 60);
  const remM = remainingMinutes % 60;

  const openStudyGoalModal = () => {
    setModalStudyH(Math.floor(todayMinutes / 60));
    setModalStudyM(todayMinutes % 60);
    setModalGoalH(Math.floor(profile.dailyGoalMinutes / 60));
    setModalGoalM(profile.dailyGoalMinutes % 60);
    setStudyModalOpen(true);
  };

  const handleAddModalStudy = (deltaMinutes: number) => {
    const total = Math.max(0, Math.min(960, modalStudyH * 60 + modalStudyM + deltaMinutes));
    setModalStudyH(Math.floor(total / 60));
    setModalStudyM(total % 60);
  };

  const handleSaveStudyGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingStudyGoal) return;
    setSavingStudyGoal(true);
    try {
      const nextStudyMinutes = Math.max(0, Math.min(960, modalStudyH * 60 + modalStudyM));
      const nextGoalMinutes = Math.max(30, Math.min(960, modalGoalH * 60 + modalGoalM));
      await updatePreferences({ dailyGoalMinutes: nextGoalMinutes });
      await updateTodayStudyMinutes(nextStudyMinutes);
      setStudyModalOpen(false);
    } finally {
      setSavingStudyGoal(false);
    }
  };

  const openCompanyModal = () => {
    setModalCompany(profile.targetCompany || '한국전력공사');
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCompany) return;
    const trimmed = modalCompany.trim();
    if (!trimmed) return;
    setSavingCompany(true);
    try {
      await updatePreferences({ targetCompany: trimmed });
      setCompanyModalOpen(false);
    } finally {
      setSavingCompany(false);
    }
  };

  const nextMilestone = Math.ceil((profile.streak + 1) / 14) * 14;
  const daysToBonus = Math.max(1, nextMilestone - profile.streak);

  const featuredArticles = (liveNews?.articles || []).slice(0, 2);
  const tipsPool =
    liveNews?.interviewTips && liveNews.interviewTips.length > 0
      ? liveNews.interviewTips
      : FALLBACK_INTERVIEW_TIPS;
  const currentTip = tipsPool[tipIndex % tipsPool.length];
  const savedDiaryCount = Math.max(profile.totalDiaries, Object.keys(diariesByDate).length);

  const handleCardPulse = () => {
    setPulseActive(true);
    setTimeout(() => setPulseActive(false), 180);
  };

  const targetCompanyModal = companyModalOpen ? (
    <div
      className="fixed inset-0 z-50 bg-on-surface/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => setCompanyModalOpen(false)}
    >
      <div
        className="w-full max-w-[440px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              apartment
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              목표 전력 공기업 설정
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCompanyModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-surface-container text-secondary cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">
              주요 전력 공기업 빠른 선택
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POWER_COMPANIES.map((company) => {
                const active = modalCompany.trim() === company;
                return (
                  <button
                    key={company}
                    type="button"
                    onClick={() => setModalCompany(company)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary-container text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:text-on-surface'
                    }`}
                  >
                    {company}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="target-company-input"
              className="block font-label-md text-label-md text-secondary"
            >
              직접 입력 (최대 60자)
            </label>
            <input
              id="target-company-input"
              type="text"
              maxLength={60}
              value={modalCompany}
              onChange={(e) => setModalCompany(e.target.value)}
              placeholder="목표 공기업 이름을 입력하세요"
              className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary-container/30"
            />
          </div>

          <button
            type="submit"
            disabled={savingCompany || !modalCompany.trim()}
            className="w-full h-12 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-[0_8px_20px_rgba(255,94,30,0.24)] cursor-pointer disabled:opacity-60"
          >
            {savingCompany ? '저장 중...' : '목표 공기업 저장하기'}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  if (isBlackout) {
    const prevLevel = profile.level + (profile.blackoutCount > 0 ? 10 : 0);
    return (
      <div className="flex flex-col w-full pb-8">
        {/* Emergency Alert Banner */}
        <div className="w-full bg-error text-on-error rounded-xl p-space-md mb-space-md shadow-lg flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-space-sm min-w-0">
            <span className="material-symbols-outlined text-[24px] shrink-0">warning</span>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm">비상 경보 : 블랙아웃 발생</span>
              <span className="font-body-sm text-body-sm opacity-90">
                발전소 출력 저하로 주 계통이 차단되었습니다
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-on-error text-error font-label-sm text-label-sm font-bold uppercase tracking-wider shrink-0">
            오프라인
          </span>
        </div>

        {/* Dimmed Plant Visual & Status Card */}
        <div className="relative w-full rounded-xl bg-inverse-surface text-inverse-on-surface overflow-hidden shadow-xl mb-space-md p-space-lg flex flex-col items-center">
          <div className="absolute inset-0 bg-gradient-to-b from-error/15 via-transparent to-black/60 pointer-events-none" />

          <div className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md mb-space-md">
            <span className="w-2 h-2 rounded-full bg-error animate-ping" />
            <span className="font-label-sm text-label-sm text-error-container font-bold">
              비상 보조 전원 작동 중 (냉각 모드)
            </span>
          </div>

          <div className="relative z-10 w-full flex flex-col items-center justify-center my-space-sm">
            <div className="relative w-28 h-28 rounded-full bg-surface-container-lowest/5 flex items-center justify-center shadow-inner">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  fill="none"
                  opacity="0.3"
                  r="42"
                  stroke="#390c00"
                  strokeDasharray="264"
                  strokeDashoffset="0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  fill="none"
                  r="42"
                  stroke="#ba1a1a"
                  strokeDasharray="264"
                  strokeDashoffset="258"
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <div className="flex flex-col items-center">
                <PowerMascot pose="blackout" className="w-16 h-16" />
                <span className="font-label-sm text-[10px] text-outline-variant -mt-1 tracking-tight">
                  전력 차단됨
                </span>
              </div>
            </div>

            <div className="mt-space-md text-center">
              <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                {profile.blackoutCount > 0 && prevLevel > profile.level ? (
                  <>
                    <span className="font-label-lg text-label-lg px-2.5 py-0.5 rounded-full bg-surface-container-lowest/10 text-outline-variant line-through decoration-error">
                      Lv.{prevLevel} {getPlantTierName(prevLevel)}
                    </span>
                    <span className="material-symbols-outlined text-error text-[18px]">
                      arrow_forward
                    </span>
                    <span className="font-label-lg text-label-lg px-2.5 py-0.5 rounded-full bg-error/20 text-error-container font-bold">
                      Lv.{profile.level} (10단계 하향)
                    </span>
                  </>
                ) : (
                  <span className="font-label-lg text-label-lg px-2.5 py-0.5 rounded-full bg-error/20 text-error-container font-bold">
                    Lv.{profile.level} {plantTierName}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-display-lg-mobile text-display-lg-mobile text-error font-extrabold tracking-tight">
                  0
                </span>
                <span className="font-headline-sm text-headline-sm text-outline-variant">
                  / 365 kWh
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-outline-variant mt-1">
                연속 미기록 누적으로 인한 계통 전력 고갈
              </p>
              <button
                type="button"
                onClick={openCompanyModal}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-lowest/10 text-inverse-on-surface font-label-sm text-label-sm hover:bg-surface-container-lowest/20 transition-colors cursor-pointer"
              >
                <span>GRID STATUS · 목표 공기업: {profile.targetCompany}</span>
                <span className="material-symbols-outlined text-[13px]">edit</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('write')}
            className="relative z-10 w-full mt-space-md flex items-center justify-center gap-2 py-3.5 px-space-md rounded-xl bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-[0_8px_24px_rgba(255,94,30,0.35)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">flash_on</span>
            <span>비상 발전기 수동 가동 (일기 작성)</span>
          </button>
          <span className="relative z-10 font-label-sm text-label-sm text-outline-variant mt-2 text-center">
            지금 일기를 1편 작성하면 즉시{' '}
            <strong className="text-tertiary-fixed font-bold">정전 해제 &amp; +1 kWh 충전</strong>
            됩니다.
          </span>
        </div>

        {/* Safe Vault Guarantee Card */}
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-md mb-space-md shadow-sm flex items-start gap-space-sm">
          <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                작성 데이터는 100% 안전합니다
              </span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-secondary font-label-sm text-label-sm">
                영구 보존
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              정전 페널티로 발전소 등급만 일시 재조정될 뿐, 회원님이 그동안 정성껏 기록하신{' '}
              <strong>취준 일기 {savedDiaryCount}편</strong>의 데이터는 보안 데이터베이스에 고스란히
              보관되어 있습니다.
            </p>
          </div>
        </div>

        {/* Blackout Penalty & Recovery Protocol Breakdown */}
        <div className="w-full bg-surface-container-low rounded-xl p-space-md mb-space-md shadow-sm">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              정전 발생 규정 및 복구 프로토콜
            </span>
            <span className="font-label-md text-label-md text-primary font-bold">
              운영 수칙 4조
            </span>
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-lowest/60">
              <div className="w-6 h-6 rounded-full bg-error-container text-on-error-container flex items-center justify-center font-label-md text-label-md shrink-0 font-bold">
                1
              </div>
              <div className="flex-1">
                <span className="font-label-lg text-label-lg text-on-surface">정전 발생 원인</span>
                <p className="font-body-sm text-body-sm text-secondary">
                  기록 공백기 동안 일일 전력 자연 방전(-1 kWh/일)이 누적되어 주 전력량이 0 kWh에
                  도달했습니다.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-lowest/60">
              <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-label-md text-label-md shrink-0 font-bold">
                2
              </div>
              <div className="flex-1">
                <span className="font-label-lg text-label-lg text-on-surface">안전 페널티 적용</span>
                <p className="font-body-sm text-body-sm text-secondary">
                  발전 터빈 과열 방지를 위해 시설 등급이 -10단계 조정되었으며, 현재 전력량은 0 kWh로
                  초기화되었습니다.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-lowest/60">
              <div className="w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-label-md text-label-md shrink-0 font-bold">
                3
              </div>
              <div className="flex-1">
                <span className="font-label-lg text-label-lg text-on-surface">즉시 복구 메커니즘</span>
                <p className="font-body-sm text-body-sm text-secondary">
                  오늘 자 취준 일기를 1문장이라도 작성해 저장하면 점화 스파크가 튀며 즉시 계통이
                  재연결됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Warm Human Encouragement Note */}
        <div className="w-full bg-tertiary-fixed/30 rounded-xl p-space-md mb-space-md shadow-sm flex items-start gap-space-sm">
          <span className="text-[26px] select-none">🕯️</span>
          <div className="flex-1">
            <span className="font-headline-sm text-headline-sm text-on-tertiary-fixed">
              취준의 길목, 잠시 꺼진 불빛일 뿐이에요
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              공기업 채용 시즌을 달리다 보면 누구에게나 예고 없는 방전과 번아웃이 찾아옵니다.
              자책하지 마세요. 거대한 발전소도 정기 정비를 거친 후 더 강력한 에너지를 냅니다.
              오늘의 짧은 생각 한 줄로 다시 불을 지펴보세요!
            </p>
          </div>
        </div>

        {/* Uninterrupted Live Industry News */}
        <div className="w-full flex flex-col gap-space-sm mb-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">feed</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                정전 중에도 전력 뉴스는 계속 공급됩니다
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('news')}
              className="font-label-md text-label-md text-primary font-bold cursor-pointer"
            >
              전체보기
            </button>
          </div>

          {newsLoading && featuredArticles.length === 0 && (
            <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm animate-pulse space-y-2">
              <div className="h-4 w-24 bg-surface-container rounded" />
              <div className="h-5 w-3/4 bg-surface-container rounded" />
            </div>
          )}

          {featuredArticles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => setSelectedArticle(article)}
              className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex gap-space-sm text-left hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm">
                    {article.company}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    {article.publishedLabel}
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                  {article.title}
                </h3>
                <p className="font-body-sm text-body-sm text-secondary line-clamp-2 mt-1">
                  {article.intro || article.bullets[0] || article.subtitle}
                </p>
              </div>
              <NewsVisualBanner theme={article.visualTheme} compact />
            </button>
          ))}
        </div>

        {/* Sticky Action Drawer */}
        <div className="w-full rounded-xl bg-surface-container-high p-space-md flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-error font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-error" /> 가동 정지 상태
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              5분 만에 전력망 되살리기
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('write')}
            className="px-space-md py-2.5 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-md active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
          >
            <span>일기 쓰기</span>
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>

        <NewsDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
        {targetCompanyModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-8 space-y-6">
      {blackoutBanner && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] mt-0.5">warning</span>
            <div className="text-body-sm font-body-sm">
              <strong className="font-bold block">
                {blackoutBanner.blackoutOccurred
                  ? '정전이 발생해 발전소 단계가 10단계 하락했어요!'
                  : `미작성으로 인해 저장 전력 -${blackoutBanner.kwhLost} kWh가 차감되었어요.`}
              </strong>
              <span>오늘 일기를 작성해 발전소를 다시 힘차게 가동해 보세요!</span>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissBlackoutBanner}
            className="text-on-error-container/80 hover:text-on-error-container"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* 1. 발전소 상태 & 레벨 카드 */}
      <section
        onClick={handleCardPulse}
        className={`bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-4 transition-transform duration-150 cursor-pointer ${
          pulseActive ? 'scale-[0.99]' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping" />
              <span>
                {profile.storedKwh > 0 || inGrace
                  ? '⚡ 정상 가동 중 (안전율 100%)'
                  : '⚠️ 정전 경보! 즉시 전력 충전 필요'}
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Lv.{profile.level} {plantTierName}
            </h2>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5">
              매일 작성하는 취준 일기가 청정 터빈을 돌립니다
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary-container/40 flex items-center justify-center text-primary-container shrink-0">
            <span className="material-symbols-outlined text-[28px] icon-filled">solar_power</span>
          </div>
        </div>

        {/* 발전소 비주얼 그래픽 배너 (클릭 시 목표 공기업 설정) */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            openCompanyModal();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              openCompanyModal();
            }
          }}
          className="relative w-full rounded-xl overflow-hidden bg-gradient-to-r from-surface-container-high to-surface-container-low p-4 flex items-center justify-between gap-3 hover:ring-2 hover:ring-primary-container/30 transition-all cursor-pointer"
        >
          <div className="space-y-1 z-10 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
                GRID STATUS
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container-lowest/80 text-primary font-label-sm text-[10px] font-bold">
                목표 변경
                <span className="material-symbols-outlined text-[11px]">edit</span>
              </span>
            </div>
            <div className="font-headline-sm text-headline-sm text-on-surface">
              {profile.storedKwh > 0 ? (
                <>
                  정전 위험까지 앞으로{' '}
                  <span className="text-primary-container font-extrabold">
                    {profile.storedKwh}일
                  </span>{' '}
                  안전!
                </>
              ) : (
                <>
                  첫 발전 일기로{' '}
                  <span className="text-primary-container font-extrabold">Lv.1</span>을
                  시작해 보세요!
                </>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-secondary truncate">
              목표 공기업: <strong className="text-on-surface">{profile.targetCompany}</strong>
            </p>
            <p className="font-label-sm text-[11px] text-secondary/80">
              안전 일수(저장 전력량)는 매일 밤 24:00 갱신
            </p>
          </div>
          <div className="w-16 h-16 rounded-full bg-surface-container-lowest/90 flex items-center justify-center shadow-sm shrink-0">
            <PowerMascot
              pose={profile.storedKwh > 0 ? 'cheer' : 'bolt'}
              className="w-14 h-14"
            />
          </div>
        </div>

        {/* 전력 게이지 & 룰 툴팁 모듈 */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-end font-label-md text-label-md">
            <span className="text-on-surface font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary-container">
                battery_charging_full
              </span>
              누적 저장 전력량
            </span>
            <span className="text-secondary">
              <strong className="text-primary-container text-headline-sm font-headline-sm">
                {profile.storedKwh}
              </strong>{' '}
              / 365 kWh
            </span>
          </div>

          <div className="w-full h-3.5 bg-surface-container rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-primary-container to-tertiary-container rounded-full transition-all duration-700 ease-out"
              style={{ width: `${kwhPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">
              info
            </span>
            <span>
              하루 미작성 시 <strong className="text-error">-1 kWh</strong> 차감 • 0 kWh 도달 시
              발전소 단계 <strong className="text-error">-10 하락</strong>
            </span>
          </div>
        </div>
      </section>

      {/* 2. 오늘의 핵심 액션 카드 */}
      <section className="bg-surface-container-lowest rounded-xl p-5 shadow-sm relative overflow-hidden space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">
            {todayDiary ? '✓' : '!'}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            오늘의 전력 공급 액션
          </h3>
        </div>

        {todayDiary ? (
          <>
            <div className="p-3.5 rounded-lg bg-tertiary-fixed/40 space-y-1">
              <p className="font-label-lg text-label-lg text-on-surface">
                오늘의 발전 일기를 완료해 +1 kWh 송전을 마쳤어요! ⚡
              </p>
              <div className="flex items-center gap-2 text-tertiary font-label-md text-label-md font-bold">
                <span>오늘 공부 {todayDiary.studyTimeText}</span>
                <span>•</span>
                <span>{todayDiary.mood}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('write')}
              className="w-full h-12 bg-surface-container-low text-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
              <span>오늘의 발전 일기 다시 보기 / 수정하기</span>
            </button>
          </>
        ) : (
          <>
            <div className="p-3.5 rounded-lg bg-primary-fixed/30 space-y-1">
              <p className="font-label-lg text-label-lg text-on-surface">
                오늘의 발전 일기를 쓰고 1단계를 즉시 업그레이드하세요!
              </p>
              <div className="flex items-center gap-2 text-primary font-label-md text-label-md font-bold flex-wrap">
                <span>+1 kWh 전력 충전</span>
                <span>•</span>
                <span>+1 레벨 UP</span>
                <span>•</span>
                <span>하루 1회 한정</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('write')}
              className="w-full h-12 bg-primary-container text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,94,30,0.24)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">edit_square</span>
              <span>오늘의 발전 일기 쓰기</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </>
        )}
      </section>

      {/* 3. 오늘 나의 취준 현황 미니 트래커 */}
      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={openStudyGoalModal}
          className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col justify-between text-left hover:ring-2 hover:ring-primary-container/30 active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1 text-secondary font-label-sm text-label-sm w-full">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary-container">
                timer
              </span>
              <span>오늘 집중 시간</span>
            </div>
            <span className="material-symbols-outlined text-[15px] text-primary">tune</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-lg text-headline-lg text-on-surface">{todayH}</span>
            <span className="font-label-md text-label-md text-secondary">시간</span>
            <span className="font-headline-lg text-headline-lg text-on-surface ml-1">
              {String(todayM).padStart(2, '0')}
            </span>
            <span className="font-label-md text-label-md text-secondary">분</span>
          </div>
          <div className="mt-2 text-primary font-label-sm text-label-sm">
            {remainingMinutes === 0
              ? `일일 목표 ${goalLabel} 달성 완료!`
              : `목표 ${goalLabel}까지 ${remH}시간 ${remM}분 남음`}
          </div>
        </button>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px] text-tertiary-container">
              local_fire_department
            </span>
            <span>연속 기록 스트릭</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-lg text-headline-lg text-primary-container font-extrabold">
              {profile.streak}
            </span>
            <span className="font-label-md text-label-md text-secondary">일째 연속 달성 중</span>
          </div>
          <div className="mt-2 text-secondary font-label-sm text-label-sm">
            연속 {nextMilestone}일 달성 시 보너스 +5kWh ({daysToBonus}일 남음)
          </div>
        </div>
      </section>

      {/* 4. 오늘의 전력·에너지 3줄 뉴스 */}
      <section className="space-y-4">
        <div className="relative flex items-center justify-center my-3">
          <div className="w-full h-3 rounded-full opacity-35 bg-[repeating-linear-gradient(45deg,#ff5e1e,#ff5e1e_4px,transparent_4px,transparent_8px)]" />
          <div className="absolute px-5 py-1.5 rounded-full bg-primary-container text-on-primary font-headline-sm text-headline-sm font-black shadow-md flex items-center gap-1.5 tracking-tight">
            <span>⚡ 오늘의 전력 3줄 뉴스</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
            <span>{liveNews?.displayDate || '오늘'}의 전력 헤드라인</span>
            <span className="text-primary-container">📢</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('news')}
            className="font-label-md text-label-md text-secondary hover:text-primary flex items-center cursor-pointer"
          >
            <span>전체보기</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {newsLoading && featuredArticles.length === 0 && (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-3 animate-pulse"
              >
                <div className="h-4 w-24 bg-surface-container rounded" />
                <div className="h-6 w-3/4 bg-surface-container rounded" />
                <div className="h-24 w-full bg-surface-container-low rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {!newsLoading && !newsError && featuredArticles.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm text-center space-y-2">
            <p className="font-body-sm text-body-sm text-secondary">
              오늘의 전력·에너지 뉴스를 가져오는 중이에요.
            </p>
            <button
              type="button"
              onClick={() => fetchLiveNews({ category: '전체', refresh: true })}
              className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold cursor-pointer"
            >
              오늘의 헤드라인 불러오기
            </button>
          </div>
        )}

        {newsError && featuredArticles.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm text-center space-y-2">
            <p className="font-body-sm text-body-sm text-secondary">{newsError}</p>
            <button
              type="button"
              onClick={() => fetchLiveNews({ category: '전체', refresh: true })}
              className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold cursor-pointer"
            >
              오늘의 뉴스 다시 불러오기
            </button>
          </div>
        )}

        {featuredArticles.map((article, idx) => (
          <article
            key={article.id}
            className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 bg-on-surface text-surface-container-lowest rounded font-label-sm text-label-sm font-bold tracking-tight">
                {article.company}
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                {article.publishedLabel}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                {article.title}
              </h4>
              <p className="font-body-sm text-body-sm text-secondary">{article.subtitle}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-container-low space-y-2">
              {article.bullets.map((bullet, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                      idx === 0 ? 'bg-primary-container' : 'bg-tertiary-container'
                    }`}
                  />
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-1 flex items-center justify-between text-body-sm font-body-sm gap-2">
              <span className="text-secondary truncate">출처: {article.sourceName}</span>
              <button
                type="button"
                onClick={() => setSelectedArticle(article)}
                className="text-primary font-bold hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
              >
                <span>자세히 보기</span>
                <span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* 면접/필기 대비 한 줄 암기 팁 */}
      <aside className="p-4 rounded-xl bg-primary-fixed/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-label-md text-label-md text-primary font-bold">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            <span>전력공기업 면접 1분 한 줄 상식</span>
          </div>
          <button
            type="button"
            onClick={() => setTipIndex((prev) => prev + 1)}
            className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-bold shadow-xs hover:bg-surface-container transition-colors cursor-pointer"
          >
            다음 상식 ↻
          </button>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
          <strong>{currentTip.question}</strong>
          <br />
          {currentTip.answer}
        </p>
      </aside>

      <NewsDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />

      {/* 오늘 집중 시간 & 목표 시간 설정 모달 */}
      {studyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-on-surface/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setStudyModalOpen(false)}
        >
          <div
            className="w-full max-w-[440px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container text-[22px]">
                  timer
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  오늘 집중 시간 &amp; 목표 설정
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStudyModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-container text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStudyGoal} className="space-y-4">
              {/* 오늘 집중(공부) 시간 */}
              <div className="p-4 rounded-xl bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    오늘 공부한 시간
                  </span>
                  <span className="font-label-sm text-label-sm text-primary font-bold">
                    일기쓰기와 자동 연동
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={modalStudyH}
                      onChange={(e) =>
                        setModalStudyH(Math.max(0, Math.min(16, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-transparent font-headline-md text-headline-md font-bold text-on-surface focus:outline-none"
                    />
                    <span className="font-label-md text-label-md text-secondary shrink-0">시간</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={modalStudyM}
                      onChange={(e) =>
                        setModalStudyM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-transparent font-headline-md text-headline-md font-bold text-on-surface focus:outline-none"
                    />
                    <span className="font-label-md text-label-md text-secondary shrink-0">분</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '+30분', delta: 30 },
                    { label: '+1시간', delta: 60 },
                    { label: '+2시간', delta: 120 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleAddModalStudy(btn.delta)}
                      className="px-2.5 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-bold hover:bg-primary-fixed transition-colors cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setModalStudyH(0);
                      setModalStudyM(0);
                    }}
                    className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm hover:text-on-surface transition-colors cursor-pointer ml-auto"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* 오늘 목표 집중 시간 */}
              <div className="p-4 rounded-xl bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    오늘 목표 집중 시간
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    최소 30분 ~ 최대 16시간
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={modalGoalH}
                      onChange={(e) =>
                        setModalGoalH(Math.max(0, Math.min(16, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-transparent font-headline-md text-headline-md font-bold text-on-surface focus:outline-none"
                    />
                    <span className="font-label-md text-label-md text-secondary shrink-0">시간</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={modalGoalM}
                      onChange={(e) =>
                        setModalGoalM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-transparent font-headline-md text-headline-md font-bold text-on-surface focus:outline-none"
                    />
                    <span className="font-label-md text-label-md text-secondary shrink-0">분</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2, 4, 6, 8, 10].map((hrs) => {
                    const active = modalGoalH === hrs && modalGoalM === 0;
                    return (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => {
                          setModalGoalH(hrs);
                          setModalGoalM(0);
                        }}
                        className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-bold transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container-lowest text-secondary hover:text-on-surface'
                        }`}
                      >
                        {hrs}시간
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingStudyGoal}
                className="w-full h-12 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-[0_8px_20px_rgba(255,94,30,0.24)] cursor-pointer disabled:opacity-60"
              >
                {savingStudyGoal ? '적용 중...' : '집중 시간 및 목표 저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {targetCompanyModal}
    </div>
  );
};
