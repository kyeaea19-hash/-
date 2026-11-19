import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface CachedNewsEntry {
  expiresAt: number;
  payload: unknown;
}

const newsCache = new Map<string, CachedNewsEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

interface RssItem {
  title: string;
  sourceName: string;
  link: string;
  pubDate: string;
  publishedLabel: string;
  snippet: string;
  timestamp: number;
  articleText?: string;
}

function getKstDateParts(): { isoDate: string; displayDate: string } {
  const now = new Date();
  const kst = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const display = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now);
  return { isoDate: kst, displayDate: display };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatKstPublishedLabel(pubDateStr: string): { label: string; ts: number } {
  const parsed = Date.parse(pubDateStr);
  if (Number.isNaN(parsed)) {
    return { label: '오늘', ts: Date.now() };
  }
  const diffMs = Date.now() - parsed;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMin < 60 && diffMin >= 0) {
    return { label: `${Math.max(1, diffMin)}분 전`, ts: parsed };
  }
  if (diffHours < 24 && diffHours >= 0) {
    return { label: `${diffHours}시간 전`, ts: parsed };
  }
  const kstFormatted = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(parsed));
  return { label: kstFormatted, ts: parsed };
}

async function fetchGoogleNewsRss(query: string): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=ko&gl=KR&ceid=KR:ko`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PowerPlantNewsBot/1.0)',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: RssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const rawPubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '';
      const rawDesc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';

      const decodedTitle = decodeHtmlEntities(rawTitle);
      const sourceDecoded = decodeHtmlEntities(rawSource);
      let cleanTitle = decodedTitle;
      let sourceName = sourceDecoded || '국내 언론';

      const dashIdx = decodedTitle.lastIndexOf(' - ');
      if (dashIdx > 0) {
        cleanTitle = decodedTitle.slice(0, dashIdx).trim();
        if (!sourceDecoded) {
          sourceName = decodedTitle.slice(dashIdx + 3).trim();
        }
      }

      const { label, ts } = formatKstPublishedLabel(rawPubDate);
      const snippet = decodeHtmlEntities(rawDesc)
        .replace(cleanTitle, '')
        .replace(sourceName, '')
        .trim();

      if (cleanTitle && rawLink) {
        items.push({
          title: cleanTitle,
          sourceName,
          link: rawLink.trim(),
          pubDate: rawPubDate,
          publishedLabel: label,
          snippet,
          timestamp: ts,
        });
      }
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function getCategorySearchQueries(category: string, userQuery: string): string[] {
  if (userQuery) {
    return [
      `(${userQuery}) (전력 OR 에너지 OR 전기 OR 가스 OR 도로 OR 철도 OR 원전 OR 채용 OR 안전 OR 공기업) when:3d`,
      `${userQuery} when:4d`,
    ];
  }

  switch (category) {
    case '전기직 공기업':
      return [
        '(한국가스공사 OR 가스공사) when:3d',
        '(한국도로공사 OR 도로공사) when:3d',
        '(코레일 OR 한국철도공사 OR 국가철도공단) when:3d',
        '(한국수자원공사 OR 수자원공사 OR 지역난방공사 OR 전기안전공사 OR 서울교통공사 OR 인천국제공항공사) when:3d',
      ];
    case '전력시장·요금':
      return [
        '(전력시장 OR 전기요금 OR 지역별 요금제 OR SMP OR 분산에너지 OR AI 데이터센터 전력) when:2d',
        '(산업용 전기요금 OR 비용기반정산제도 OR 에너지 대전환 OR 분산특구) when:4d',
      ];
    case '전력망·계통':
      return [
        '(전력망 OR HVDC OR 에너지고속도로 OR 송전선로 OR 변전소 OR ESS OR 양수발전) when:2d',
        '(동해안 송전선로 OR 서해안 에너지고속도로 OR 분산형 전력망 OR 유연성 자원) when:4d',
      ];
    case '원전·SMR':
      return [
        '(체코 원전 OR 두코바니 OR SMR OR i-SMR OR 원전 이용률 OR 한수원) when:2d',
        '(신규 원전 OR 테믈린 OR 원전 수출) when:4d',
      ];
    case '발전5사·재생e':
      return [
        '(발전5사 OR 한국발전 OR 해상풍력 OR 석탄발전 폐지 OR 재생에너지 계통) when:2d',
        '(남동발전 OR 중부발전 OR 서부발전 OR 남부발전 OR 동서발전) when:4d',
      ];
    case '공기업·채용':
      return [
        '(한전 사장 OR 공공기관 통폐합 OR 공공기관 지방이전 OR 공공기관 경영평가 OR 공공기관 채용) when:2d',
        '(발전5사 통합 OR 혁신도시 OR 주 4.5일제 공공기관 OR 가스공사 채용 OR 코레일 채용 OR 도로공사 채용) when:4d',
      ];
    case '탄소·안전·거시':
      return [
        '(배출권거래제 OR 2035 NDC OR 중대재해 공기업 OR 안전보건 공시제 OR LNG 가격 OR 유가 에너지안보) when:2d',
        '(ESG 공시 OR 배출권 유상할당 OR 정의로운 전환 OR 중동 유가 환율) when:4d',
      ];
    case '한국전력':
      return ['(한국전력 OR 한전 실적 OR 한전 부채 OR 한전 전기요금 OR 한전 사장) when:3d'];
    case '한국수력원자력':
      return ['(한국수력원자력 OR 한수원 OR 체코 두코바니 OR i-SMR) when:3d'];
    default:
      return [
        '(한국전력 OR 전기요금 OR 전력망 OR 에너지고속도로 OR HVDC) when:1d',
        '(원전 OR SMR OR 한수원 OR 전력시장 OR 분산에너지 OR SMP) when:1d',
        '(한국가스공사 OR 가스공사 OR 한국도로공사 OR 도로공사) when:2d',
        '(코레일 OR 한국철도공사 OR 국가철도공단 OR 수자원공사 OR 지역난방공사 OR 전기안전공사) when:2d',
        '(한국전력 OR 한국수력원자력 OR 남동발전 OR 중부발전 OR 서부발전 OR 남부발전 OR 동서발전 OR 산업부) (보도자료 OR 발표 OR 체결 OR 착수 OR 준공) when:3d',
        '(발전5사 OR 해상풍력 OR ESS OR 공공기관 채용 OR 공공기관 지방이전 OR 배출권거래제) when:2d',
      ];
  }
}

function inferArticleMeta(item: RssItem): {
  company: string;
  category: string;
  visualTheme: 'nuclear' | 'grid' | 'smr' | 'hydrogen' | 'offshore' | 'solar';
} {
  const t = item.title;
  if (/한전KDN/.test(t)) {
    return { company: '한전KDN', category: '전력ICT·에너지', visualTheme: 'grid' };
  }
  if (/한전KPS/.test(t)) {
    return { company: '한전KPS', category: '발전정비·안전', visualTheme: 'grid' };
  }
  if (/한국전력기술|한전기술/.test(t)) {
    return { company: '한국전력기술', category: '전력엔지니어링', visualTheme: 'nuclear' };
  }
  if (/한전원자력연료/.test(t)) {
    return { company: '한전원자력연료', category: '원전·연료', visualTheme: 'nuclear' };
  }
  if (/한국가스공사|가스공사/.test(t)) {
    return { company: '한국가스공사', category: '전기직 공기업', visualTheme: 'hydrogen' };
  }
  if (/한국도로공사|도로공사/.test(t)) {
    return { company: '한국도로공사', category: '전기직 공기업', visualTheme: 'solar' };
  }
  if (/코레일|한국철도공사|국가철도공단|서울교통공사/.test(t)) {
    return {
      company: /철도공단/.test(t)
        ? '국가철도공단'
        : /서울교통공사/.test(t)
        ? '서울교통공사'
        : '코레일',
      category: '전기직 공기업',
      visualTheme: 'grid',
    };
  }
  if (/수자원공사|K-water/.test(t)) {
    return { company: '한국수자원공사', category: '전기직 공기업', visualTheme: 'offshore' };
  }
  if (/지역난방공사/.test(t)) {
    return { company: '한국지역난방공사', category: '전기직 공기업', visualTheme: 'solar' };
  }
  if (/전기안전공사|에너지공단|인천국제공항공사|한국공항공사/.test(t)) {
    return {
      company: /전기안전/.test(t)
        ? '한국전기안전공사'
        : /에너지공단/.test(t)
        ? '한국에너지공단'
        : '공항공사',
      category: '전기직 공기업',
      visualTheme: 'grid',
    };
  }
  if (/한수원|한국수력원자력/.test(t)) {
    return {
      company: '한국수력원자력',
      category: '원전·에너지',
      visualTheme: t.includes('SMR') ? 'smr' : 'nuclear',
    };
  }
  if (/전력거래소/.test(t)) {
    return { company: '전력거래소', category: '전력시장·계통', visualTheme: 'grid' };
  }
  if (/원전|SMR|두코바니|테믈린|원자력/.test(t)) {
    return {
      company: '원전·SMR',
      category: '원전·에너지',
      visualTheme: t.includes('SMR') ? 'smr' : 'nuclear',
    };
  }
  if (/송전|변전|HVDC|전력망|에너지고속도로|계통|해저케이블/.test(t)) {
    return {
      company: /(?:^|[^가-힣])한전|한국전력/.test(t) ? '한국전력' : '전력망·계통',
      category: '송배전·인프라',
      visualTheme: 'grid',
    };
  }
  if (/요금|실적|부채|SMP|전력시장|데이터센터|분산|(?:^|[^가-힣])한전|한국전력/.test(t)) {
    return {
      company: /(?:^|[^가-힣])한전|한국전력/.test(t) ? '한국전력' : '전력시장·요금',
      category: '시장·재무',
      visualTheme: 'solar',
    };
  }
  if (/풍력|태양광|수소|석탄|발전5사|남동발전|중부발전|서부발전|남부발전|동서발전|ESS|양수/.test(t)) {
    const corp =
      t.match(/(한국남동발전|남동발전|한국중부발전|중부발전|한국서부발전|서부발전|한국남부발전|남부발전|한국동서발전|동서발전)/)?.[1] ||
      '발전5사·재생e';
    return {
      company: corp.startsWith('한국') || corp === '발전5사·재생e' ? corp : `한국${corp}`,
      category: '에너지전환',
      visualTheme: /풍력/.test(t) ? 'offshore' : 'hydrogen',
    };
  }
  if (/공공기관|채용|지방이전|경영평가|산재|중대재해|안전|4\.5일/.test(t)) {
    return { company: '공기업·정책', category: '공공기관·안전', visualTheme: 'grid' };
  }
  return { company: '에너지·거시', category: '산업·탄소', visualTheme: 'solar' };
}

const ARTICLE_KEYWORD_CANDIDATES = [
  '가상발전소',
  'ESS',
  '분산에너지',
  '재생에너지',
  '신재생에너지',
  '수상태양광',
  '태양광',
  '해상풍력',
  '풍력',
  '해저케이블',
  'HVDC',
  '에너지고속도로',
  '송전선로',
  '송전망',
  '배전망',
  '변전소',
  '스마트그리드',
  '전력망',
  '전력설비',
  '무선통신',
  '전력시장',
  '전기요금',
  'SMP',
  'CBP',
  '양수발전',
  '석탄발전',
  'LNG',
  '원전',
  '원자력',
  '표준운영체계',
  'i-SMR',
  'SMR',
  '청정수소',
  '수소',
  '배출권',
  '온실가스',
  '2035 NDC',
  '탄소중립',
  '데이터센터',
  'AI',
  'ICT',
  '예지보전',
  '디지털',
  '전기차',
  '충전',
  '전철',
  '철도',
  '고속도로',
  '열병합',
  '수열',
  '수력',
  '중대재해',
  '안전',
  '신입',
  '채용',
  '영업이익',
  '실적',
  '부채',
  '경영평가',
  'ESG',
  '지방이전',
  '지산지소',
  '업무협약',
  '협약',
  '수주',
  '수출',
  '착공',
  '준공',
  '실증',
  '거버넌스',
] as const;

function stripReporterPrefix(text: string): string {
  return text
    .replace(/\[[^\]]*(?:제공|캡처|사진|자료|연합뉴스|뉴시스|뉴스1|Pick|단독|종합)[^\]]*\]/gi, ' ')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
    .replace(/\([가-힣]{1,8}\s*=\s*[^)]+\)\s*(?:[가-힣]{2,5}\s*기자\s*=?\s*)?/g, ' ')
    .replace(/^[가-힣A-Za-z0-9·.\s]{2,24}\s*=\s*[가-힣]{2,5}\s*기자\s*[|｜=]?\s*/g, '')
    .replace(/[가-힣]{2,4}\s*기자\s*=/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitFactualSentences(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = stripReporterPrefix(rawText);

  const matches = cleaned.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const out: string[] = [];
  for (const m of matches) {
    const s = stripReporterPrefix(m);
    if (s.length >= 18 && s.length <= 240 && /[가-힣]/.test(s)) {
      out.push(s);
    }
    if (out.length >= 5) break;
  }
  return out;
}

function matchesArticleKeyword(text: string, kw: string): boolean {
  if (/^[A-Za-z0-9-]+$/.test(kw)) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i');
    return regex.test(text);
  }
  return text.toLowerCase().includes(kw.toLowerCase());
}

function buildArticleGroundedPoint(
  item: RssItem,
  company: string,
  category: string,
  sentences: string[]
): { interviewTip: string; ncsNote: string } {
  const cleanTitle = stripReporterPrefix(item.title)
    .replace(/^(?:\[[^\]]+\]\s*)+/, '')
    .trim();
  const bodyScope = `${cleanTitle} ${sentences.join(' ')} ${item.snippet || ''}`;

  // Only select keywords that literally appear in this article (prioritizing title keywords)
  const titleMatched = ARTICLE_KEYWORD_CANDIDATES.filter((kw) =>
    matchesArticleKeyword(cleanTitle, kw)
  );
  const bodyMatched = ARTICLE_KEYWORD_CANDIDATES.filter(
    (kw) => !titleMatched.includes(kw) && matchesArticleKeyword(bodyScope, kw)
  );

  // Deduplicate substring overlaps (e.g. if '수상태양광' is present, skip '태양광'; if '업무협약', skip '협약')
  const dedupedKeywords: string[] = [];
  for (const kw of [...titleMatched, ...bodyMatched]) {
    const overlaps = dedupedKeywords.some(
      (prev) => prev.includes(kw) || kw.includes(prev)
    );
    if (!overlaps) {
      dedupedKeywords.push(kw);
    }
    if (dedupedKeywords.length >= 3) break;
  }

  const ncsNote =
    dedupedKeywords.length > 0
      ? `기사 핵심 키워드: ${dedupedKeywords.join(' · ')}`
      : `기사 핵심 분야: ${company} · ${category}`;

  // Prefer the lead sentence when concise, otherwise use the clean article headline
  const leadSentence =
    sentences[0] && sentences[0].length >= 20 && sentences[0].length <= 130
      ? sentences[0].replace(/[.!?]+$/, '')
      : cleanTitle;

  const kwText = dedupedKeywords.length > 0 ? dedupedKeywords.join('·') : category;
  const interviewTip = `「${leadSentence}」 기사 내용을 바탕으로, 기사 속 '${kwText}' 사안이 ${company} 및 희망 직무에서 어떤 의미가 있는지 자기소개서 지원동기나 면접 답변 사례로 연결해 보세요.`;

  return { interviewTip, ncsNote };
}

async function fetchSingleArticleBody(item: RssItem): Promise<RssItem> {
  const fetchWithTimeout = async (url: string, ms: number) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    } finally {
      clearTimeout(t);
    }
  };

  try {
    const naverSearchUrl = `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(
      item.title
    )}`;
    const searchHtml = await fetchWithTimeout(naverSearchUrl, 2500);
    const naverLinks = [
      ...searchHtml.matchAll(/https:\/\/n\.news\.naver\.com\/mnews\/article\/[^"&'<> \n]+/g),
    ].map((m) => m[0]);

    for (const naverUrl of [...new Set(naverLinks)].slice(0, 2)) {
      const artHtml = await fetchWithTimeout(naverUrl, 2500);
      if (!artHtml) continue;
      const dic =
        artHtml.match(/<article[^>]*id="dic_area"[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
        artHtml.match(/id="newsct_article"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
        '';
      if (dic) {
        const body = decodeHtmlEntities(
          dic
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<em[^>]*class="img_desc"[^>]*>[\s\S]*?<\/em>/gi, ' ')
            .replace(/<span[^>]*class="end_photo_org"[^>]*>[\s\S]*?<\/span>/gi, ' ')
        );
        if (body.length >= 80) {
          return {
            ...item,
            articleText: body.slice(0, 1400),
            link: naverUrl,
          };
        }
      }
    }

    const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(
      item.title
    )}&format=rss&mkt=ko-KR`;
    const bingXml = await fetchWithTimeout(bingUrl, 2500);
    if (bingXml) {
      const bingBlocks = [...bingXml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const bm of bingBlocks.slice(0, 3)) {
        const block = bm[1];
        const bDesc = decodeHtmlEntities(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '');
        const bLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
        const realUrlMatch = bLink.match(/url=([^&]+)/);
        const directUrl = realUrlMatch ? decodeURIComponent(realUrlMatch[1]) : item.link;
        if (bDesc.length >= 40) {
          return {
            ...item,
            articleText: bDesc.slice(0, 800),
            link: directUrl || item.link,
          };
        }
      }
    }
  } catch {
    // ignore fetch error and keep RSS item
  }
  return item;
}

