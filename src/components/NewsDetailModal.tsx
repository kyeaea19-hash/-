import React from 'react';
import { NewsArticle } from '../types/powerplant';
import { NewsVisualBanner } from './PowerPlantEmblem';

export const NewsDetailModal: React.FC<{
  article: NewsArticle | null;
  onClose: () => void;
}> = ({ article, onClose }) => {
  if (!article) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] max-h-[88dvh] overflow-y-auto bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-on-surface text-surface font-label-sm text-label-sm font-bold">
              {article.company}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              {article.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="font-headline-md text-headline-md text-on-surface leading-snug">
            {article.title}
          </h3>
          <p className="font-body-sm text-body-sm text-secondary">{article.subtitle}</p>
        </div>

        <NewsVisualBanner theme={article.visualTheme} caption={article.visualCaption} />

        {article.intro && (
          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            {article.intro}
          </p>
        )}

        <div className="p-4 rounded-xl bg-surface-container-low space-y-2.5">
          <div className="font-label-md text-label-md text-primary font-bold">
            핵심 3줄 브리핑 요약
          </div>
          {article.bullets.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-container/15 text-primary font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{b}</p>
            </div>
          ))}
        </div>

        {article.interviewTip && (
          <div className="rounded-xl bg-tertiary-fixed/35 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            </div>
            <div>
              <span className="font-label-md text-label-md text-tertiary font-bold">
                면접 · 자소서 연결 포인트
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
                {article.interviewTip}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
          <span className="font-label-sm text-label-sm text-secondary">{article.sourceName}</span>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-sm hover:opacity-95"
          >
            <span>원문 기사 / 출처 보기</span>
            <span className="material-symbols-outlined text-[16px]">north_east</span>
          </a>
        </div>
      </div>
    </div>
  );
};
