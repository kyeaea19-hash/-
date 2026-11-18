import { BriefingQuiz, InterviewTip } from '../types/powerplant';

export const NEWS_FILTERS = [
  '전체',
  '전기직 공기업',
  '전력시장·요금',
  '전력망·계통',
  '원전·SMR',
  '발전5사·재생e',
  '공기업·채용',
  '탄소·안전·거시',
  '한국전력',
  '한국수력원자력',
] as const;

export const FALLBACK_INTERVIEW_TIPS: InterviewTip[] = [
  {
    id: 'tip-hvdc',
    company: '전력망·계통',
    question: 'Q. 초고압 직류 송전(HVDC) 및 에너지고속도로의 핵심 장점은?',
    answer:
      '교류(AC) 방식보다 장거리 대용량 송전 손실이 적고, 주파수가 다른 전력망 연계 및 해상풍력·태양광 계통 안정화에 매우 유연합니다.',
  },
  {
    id: 'tip-cbp-smp',
    company: '전력시장·요금',
    question: 'Q. 비용기반정산제도(CBP)와 SMP(계통한계가격)란 무엇인가요?',
    answer:
      'CBP는 발전기의 변동비(연료비)를 기준으로 정산하는 현행 전력시장 구조이며, SMP는 해당 시간대 전력 수요를 맞추기 위해 투입된 마지막 발전기의 발전단가로 결정됩니다.',
  },
  {
    id: 'tip-distributed',
    company: '분산에너지·요금제',
    question: 'Q. 지역별 차등 전기요금제와 분산에너지 특구 추진 배경은?',
    answer:
      '발전소와 수요처(수도권·AI 데이터센터)의 불일치로 인한 송전망 병목을 완화하고, 전력 자립도가 높은 지역으로 수요 분산을 유도하기 위함입니다.',
  },
];

export const DEFAULT_QUIZ: BriefingQuiz = {
  id: 'quiz-default-grid',
  question:
    'Q. 전력시장에서 특정 시간대 전력 수요를 충당하기 위해 마지막으로 투입되는 한계발전기의 발전단가로 결정되는 시장가격은 무엇일까요?',
  options: ['① CBP', '② SMP (계통한계가격)', '③ REC', '④ NDC'],
  correctIndex: 1,
  explanation:
    'SMP(System Marginal Price, 계통한계가격)는 전력거래소에서 거래되는 도매 전력가격으로, 가장 비싼 연료비를 가진 발전기의 변동비로 결정됩니다.',
  bonusKwh: 1,
};