async function hydrateArticlesWithRealBody(items: RssItem[]): Promise<RssItem[]> {
  const results = await Promise.allSettled(items.map((it) => fetchSingleArticleBody(it)));
  return results.map((r, idx) => (r.status === 'fulfilled' ? r.value : items[idx]));
}

function buildFallbackBriefings(items: RssItem[], isoDate: string) {
  const articles = items.slice(0, 8).map((item, idx) => {
    const meta = inferArticleMeta(item);
    const sentences = splitFactualSentences(item.articleText || item.snippet || '');
    const intro =
      sentences[0] || `${item.sourceName}(${item.publishedLabel})에서 보도한 기사입니다.`;
    const bullets =
      sentences.length >= 2
        ? sentences.slice(0, 3)
        : sentences.length === 1
        ? [item.title, sentences[0]]
        : [item.title, '상세 내용은 아래 원문 보기에서 직접 확인할 수 있습니다.'];
    const grounded = buildArticleGroundedPoint(item, meta.company, meta.category, sentences);

    return {
      id: `rss-${isoDate}-${idx}`,
      company: meta.company,
      category: meta.category,
      badgeType: idx === 0 ? 'lead' : 'brief',
      title: item.title,
      subtitle: `${item.sourceName} 보도 · ${item.publishedLabel}`,
      publishedLabel: item.publishedLabel,
      readTimeLabel: '1분 브리핑',
      intro,
      bullets,
      interviewTip: grounded.interviewTip,
      ncsNote: grounded.ncsNote,
      sourceName: item.sourceName,
      sourceUrl: item.link,
      visualTheme: meta.visualTheme,
      visualCaption: `${item.sourceName} · ${item.publishedLabel}`,
      featuredOnHome: idx < 2,
    };
  });

  const lead = articles[0];
  const quiz = lead
    ? {
        id: `quiz-${isoDate}`,
        question: `Q. 오늘 주요 뉴스 "${lead.title}"와 가장 직접적으로 관련된 분야는 무엇일까요?`,
        options: [
          `① ${lead.category}`,
          '② 단순 소비재 유통',
          '③ 우주 항공 발사체',
          '④ 반도체 패키징 공정',
        ],
        correctIndex: 0,
        explanation: `"${lead.title}" 기사는 ${lead.company}(${lead.category}) 분야의 보도 내용입니다.`,
        bonusKwh: 1,
      }
    : null;

  const interviewTips = articles.slice(0, 3).map((a, idx) => ({
    id: `tip-${isoDate}-${idx}`,
    company: a.company,
    question: `Q. "${a.title.slice(0, 42)}${a.title.length > 42 ? '...' : ''}" 기사를 면접·자소서에 어떻게 연결할 수 있을까요?`,
    answer: a.interviewTip,
  }));

  return { articles, quiz, interviewTips };
}

