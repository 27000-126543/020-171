export type ScenarioType = 'implant' | 'orthodontic' | 'pediatric' | 'cleaning'

export type WeaknessDimension = 'child_comfort' | 'high_price_explanation' | 'followup_guidance' | 'risk_disclosure' | 'value_delivery'

export const WEAKNESS_DIMENSION_LABELS: Record<WeaknessDimension, string> = {
  child_comfort: '儿童安抚',
  high_price_explanation: '高价项目解释',
  followup_guidance: '复诊引导',
  risk_disclosure: '风险告知',
  value_delivery: '价值传递',
}

export type TagType =
  | 'price_unclear'
  | 'risk_informed'
  | 'followup_missing'
  | 'overpromise'
  | 'empathy_good'
  | 'child_comfort'
  | 'urgency_appropriate'
  | 'consent_unclear'
  | 'value_demonstrated'
  | 'referral_missed'

export interface Store {
  id: string
  name: string
  region: string
  healthScore: number
  weeklyAnnotationCount: number
  weeklyIssueCount: number
  satisfactionAvg: number
}

export interface RecordingSummary {
  patientConcern: string
  doctorResponse: string
  conversionResult: string
}

export interface Recording {
  id: string
  storeId: string
  storeName: string
  doctorId: string
  doctorCode: string
  patientType: string
  scenario: ScenarioType
  duration: number
  date: string
  satisfactionScore: number
  isAnnotated: boolean
  summary: RecordingSummary
}

export interface Annotation {
  id: string
  recordingId: string
  tags: TagType[]
  suggestion: string
  annotator: string
  createdAt: string
}

export interface ScriptEntry {
  id: string
  title: string
  scenario: ScenarioType
  content: string
  patientProfile: string
  usageBoundary: string
  satisfactionScore: number
  referenceCount: number
  tags: TagType[]
  storeId: string
  createdAt: string
}

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  implant: '种植咨询',
  orthodontic: '正畸初诊',
  pediatric: '儿童牙科',
  cleaning: '洁牙转化',
}

export const TAG_LABELS: Record<TagType, string> = {
  price_unclear: '价格解释不清',
  risk_informed: '风险告知充分',
  followup_missing: '复诊引导缺失',
  overpromise: '过度承诺风险',
  empathy_good: '共情表达良好',
  child_comfort: '儿童安抚得当',
  urgency_appropriate: '紧迫感把控适当',
  consent_unclear: '知情同意不清晰',
  value_demonstrated: '价值传递到位',
  referral_missed: '转介绍机会遗漏',
}

export const TAG_CATEGORY: Record<TagType, 'positive' | 'negative'> = {
  price_unclear: 'negative',
  risk_informed: 'positive',
  followup_missing: 'negative',
  overpromise: 'negative',
  empathy_good: 'positive',
  child_comfort: 'positive',
  urgency_appropriate: 'positive',
  consent_unclear: 'negative',
  value_demonstrated: 'positive',
  referral_missed: 'negative',
}

export const PATIENT_TYPES = ['初诊患者', '复诊患者', '转诊患者', '家属陪同']
