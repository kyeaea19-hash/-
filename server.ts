import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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
  interviewTip: string;
  ncsNote: string;
} {
  const t = item.title;
  if (/한국가스공사|가스공사/.test(t)) {
    return {
      company: '한국가스공사',
      category: '전기직 공기업',
      visualTheme: 'hydrogen',
      interviewTip:
        'LNG 천연가스 수급·배관망 및 인수기지 전기설비(변전·방폭설비) 안전관리, 수소·탄소중립 인프라 전환 전략을 함께 점검해 두세요.',
      ncsNote: '면접·전공 핵심: 방폭 전기설비 · LNG/수소 인프라 · 계통 안전',
    };
  }
  if (/한국도로공사|도로공사/.test(t)) {
    return {
      company: '한국도로공사',
      category: '전기직 공기업',
      visualTheme: 'solar',
      interviewTip:
        '고속도로 휴게소 초급속 전기차(EV) 충전 인프라, 터널·스마트톨링 전력 및 조명 설비, 도로 유휴부지 태양광 확대 과제를 정리해 두세요.',
      ncsNote: '면접·전공 핵심: EV 초급속 충전망 · 터널 수배전 설비 · 도로 태양광',
    };
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
      interviewTip:
        '전철변전소·전차선 급전시스템(단권변압기 AT방식 등) 안정화, 철도 전력설비 AI 예지보전 및 중대재해 예방 대책을 꼭 연결해 보세요.',
      ncsNote: '면접·전공 핵심: 전기철도 급전계통 · 철도변전소 · 설비 안전',
    };
  }
  if (/수자원공사|K-water/.test(t)) {
    return {
      company: '한국수자원공사',
      category: '전기직 공기업',
      visualTheme: 'offshore',
      interviewTip:
        '다목적댐 수력·조력 발전과 수상태양광·수열에너지·그린수소 등 물-에너지 융합 사업에서의 전기설비 유지관리 역할을 정리하세요.',
      ncsNote: '면접·전공 핵심: 수력·조력 발전 · 수상태양광 · 수열에너지',
    };
  }
  if (/지역난방공사/.test(t)) {
    return {
      company: '한국지역난방공사',
      category: '전기직 공기업',
      visualTheme: 'solar',
      interviewTip:
        '열병합발전(CHP) 기반 집단에너지 효율화와 분산에너지 특구 내 열·전력 연계 운영 방안을 면접 답변에 녹여보세요.',
      ncsNote: '면접·전공 핵심: 열병합발전(CHP) · 분산전원 · 에너지 효율',
    };
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
      interviewTip:
        '신재생·ESS·전기설비 안전진단 및 법정검사, 공항·국가 기반시설 무정전 전력계통(UPS·비상발전) 운영 역량을 강조해 보세요.',
      ncsNote: '면접·전공 핵심: 전기설비 안전관리 · ESS 검사 · 무정전 계통',
    };
  }
  if (/원전|SMR|두코바니|테믈린|한수원|원자력/.test(t)) {
    return {
      company: t.includes('한수원') ? '한국수력원자력' : '원전·SMR',
      category: '원전·에너지',
      visualTheme: t.includes('SMR') ? 'smr' : 'nuclear',
      interviewTip:
        '무탄소 기저전원으로서 원전·SMR의 역할과 수출 경쟁력(APR1000/APR1400), 수용성·안전성 강화 방안을 함께 정리해 두세요.',
      ncsNote: '면접·전공 핵심: 제11차 전기본 · SMR · 원전 생태계',
    };
  }
  if (/송전|변전|HVDC|전력망|에너지고속도로|계통/.test(t)) {
    return {
      company: t.includes('한전') ? '한국전력' : '전력망·계통',
      category: '송배전·인프라',
      visualTheme: 'grid',
      interviewTip:
        '재생에너지·원전 전력을 수도권 및 AI 데이터센터로 보내기 위한 전력망 적기 확충과 주민 수용성·보상 현실화 과제를 연결해 답변해 보세요.',
      ncsNote: '면접·전공 핵심: 국가기간 전력망 특별법 · HVDC · 계통 안정화',
    };
  }
  if (/요금|한전|실적|부채|SMP|전력시장|데이터센터|분산/.test(t)) {
    return {
      company: t.includes('한전') ? '한국전력' : '전력시장·요금',
      category: '시장·재무',
      visualTheme: 'solar',
      interviewTip:
        '한전 재무구조와 SMP·연료비 연동제, 지역별 차등 요금제 및 분산에너지 특구가 산업 경쟁력에 미치는 영향을 꼭 짚어보세요.',
      ncsNote: '면접·전공 핵심: SMP · CBP 정산 · 지역별 요금제',
    };
  }
  if (/풍력|태양광|수소|석탄|발전5사|남동|중부|서부|남부|동서|ESS|양수/.test(t)) {
    return {
      company: '발전5사·재생e',
      category: '에너지전환',
      visualTheme: /풍력/.test(t) ? 'offshore' : 'hydrogen',
      interviewTip:
        '석탄화력 폐지에 따른 정의로운 전환, 수소·암모니아 혼소, ESS·양수발전을 통한 유연성 자원 확보 전략을 정리해 두세요.',
      ncsNote: '면접·전공 핵심: 정의로운 전환 · 유연성 자원 · ESS',
    };
  }
  if (/공공기관|채용|지방이전|경영평가|산재|중대재해|안전|4\.5일/.test(t)) {
    return {
      company: '공기업·정책',
      category: '공공기관·안전',
      visualTheme: 'grid',
      interviewTip:
        '공공기관 경영평가(AI 혁신·안전 지표), 중대재해 예방 및 위험성 평가, 지방이전·기능 개혁 등 최근 공공기관 거버넌스 흐름을 확인하세요.',
      ncsNote: '면접·인성 핵심: 공공기관 경영평가 · 안전보건 · 공공성',
    };
  }
  return {
    company: '에너지·거시',
    category: '산업·탄소',
    visualTheme: 'solar',
    interviewTip:
      '국제 유가·LNG 가격·환율 변동 및 2035 NDC·배출권거래제 변화가 국내 발전단가와 전력공기업 경영에 미치는 영향을 연결해 보세요.',
    ncsNote: '면접·시사 핵심: 에너지 안보 · 2035 NDC · 배출권거래제',
  };
}