function extractJsonObject(rawText: string): any {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('JSON 블록을 추출할 수 없습니다.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

async function enrichWithGeminiIfAvailable(items: RssItem[], isoDate: string) {
  if (!process.env.GEMINI_API_KEY || items.length === 0) {
    return null;
  }

  const headlinesInput = items
    .slice(0, 8)
    .map((it, idx) => {
      const bodyText = it.articleText || it.snippet || '(본문 미확보 - 제목 사실만 사용)';
      return `[${idx}] 제목: ${it.title} | 언론사: ${it.sourceName} | 시점: ${it.publishedLabel}\n기사 본문 발췌: ${bodyText}`;
    })
    .join('\n\n');

  const prompt = `다음은 오늘(${isoDate}) 실제 보도된 한국 전력·에너지 및 전기직 주요 공기업 뉴스 목록과 실제 기사 본문 발췌입니다.

[가장 중요한 절대 원칙 — 사실 충실성 및 기사 밀착형 면접·자소서 연결]
1. subtitle, intro, bullets에는 **반드시 아래 제공된 해당 기사 제목과 기사 본문 발췌에 명시적으로 적힌 사실·수치·기관·인물·발언만** 요약하세요.
2. **기사에 없는 수치, 날짜, 원인, 향후 전망, 다른 기업 사례, 과장·추측 내용을 절대 지어내어 추가하지 마세요.**
3. 본문 발췌가 짧거나 부족할 경우, 억지로 3줄을 채우려고 없는 내용을 덧붙이지 말고 확인된 사실만으로 1~2줄만 간결하게 작성하세요.
4. **interviewTip(면접·자소서 연결 포인트)과 ncsNote는 반드시 해당 기사 제목·본문 발췌에 실제로 등장한 핵심 사건·기관·사업·키워드만 가지고 작성하세요.** 기사에 전혀 나오지 않은 설비명(예: 방폭설비, 원전 노형), 제도(예: 기사에 없는 SMP, CBP, 지역별 요금제), 타 사업 내용을 외부 지식으로 끼워 넣지 마세요. 지원자가 이 특정 기사의 핵심 내용을 지원동기·직무역량·면접 답변에 어떻게 연결해 말할 수 있는지 구체적으로 1~2문장으로 적어주세요.

기사 목록:
${headlinesInput}`;

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              articles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER },
                    company: { type: Type.STRING },
                    category: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    intro: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                    interviewTip: { type: Type.STRING },
                    ncsNote: { type: Type.STRING },
                  },
                  required: [
                    'index',
                    'company',
                    'category',
                    'subtitle',
                    'intro',
                    'bullets',
                    'interviewTip',
                    'ncsNote',
                  ],
                },
              },
              quiz: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  bonusKwh: { type: Type.INTEGER },
                },
                required: ['id', 'question', 'options', 'correctIndex', 'explanation', 'bonusKwh'],
              },
              interviewTips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    company: { type: Type.STRING },
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                  },
                  required: ['id', 'company', 'question', 'answer'],
                },
              },
            },
            required: ['articles', 'quiz', 'interviewTips'],
          },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini enrichment timeout')), 15000)
      ),
    ]);
    const parsed = extractJsonObject(response.text || '');
    if (!Array.isArray(parsed.articles)) return null;

    const base = buildFallbackBriefings(items, isoDate);
    const enrichedArticles = base.articles.map((orig, idx) => {
      const e = parsed.articles.find((x: any) => x.index === idx) || parsed.articles[idx];
      if (!e) return orig;
      return {
        ...orig,
        company: String(e.company || orig.company),
        category: String(e.category || orig.category),
        subtitle: String(e.subtitle || orig.subtitle),
        intro: String(e.intro || orig.intro),
        bullets:
          Array.isArray(e.bullets) && e.bullets.length > 0
            ? e.bullets.map((b: unknown) => String(b)).filter(Boolean).slice(0, 3)
            : orig.bullets,
        interviewTip: String(e.interviewTip || orig.interviewTip),
        ncsNote: String(e.ncsNote || orig.ncsNote),
      };
    });

    return {
      articles: enrichedArticles,
      quiz: parsed.quiz || base.quiz,
      interviewTips:
        Array.isArray(parsed.interviewTips) && parsed.interviewTips.length > 0
          ? parsed.interviewTips
          : base.interviewTips,
    };
  } catch (err) {
    console.warn('Gemini enrichment skipped/fallback:', err instanceof Error ? err.message : err);
    return null;
  }
}

