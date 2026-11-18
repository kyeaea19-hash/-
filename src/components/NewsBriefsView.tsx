import React, { useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import { DEFAULT_QUIZ, NEWS_FILTERS } from '../data/newsData';
import { NewsArticle } from '../types/powerplant';
import { NewsDetailModal } from './NewsDetailModal';
import { NewsVisualBanner } from './PowerPlantEmblem';

export const NewsBriefsView: React.FC = () => {
  const {
    profile,
    completeQuizBonus,
    liveNews,
    newsLoading,
    newsError,
    fetchLiveNews,
  } = usePowerPlant();

  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizBonusAwarded, setQuizBonusAwarded] = useState(false);

  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedOption(null);
    setQuizBonusAwarded(false);
    fetchLiveNews({ category: cat, query: activeQuery });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setActiveQuery(q);
    fetchLiveNews({ category: selectedCategory, query: q });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setActiveQuery('');
    setSelectedCategory('전체');
    fetchLiveNews({ category: '전체', query: '' });
  };

  const handleRefreshToday = () => {
    setSelectedOption(null);
    setQuizBonusAwarded(false);
    fetchLiveNews({ category: selectedCategory, query: activeQuery, refresh: true });
  };

  const articles = liveNews?.articles || [];
  const currentQuiz = liveNews?.quiz || DEFAULT_QUIZ;
  const alreadyCompleted = Boolean(
    profile?.completedQuizIds.includes(currentQuiz.id)
  );

  const handleQuizChoice = async (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    if (idx === currentQuiz.correctIndex && !alreadyCompleted) {
      const awarded = await completeQuizBonus(currentQuiz.id, currentQuiz.bonusKwh);
      if (awarded) setQuizBonusAwarded(true);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Visual Banner */}
      <section className="flex flex-col items-center pt-2 pb-5">
        <div className="w-full flex items-center justify-center relative my-2">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div
              className="w-full h-2.5 bg-repeat-x opacity-85"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgb(199, 70, 52), rgb(199, 70, 52) 4px, transparent 4px, transparent 8px)',
              }}
            />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="px-6 py-2 rounded-full bg-primary-container text-on-primary shadow-[0_4px_16px_rgba(199,70,52,0.32)] flex items-center gap-1.5 transform hover:scale-[1.02] transition-transform">
              <span className="material-symbols-outlined text-[19px] icon-filled">
                electric_bolt
              </span>
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-primary font-extrabold">
                오늘의 전력 1분 심층뉴스
              </span>
            </div>
            <div className="w-0 h-0 border-x-[7px] border-x-transparent border-t-[7px] border-t-primary-container -mt-0.5" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
          <p className="font-label-md text-label-md text-secondary text-center">
            {liveNews?.displayDate || '오늘'} 실시간 전력·에너지·공공기관 핵심 이슈 요약
          </p>
          <button
            type="button"
            disabled={newsLoading}
            onClick={handleRefreshToday}
            className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm font-bold hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[14px] ${
                newsLoading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span>새로고침</span>
          </button>
        </div>
      </section>

      {/* Search & Category Selector */}
      <section className="flex flex-col gap-3 pb-4">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
          <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="에너지고속도로, SMP, 가스공사, 도로공사, 코레일 등 검색..."
            className="w-full h-11 pl-10 pr-20 rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-secondary shadow-[0_2px_8px_rgba(11,28,48,0.04)] focus:outline-none focus:ring-2 focus:ring-primary-container/30 transition-all"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {(searchInput || activeQuery || selectedCategory !== '전체') && (
              <button
                type="button"
                aria-label="필터 초기화"
                onClick={handleResetFilters}
                className="text-secondary hover:text-on-surface flex items-center justify-center p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold cursor-pointer"
            >
              검색
            </button>
          </div>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-margin px-margin">
          {NEWS_FILTERS.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-all active:scale-95 cursor-pointer ${
                  active
                    ? 'bg-on-surface text-surface font-bold shadow-sm'
                    : 'bg-surface-container-lowest text-secondary hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Editorial News Stream */}
      <section className="flex flex-col gap-5 pt-2">
        {newsLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-3 animate-pulse"
              >
                <div className="flex justify-between">
                  <div className="h-5 w-20 bg-surface-container rounded" />
                  <div className="h-4 w-24 bg-surface-container rounded" />
                </div>
                <div className="h-6 w-4/5 bg-surface-container rounded" />
                <div className="h-28 w-full bg-surface-container-low rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!newsLoading && newsError && (
          <div className="bg-surface-container-lowest rounded-xl p-6 text-center space-y-3 shadow-sm">
            <span className="material-symbols-outlined text-[32px] text-error">cloud_off</span>
            <p className="font-body-md text-body-md text-on-surface font-medium">
              오늘의 전력 뉴스를 불러오지 못했어요
            </p>
            <p className="font-body-sm text-body-sm text-secondary">{newsError}</p>
            <button
              type="button"
              onClick={handleRefreshToday}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-bold cursor-pointer"
            >
              다시 시도하기
            </button>
          </div>
        )}

        {!newsLoading && !newsError && articles.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-8 text-center space-y-2 shadow-sm">
            <span className="material-symbols-outlined text-[32px] text-secondary">
              search_off
            </span>
            <p className="font-body-md text-body-md text-secondary">
              조건에 맞는 당일 뉴스가 없습니다.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold cursor-pointer"
            >
              전체 뉴스 보기
            </button>
          </div>
        )}

        {!newsLoading &&
          !newsError &&
          articles.map((article) => {
            if (article.badgeType === 'lead') {
              return (
                <article
                  key={article.id}
                  className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(11,28,48,0.05)] flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-[0_6px_24px_rgba(11,28,48,0.08)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-container via-tertiary-container to-primary-container" />

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-on-surface text-surface font-label-sm text-label-sm tracking-wider uppercase font-bold">
                        {article.category}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                        {article.company}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary shrink-0">
                      {article.publishedLabel}
                    </span>
                  </div>

                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-snug pt-1">
                    {article.title}
                  </h2>

                  <NewsVisualBanner theme={article.visualTheme} caption={article.visualCaption} />

                  {article.intro && (
                    <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                      {article.intro}
                    </p>
                  )}

                  <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col gap-2">
                    {article.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary-container text-[18px] shrink-0 mt-0.5">
                          check_circle
                        </span>
                        <span className="font-body-md text-body-md text-on-surface leading-snug">
                          {b}
                        </span>
                      </div>
                    ))}
                  </div>

                  {article.interviewTip && (
                    <div className="rounded-xl bg-tertiary-fixed/30 p-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-md text-label-md text-tertiary font-bold">
                          면접관이 물어볼 확률 99% 면접 팁!
                        </span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
                          {article.interviewTip}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-secondary">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span className="font-label-sm text-label-sm">{article.sourceName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(article)}
                      className="inline-flex items-center gap-1 text-primary-container font-label-lg text-label-lg font-bold hover:underline cursor-pointer"
                    >
                      기사 요약 · 원문 보기
                      <span className="material-symbols-outlined text-[16px]">north_east</span>
                    </button>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={article.id}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_16px_rgba(11,28,48,0.04)] flex flex-col gap-3 transition-all hover:shadow-[0_6px_20px_rgba(11,28,48,0.06)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-on-surface text-surface font-label-sm text-label-sm font-bold tracking-wider">
                      {article.company}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                      {article.category}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[13px]">timer</span>{' '}
                    {article.publishedLabel}
                  </span>
                </div>

                <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight leading-snug">
                  {article.title}
                </h3>

                <p className="font-body-md text-body-md text-secondary leading-relaxed">
                  {article.intro || article.subtitle}
                </p>

                <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3.5">
                  {article.bullets.map((b, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-container/15 text-primary font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {bIdx + 1}
                      </span>
                      <p className="font-body-md text-body-md text-on-surface leading-snug">{b}</p>
                    </div>
                  ))}
                </div>

                {article.ncsNote && (
                  <div className="font-label-sm text-label-sm text-primary font-bold">
                    {article.ncsNote}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 gap-2">
                  <span className="font-label-sm text-label-sm text-secondary truncate">
                    {article.sourceName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(article)}
                    className="inline-flex items-center gap-1 text-primary-container font-label-lg text-label-lg font-bold hover:underline shrink-0 cursor-pointer"
                  >
                    원문 · 면접 팁 보기
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </article>
            );
          })}
      </section>

      {/* Interactive Quiz Teaser */}
      <section className="mt-6 mb-2 rounded-xl bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container p-5 shadow-[0_4px_16px_rgba(199,70,52,0.08)] flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[16px]">quiz</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              오늘의 1분 브리핑 퀴즈
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-extrabold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            {alreadyCompleted && !quizBonusAwarded
              ? '참여 완료 ✓'
              : `+${currentQuiz.bonusKwh} kWh 보너스`}
          </span>
        </div>

        <p className="font-body-md text-body-md text-on-surface font-medium">
          {currentQuiz.question}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {currentQuiz.options.map((opt, idx) => {
            const isChosen = selectedOption === idx;
            const isCorrect = idx === currentQuiz.correctIndex;
            let btnStyle =
              'bg-surface-container-lowest text-on-surface hover:bg-surface-container-highest';
            if (selectedOption !== null) {
              if (isCorrect) {
                btnStyle = 'bg-primary-container text-on-primary';
              } else if (isChosen) {
                btnStyle = 'bg-error-container text-error';
              }
            }

            return (
              <button
                key={opt}
                type="button"
                disabled={selectedOption !== null}
                onClick={() => handleQuizChoice(idx)}
                className={`h-12 rounded-xl font-label-lg text-label-lg transition-all flex items-center justify-center active:scale-95 shadow-sm cursor-pointer disabled:cursor-default ${btnStyle}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selectedOption !== null && (
          <div className="rounded-lg p-3 bg-surface-container-lowest transition-all space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  selectedOption === currentQuiz.correctIndex ? 'text-primary' : 'text-error'
                }`}
              >
                {selectedOption === currentQuiz.correctIndex ? 'check_circle' : 'cancel'}
              </span>
              <span
                className={`font-label-lg text-label-lg font-bold ${
                  selectedOption === currentQuiz.correctIndex ? 'text-primary' : 'text-error'
                }`}
              >
                {selectedOption === currentQuiz.correctIndex
                  ? quizBonusAwarded
                    ? `정답입니다! ⚡ +${currentQuiz.bonusKwh} kWh 충전 완료`
                    : '정답입니다! ⚡ 오늘 이슈를 정확히 파악하고 계시네요.'
                  : `아쉬워요! 정답은 ${currentQuiz.options[currentQuiz.correctIndex]} 입니다.`}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">{currentQuiz.explanation}</p>
          </div>
        )}
      </section>

      {/* Verified Grounding Sources */}
      {liveNews?.groundingSources && liveNews.groundingSources.length > 0 && (
        <section className="mt-4 p-4 rounded-xl bg-surface-container-lowest shadow-xs space-y-2">
          <div className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">link</span>
            <span>오늘 뉴스 검색 출처 바로가기</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {liveNews.groundingSources.map((src, i) => (
              <a
                key={i}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-full bg-surface-container-low text-secondary hover:text-primary font-label-sm text-label-sm truncate max-w-[220px]"
              >
                {src.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Trust Verification Footer */}
      <footer className="mt-4 mb-2 p-4 rounded-xl bg-surface-container-low text-center flex flex-col items-center gap-1.5 shadow-[0_1px_4px_rgba(11,28,48,0.03)]">
        <div className="flex items-center gap-1.5 text-primary">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span className="font-label-md text-label-md font-bold">
            당일 일반 언론 · 경제지 · 전력 유관기관 실시간 검색 요약
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary leading-relaxed max-w-sm">
          "전력 뉴스 브리핑은 오늘 보도된 일반 언론의 전력·에너지·공공기관 이슈와 유관기관 발표를
          실시간 검색으로 요약해 드립니다."
        </p>
      </footer>

      <NewsDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </div>
  );
};
