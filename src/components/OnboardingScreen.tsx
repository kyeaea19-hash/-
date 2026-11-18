import React, { useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import { PowerMascot } from './PowerPlantEmblem';

export const OnboardingScreen: React.FC = () => {
  const { signInWithGoogle, enterGuestMode, isSigningIn, authError } = usePowerPlant();
  const [infoModal, setInfoModal] = useState<'terms' | 'privacy' | 'support' | null>(null);

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen pt-safe pb-safe">
      <main className="flex-1 flex flex-col relative w-full px-margin bg-surface max-w-[680px] mx-auto">
        <div className="flex flex-col w-full pb-8">
          {/* Top Brand & Visual Hero Section */}
          <header className="flex flex-col items-center text-center pt-4 pb-6 px-1">
            {/* Editorial Ribbon Badge */}
            <div className="relative flex items-center justify-center w-full mb-6">
              <div
                aria-hidden="true"
                className="w-full flex justify-between items-center px-2 opacity-35 select-none pointer-events-none"
              >
                <span className="text-primary tracking-widest text-[10px] font-mono">
                  ||||||||||||||||||||||||||||||
                </span>
                <span className="text-primary tracking-widest text-[10px] font-mono">
                  ||||||||||||||||||||||||||||||
                </span>
              </div>
              <div className="absolute bg-primary-container text-on-primary font-headline-sm text-headline-sm px-6 py-2 rounded-full shadow-md">
                에너지 온보딩 ⚡
              </div>
            </div>

            {/* Power Plant Growth Mascot */}
            <div className="relative w-28 h-28 my-2 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary-fixed rounded-full blur-xl opacity-60 animate-pulse" />
              <PowerMascot pose="wave" className="relative w-26 h-26 drop-shadow-sm" />
            </div>

            {/* Category Pill Tag */}
            <div className="inline-flex items-center gap-1.5 bg-inverse-surface text-inverse-on-surface px-2.5 py-1 rounded mt-2 mb-3">
              <span className="material-symbols-outlined text-[15px] text-tertiary-fixed-dim icon-filled">
                bolt
              </span>
              <span className="font-label-sm text-label-sm tracking-tight">
                전력 공기업 맞춤 루틴
              </span>
            </div>

            {/* Headline Copy */}
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight">
              전력 공기업 취준생을 위한
              <br />
              매일의 성장 루틴
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              매일의 기록으로 내 안의 발전소를 가동하세요 ⚡
            </p>
          </header>

          {/* Friendly 3-Value Feature Cards */}
          <section
            aria-label="발전소 키우기 3단계 핵심 가치"
            className="flex flex-col gap-3 mb-6"
          >
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-start gap-3.5 transition-all">
              <div className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
                <span className="material-symbols-outlined text-2xl icon-filled">newspaper</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm px-1.5 py-0.5 rounded">
                    STEP 01
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
                    3줄 전력 뉴스 브리핑
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                  전력시장·요금제·전력망·원전·공공기관 이슈 등 오늘의 일반·경제 언론 및 공기업 핵심 뉴스를 1분 요약으로 쏙쏙 확인해요.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-start gap-3.5 transition-all">
              <div className="w-11 h-11 rounded-lg bg-secondary-container flex items-center justify-center shrink-0 text-on-secondary-container">
                <span className="material-symbols-outlined text-2xl icon-filled">
                  self_improvement
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm px-1.5 py-0.5 rounded">
                    STEP 02
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
                    내면 돌봄 일기
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                  오늘의 공부 시간과 멘탈 컨디션을 기록하며 지치기 쉬운 수험 기간의 마음을 단단히
                  챙겨요.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-start gap-3.5 transition-all">
              <div className="w-11 h-11 rounded-lg bg-tertiary-fixed flex items-center justify-center shrink-0 text-tertiary">
                <span className="material-symbols-outlined text-2xl icon-filled">
                  electric_bolt
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm px-1.5 py-0.5 rounded">
                    STEP 03
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
                    발전소 성장 시스템
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                  매일 첫 일기 작성 시 <strong className="text-primary font-bold">+1 kWh</strong>{' '}
                  충전! 최대 365단계 초대형 복합화력 발전소까지 도달해 보세요.
                </p>
              </div>
            </div>
          </section>

          {/* New User Assurance Perk Callout */}
          <section
            aria-label="신규 회원 혜택"
            className="bg-surface-container-low rounded-xl p-4 mb-6 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container" />
            <div className="flex items-start gap-3 pl-1">
              <span aria-label="선물" className="text-2xl select-none" role="img">
                🎁
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded-full">
                    신규 가입 선물
                  </span>
                  <span className="font-label-md text-label-md text-primary font-bold">
                    3일 정전 방지 쉴드 증정!
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-snug">
                  깜빡 잊어도 괜찮아요! 가입 첫 3일간 연속 기록이 끊기지 않도록 정전 방지권을 드려요.
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-[16px] text-primary icon-filled">
                    verified_user
                  </span>
                  <span className="font-body-sm text-body-sm">
                    작성한 일기와 데이터는 평생 안전하게 보존됩니다.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm">
              Google 로그인 중 문제가 발생했어요: {authError}
            </div>
          )}

          {/* Auth Action Area */}
          <section aria-label="로그인 및 시작하기" className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={signInWithGoogle}
              className="w-full h-12 bg-surface-container-lowest text-on-surface rounded-xl flex items-center justify-center gap-3 px-4 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
            >
              <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                  fill="#4285F4"
                />
                <path
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
                  fill="#34A853"
                />
                <path
                  d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.13z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-label-lg text-label-lg font-bold">
                {isSigningIn ? '구글 보안 인증 연결 중... ⚡' : 'Google 계정으로 시작하기'}
              </span>
            </button>

            <button
              type="button"
              onClick={enterGuestMode}
              className="w-full h-12 bg-primary-container text-on-primary rounded-xl flex items-center justify-center gap-2 px-4 shadow-md active:scale-[0.98] transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">explore</span>
              <span className="font-label-lg text-label-lg font-bold">
                체험 모드로 둘러보기
              </span>
            </button>
          </section>

          {/* Bottom Links */}
          <footer className="mt-auto pt-4 flex flex-col items-center justify-center text-center gap-2">
            <div className="flex items-center gap-3 text-secondary font-label-md text-label-md">
              <button
                type="button"
                onClick={() => setInfoModal('terms')}
                className="hover:text-on-surface transition-colors cursor-pointer"
              >
                서비스 이용약관
              </button>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <button
                type="button"
                onClick={() => setInfoModal('privacy')}
                className="hover:text-on-surface transition-colors font-bold underline cursor-pointer"
              >
                개인정보처리방침
              </button>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <button
                type="button"
                onClick={() => setInfoModal('support')}
                className="hover:text-on-surface transition-colors cursor-pointer"
              >
                고객지원
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-secondary opacity-70">
              © 2026 PowerPlant Lab. All rights reserved.
            </p>
          </footer>
        </div>
      </main>

      {infoModal && (
        <div
          className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {infoModal === 'terms' && '서비스 이용약관'}
                {infoModal === 'privacy' && '개인정보처리방침'}
                {infoModal === 'support' && '고객지원 안내'}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-secondary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
              {infoModal === 'terms' &&
                '발전소 키우기는 전력 공기업 취업 준비생을 위한 일일 학습 기록, 멘탈 케어 일기 및 공식 보도자료 요약 서비스입니다. 하루 1회 첫 일기 작성 시 +1 kWh 및 +1 레벨이 충전되며, 유예기간(가입 3일) 이후 미작성 시 하루 -1 kWh가 차감됩니다.'}
              {infoModal === 'privacy' &&
                'Google 로그인 시 수집되는 이름, 이메일 및 작성된 일기 데이터는 Firebase 보안 데이터베이스(Firestore)에 본인 계정 전용으로 격리 저장되며 제3자에게 제공되지 않습니다.'}
              {infoModal === 'support' &&
                '뉴스 보도자료 출처 오류 제보나 발전소 레벨/기록 관련 문의는 앱 내 설정 또는 PowerPlant Lab 지원 채널로 언제든 문의해 주세요.'}
            </p>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full h-11 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