const NOISE_TITLE_REGEX =
  /(야구|프로야구|KBO|배구|프로배구|V리그|OK저축은행|우리카드|대한항공|KB손해보험|현대캐피탈|삼성화재|세트스코어|연승|연패|축구|K리그|EPL|NBA|감독|선수|구단|우승|결승|올림픽|월드컵|전력투구|전력 투구|전력질주|전력 질주|전력 보강|팀 전력|군 전력|국방|전투기|미사일|무기|병력|교역액 역대|정상회담|드라마|영화|배우|가수|아이돌|콘서트|예능|웹툰|유튜브|맛집|아파트 분양|청약|특징주|상한가|목표주가|매수의견|매수 의견|추돌사고|다중추돌|차량 정체|귀성길 정체|열차 지연 안내|승차권 예매|기차표 예매|관광열차)/;

const ELECTRICAL_CORPS_REGEX =
  /(한국가스공사|가스공사|한국도로공사|도로공사|코레일|한국철도공사|국가철도공단|한국수자원공사|수자원공사|K-water|지역난방공사|한국전기안전공사|전기안전공사|한국에너지공단|에너지공단|인천국제공항공사|한국공항공사|서울교통공사)/;

const CORE_POWER_TITLE_REGEX =
  /(한국전력|한전|한수원|수력원자력|전력거래소|남동발전|중부발전|서부발전|남부발전|동서발전|한전KPS|한전KDN|한국전력기술|발전5사|발전 5사|한국발전|전기요금|전력시장|전력망|전력수급|송전선|송전망|변전소|배전망|HVDC|에너지고속도로|분산에너지|분산특구|SMP|계통한계가격|비용기반정산|CBP|양수발전|ESS|석탄발전|석탄화력|복합화력|LNG\s*발전|가스터빈|원전|원자력|SMR|i-SMR|두코바니|테믈린|해상풍력|재생에너지|태양광|풍력발전|청정수소|혼소발전|온실가스|배출권거래제|2035\s*NDC|에너지\s*안보|에너지\s*대전환|데이터센터\s*전력|공공기관\s*(?:채용|통폐합|지방이전|경영평가|개혁)|공기업\s*(?:채용|통폐합|지방이전|경영평가|안전)|안전보건\s*공시|중대재해.*(?:발전|한전|한수원|공기업|공공기관))|한국가스공사|가스공사|한국도로공사|도로공사|코레일|한국철도공사|국가철도공단|한국수자원공사|수자원공사|K-water|지역난방공사|한국전기안전공사|전기안전공사|한국에너지공단|에너지공단|인천국제공항공사|한국공항공사|서울교통공사/;