function splitFactualSentences(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = rawText
    .replace(/\[[^\]]*(?:제공|캡처|사진|자료|연합뉴스|뉴시스|뉴스1)[^\]]*\]/g, ' ')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
    .replace(/\([^)]*=\s*[^)]+\)\s*[가-힣]{2,4}\s*기자\s*=/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matches = cleaned.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const out: string[] = [];
  for (const m of matches) {
    const s = m.trim();
    if (s.length >= 18 && s.length <= 240 && /[가-힣]/.test(s)) {
      out.push(s);
    }
    if (out.length >= 5) break;
  }
  return out;
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
      interviewTip: meta.interviewTip,
      ncsNote: meta.ncsNote,
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
    question: `Q. "${a.title.slice(0, 42)}${a.title.length > 42 ? '...' : ''}" 이슈가 전력 공기업에 주는 시사점은?`,
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

[가장 중요한 절대 원칙 — 사실 충실성]
1. subtitle, intro, bullets에는 **반드시 아래 제공된 기사 제목과 기사 본문 발췌에 명시적으로 적힌 사실·수치·기관·인물·발언만** 요약하세요.
2. **기사에 없는 수치, 날짜, 원인, 향후 전망, 다른 기업 사례, 과장·추측 내용을 절대 지어내어 추가하지 마세요.**
3. 본문 발췌가 짧거나 부족할 경우, 억지로 3줄을 채우려고 없는 내용을 덧붙이지 말고 확인된 사실만으로 1~2줄만 간결하게 작성하세요.

기사 목록:
${headlinesInput}

아래 JSON 형식만 반환하세요:
{
  "articles": [
    {
      "index": 0,
      "company": "핵심 기관 또는 분야 태그 (2~8글자, 예: 한국전력, 한국가스공사, 한국도로공사, 코레일, 원전·SMR, 전력시장)",
      "category": "세부 카테고리 (2~8글자)",
      "subtitle": "기사 내용에 근거한 한 줄 부제",
      "intro": "기사에 적힌 사실만 담은 1~2문장 도입 설명",
      "bullets": ["기사 본문에 근거한 핵심 사실 1", "기사 본문에 근거한 핵심 사실 2"],
      "interviewTip": "기사 주제 키워드와 연결한 취준 학습 포인트 1문장 (기사 외 사실을 기사 사실인 것처럼 쓰지 말 것)",
      "ncsNote": "면접·NCS 키워드 한 줄"
    }
  ],
  "quiz": {
    "id": "quiz-${isoDate}",
    "question": "Q. 위 제공된 오늘 기사 내용만으로 풀 수 있는 4지선다 퀴즈 1문제",
    "options": ["① 보기1", "② 보기2", "③ 보기3", "④ 보기4"],
    "correctIndex": 0,
    "explanation": "기사에 명시된 내용만 근거로 한 정답 해설 1~2문장",
    "bonusKwh": 1
  },
  "interviewTips": [
    {
      "id": "tip-1",
      "company": "분야명",
      "question": "Q. 위 기사 주제 기반 면접 대비 질문",
      "answer": "면접 답변 방향 2문장"
    }
  ]
}`;

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini enrichment timeout')), 8000)
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
  } catch {
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