function isStrictlyPowerNews(item: RssItem, userQuery: string): boolean {
  const title = item.title;
  if (NOISE_TITLE_REGEX.test(title)) {
    return false;
  }
  if (CORE_POWER_TITLE_REGEX.test(title)) {
    return true;
  }
  if (
    userQuery &&
    title.includes(userQuery) &&
    /(전력|에너지|전기|발전|한전|원전|가스|도로|철도|수자원|공기업|공공기관)/.test(
      `${title} ${item.snippet}`
    )
  ) {
    return true;
  }
  return false;
}

function scorePowerNews(item: RssItem): number {
  let score = 0;
  const t = item.title;
  if (/(한국전력|한전|한수원|전력거래소|발전5사|남동발전|중부발전|서부발전|남부발전|동서발전)/.test(t)) score += 4;
  if (ELECTRICAL_CORPS_REGEX.test(t)) score += 3;
  if (/(전력|전기|충전|전철|변전|수력|태양광|수소|열병합|안전|채용|AI|스마트)/.test(t) && ELECTRICAL_CORPS_REGEX.test(t)) {
    score += 2;
  }
  if (/(전력망|HVDC|에너지고속도로|전기요금|전력시장|SMP|송전|변전|분산에너지|ESS|양수발전|데이터센터)/.test(t)) score += 3;
  if (/(원전|SMR|두코바니|해상풍력|석탄발전|에너지\s*대전환|재생에너지)/.test(t)) score += 2;
  if (/(공공기관|채용|지방이전|경영평가|배출권거래제|2035\s*NDC)/.test(t)) score += 1;
  // Slight recency boost within last 24h
  const ageHours = Math.max(0, (Date.now() - item.timestamp) / 3600000);
  if (ageHours < 12) score += 2;
  else if (ageHours < 24) score += 1;
  return score;
}

async function fetchTodayPowerNews(category: string, userQuery: string) {
  const { isoDate, displayDate } = getKstDateParts();
  const queries = getCategorySearchQueries(category, userQuery);

  const results = await Promise.allSettled(queries.map((q) => fetchGoogleNewsRss(q)));
  let combined: RssItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      combined.push(...r.value);
    }
  }

  const getTitleBigrams = (title: string): Set<string> => {
    const clean = title.replace(/[^가-힣a-zA-Z0-9]/g, '');
    const set = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) {
      set.add(clean.slice(i, i + 2));
    }
    return set;
  };

  const isNearDuplicate = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size === 0 || b.size === 0) return false;
    let overlap = 0;
    for (const g of a) {
      if (b.has(g)) overlap++;
    }
    const minSize = Math.min(a.size, b.size);
    return overlap / minSize >= 0.45;
  };

  const filterAndDedupe = (list: RssItem[]) => {
    const keptBigrams: Set<string>[] = [];
    const companyCounts = new Map<string, number>();
    const maxPerCompany = category === '전체' || category === '전기직 공기업' ? 2 : 4;

    return list
      .filter((item) => isStrictlyPowerNews(item, userQuery))
      .filter((item) => {
        if (category === '전기직 공기업') {
          return ELECTRICAL_CORPS_REGEX.test(`${item.title} ${item.snippet}`);
        }
        return true;
      })
      .sort((a, b) => {
        const diffScore = scorePowerNews(b) - scorePowerNews(a);
        if (diffScore !== 0) return diffScore;
        return b.timestamp - a.timestamp;
      })
      .filter((item) => {
        const bg = getTitleBigrams(item.title);
        if (keptBigrams.some((prev) => isNearDuplicate(bg, prev))) {
          return false;
        }
        const comp = inferArticleMeta(item).company;
        const count = companyCounts.get(comp) || 0;
        if (count >= maxPerCompany) {
          return false;
        }
        keptBigrams.push(bg);
        companyCounts.set(comp, count + 1);
        return true;
      });
  };

  const allFiltered = filterAndDedupe(combined);
  let deduped: RssItem[];

  if (category === '전체' && !userQuery) {
    const corpsItems = allFiltered.filter((it) => ELECTRICAL_CORPS_REGEX.test(it.title)).slice(0, 3);
    const coreItems = allFiltered.filter((it) => !ELECTRICAL_CORPS_REGEX.test(it.title)).slice(0, 5);
    deduped = [...coreItems, ...corpsItems]
      .sort((a, b) => scorePowerNews(b) - scorePowerNews(a))
      .slice(0, 8);
  } else {
    deduped = allFiltered.slice(0, 8);
  }

  if (deduped.length < 4 && !userQuery) {
    const fallbackRss = await fetchGoogleNewsRss(
      '(한국전력공사 OR 한국수력원자력 OR 한국가스공사 OR 한국도로공사 OR 코레일 OR 수자원공사 OR 전기요금 OR 전력망 OR 발전5사 OR 원전) when:5d'
    );
    combined = [...combined, ...fallbackRss];
    deduped = filterAndDedupe(combined).slice(0, 8);
  }

  if (deduped.length === 0) {
    throw new Error('현재 검색 조건에 해당하는 전력·에너지·전기직 공기업 뉴스를 찾지 못했습니다.');
  }

  const hydrated = await hydrateArticlesWithRealBody(deduped);
  const enriched = await enrichWithGeminiIfAvailable(hydrated, isoDate);
  const finalContent = enriched || buildFallbackBriefings(hydrated, isoDate);

  return {
    date: isoDate,
    displayDate,
    articles: finalContent.articles,
    quiz: finalContent.quiz,
    interviewTips: finalContent.interviewTips,
    groundingSources: hydrated.map((it) => ({
      title: `${it.sourceName} · ${it.title.slice(0, 28)}...`,
      uri: it.link,
    })),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/news', async (req, res) => {
    const category = String(req.query.category || '전체').trim();
    const query = String(req.query.q || '').trim();
    const refresh = req.query.refresh === '1';
    const { isoDate } = getKstDateParts();
    const cacheKey = `${isoDate}::${category}::${query}`;

    if (!refresh) {
      const cached = newsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.payload);
        return;
      }
    }

    try {
      const payload = await fetchTodayPowerNews(category, query);
      newsCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      });
      res.json(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '오늘의 전력 뉴스를 불러오는 중 오류가 발생했습니다.';
      console.error('/api/news error:', error);
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
