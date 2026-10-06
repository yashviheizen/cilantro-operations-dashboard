// DEMO DATA — transactional records (service lines, weekly planning, issues, changes).
// Baseline records are generated per site; named scenarios override them below.

import { CAFES, CALENDAR_EXCEPTIONS, SITES } from './masters';
import { TODAY, TOMORROW } from './clock';
import type { Change, DishLine, Issue, Meal, ServiceLine, StageRecord, WeeklyPlanning } from './types';

// ---------------------------------------------------------------- people (fictional)

export const PEOPLE = {
  priya: { name: 'Priya Nair', role: 'Unit manager · Floor 8' },
  sneha: { name: 'Sneha Kulkarni', role: 'Unit manager · Floor 11' },
  rahul: { name: 'Rahul Menon', role: 'Unit manager · Atrium' },
  aman: { name: 'Aman Gupta', role: 'Unit manager · Riverside' },
  deepa: { name: 'Deepa Iyer', role: 'Unit manager · Harbour Point' },
  arjun: { name: 'Arjun Rao', role: 'CPU chef · Hyderabad' },
  meera: { name: 'Meera Bhatt', role: 'CPU chef · Gurgaon' },
  farah: { name: 'Farah Sheikh', role: 'Chef · Harbour Point' },
  vikram: { name: 'Vikram Joshi', role: 'CPU coordinator' },
  kiran: { name: 'Kiran Das', role: 'Implementation team' },
  manoj: { name: 'Manoj Pillai', role: 'Store lead · Hyderabad' },
  ravi: { name: 'Ravi Shetty', role: 'Dispatch lead · Gurgaon' },
} as const;

/** Everyone who can be assigned in the demo. */
export const ASSIGNABLE = Object.values(PEOPLE);

// ---------------------------------------------------------------- site timing (demo)

interface SiteTiming {
  mrCutoff: string;
  exportAt: string;
  exportDone: boolean;
  exportLabel: string;
  indentDue: string;
  indentDone?: string;
  handoffDue: string;
  handoffAck?: string;
}

const TIMING: Record<string, SiteTiming> = {
  lakeview: { mrCutoff: '12:00', exportAt: '12:00', exportDone: true, exportLabel: 'Export v1 · 12:00', indentDue: '16:00', indentDone: '12:30', handoffDue: '18:00', handoffAck: '13:20' },
  riverside: { mrCutoff: '13:00', exportAt: '15:00', exportDone: false, exportLabel: 'Export due 15:00', indentDue: '16:30', handoffDue: '18:00' },
  harbour: { mrCutoff: '14:00', exportAt: '11:00', exportDone: true, exportLabel: 'Export v1 · 11:00 (final 16:00)', indentDue: '16:30', indentDone: '12:45', handoffDue: '18:00' },
};

const DISPATCH_DUE: Record<Meal, string> = { Breakfast: '07:00', Lunch: '11:30', Snacks: '15:30', Dinner: '19:00' };

const PAX: Record<string, number> = {
  'lv-f8': 270, 'lv-f11': 180, 'lv-atr': 520, 'rv-a': 300, 'rv-b': 150, 'hp-main': 400, 'hp-exec': 60, 'hp-well': 120,
};

const kg = (pax: number, grams: number) => Math.round((pax * grams) / 500) / 2; // nearest 0.5 kg

function baseDishes(cafeId: string, meal: Meal): DishLine[] {
  const p = PAX[cafeId];
  const g = (dishId: string, grams: number): DishLine => {
    const q = { value: kg(p, grams), unit: 'kg' as const };
    return { dishId, portion: `${grams} g`, projected: q, mr: q, sourcing: 'CPU' };
  };
  const pcs = (dishId: string, perPax: number, portion: string): DishLine => {
    const q = { value: p * perPax, unit: 'pcs' as const };
    return { dishId, portion, projected: q, mr: q, sourcing: 'CPU' };
  };
  switch (meal) {
    case 'Breakfast':
      return [pcs('rava-idli', 2, '40 g piece'), g('tiffin-sambar', 50), g('poha', 150)];
    case 'Lunch':
      return [g('jeera-rice', 150), g('achari-dal', 120), g('paneer-butter-masala', 120)];
    case 'Snacks':
      return [pcs('veg-puff', 1, '1 piece'), g('mint-chutney', 30)];
    case 'Dinner':
      return [pcs('chapati', 2, '1 piece'), g('mixed-veg', 120), g('steamed-rice', 150)];
  }
}

function at(date: string, time: string) {
  return `${date}T${time}`;
}

function prevDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function baseline(cafeId: string, siteId: string, date: string, meal: Meal): ServiceLine {
  const t = TIMING[siteId];
  const d1 = prevDay(date);
  const dispatchDue = at(date, DISPATCH_DUE[meal]);
  const isToday = date === TODAY;

  const stages: ServiceLine['stages'] = {
    menuPublication: { fact: 'done', dueAt: '2026-10-06T18:00', doneAt: '2026-10-06T16:40', label: 'Published v1' },
    menuSelection: { fact: 'done', dueAt: '2026-10-07T18:00', doneAt: '2026-10-07T11:05', label: 'Selected' },
    finalOrder: { fact: 'done', dueAt: at(d1, t.mrCutoff), doneAt: at(d1, '10:20'), label: 'Submitted' },
    productionPlan: isToday
      ? { fact: 'done', dueAt: at(d1, t.exportAt), doneAt: at(d1, t.exportAt), label: 'Final export' }
      : t.exportDone
        ? { fact: 'done', dueAt: at(d1, t.exportAt), doneAt: at(d1, t.exportAt), label: t.exportLabel }
        : { fact: 'not_done', dueAt: at(d1, t.exportAt), label: t.exportLabel },
    ingredientRequest: isToday
      ? { fact: 'done', dueAt: at(d1, t.indentDue), doneAt: at(d1, '14:10'), label: 'Submitted' }
      : t.indentDone
        ? { fact: 'done', dueAt: at(d1, t.indentDue), doneAt: at(d1, t.indentDone), label: 'Submitted' }
        : { fact: 'not_done', dueAt: at(d1, t.indentDue), label: 'Not submitted' },
    storeHandoff: isToday
      ? { fact: 'done', dueAt: at(d1, t.handoffDue), doneAt: at(d1, '17:30'), label: 'Store confirmed receipt' }
      : t.handoffAck
        ? { fact: 'done', dueAt: at(d1, t.handoffDue), doneAt: at(d1, t.handoffAck), label: 'Exported · store confirmed' }
        : { fact: 'not_done', dueAt: at(d1, t.handoffDue), label: 'Not exported' },
    cookingDispatch:
      isToday && dispatchDue < '2026-10-13T13:30'
        ? { fact: 'done', dueAt: dispatchDue, doneAt: at(date, meal === 'Breakfast' ? '06:48' : '11:18'), label: 'Dispatch confirmed', note: 'Confirmed manually by dispatch team (demo). Delivery receipt is not tracked.' }
        : { fact: 'not_done', dueAt: dispatchDue, label: 'Not due yet' },
  };
  return { cafeId, date, meal, stages, dishes: baseDishes(cafeId, meal) };
}

function notApplicable(cafeId: string, date: string, meal: Meal, reason: string): ServiceLine {
  const na: StageRecord = { fact: 'not_applicable', label: 'Not applicable', note: reason };
  return {
    cafeId, date, meal, dishes: [],
    stages: { menuPublication: na, menuSelection: na, finalOrder: na, productionPlan: na, ingredientRequest: na, storeHandoff: na, cookingDispatch: na },
  };
}

type Override = (l: ServiceLine) => void;
const key = (cafeId: string, date: string, meal: Meal) => `${cafeId}|${date}|${meal}`;

/** Named scenarios from the brief (numbers in comments match section 6). */
const SCENARIOS: Record<string, Override> = {
  // 5 — 40 kg → 400 kg, no reason recorded
  [key('lv-f8', TOMORROW, 'Lunch')]: (l) => {
    const rice = l.dishes.find((d) => d.dishId === 'jeera-rice')!;
    rice.projected = { value: 40, unit: 'kg' };
    rice.mr = { value: 400, unit: 'kg' };
    l.stages.finalOrder = { fact: 'needs_review', dueAt: '2026-10-13T12:00', doneAt: '2026-10-13T11:52', label: 'Unusual change', note: 'Jeera Rice 40 → 400 kg; reason not recorded.', clearedByIssueId: 'ISS-101' };
    // 7 — approved EMR after the 12:00 export
    l.dishes.push({ dishId: 'dal-makhani', portion: '120 g', emr: { value: 18, unit: 'kg' }, pax: 150, sourcing: 'CPU' });
    l.stages.productionPlan = { fact: 'needs_review', dueAt: '2026-10-13T12:00', doneAt: '2026-10-13T12:00', label: 'Export v1 outdated', note: 'EMR added 12:40 after export v1. Next export 15:00.', clearedByIssueId: 'ISS-102' };
    l.stages.ingredientRequest = { fact: 'needs_review', dueAt: '2026-10-13T16:00', doneAt: '2026-10-13T12:30', label: 'Missing EMR ingredients', note: 'Submitted 12:30 — before the EMR. Dal Makhani ingredients not requested.', clearedByIssueId: 'ISS-102' };
  },
  // 4 — MR missing for tomorrow's lunch
  [key('lv-atr', TOMORROW, 'Lunch')]: (l) => {
    l.dishes.forEach((d) => (d.mr = undefined));
    l.stages.finalOrder = { fact: 'not_done', dueAt: '2026-10-13T12:00', label: 'Not submitted' };
    l.stages.productionPlan = { fact: 'blocked', dueAt: '2026-10-13T12:00', label: 'No demand in export', note: 'Export v1 has no Atrium lunch demand.' };
    l.stages.ingredientRequest = { fact: 'blocked', label: 'Waiting for final order' };
    l.stages.storeHandoff = { fact: 'blocked', label: 'Waiting for final order' };
  },
  // 12 — substitution written in remarks; 10 — missing article mapping
  [key('lv-f11', TOMORROW, 'Lunch')]: (l) => {
    const dal = l.dishes.find((d) => d.dishId === 'achari-dal')!;
    dal.remark = 'Need Dal Makhani against Achari Dal';
    l.dishes.push({ dishId: 'coconut-chutney', portion: '30 g', projected: { value: 5.5, unit: 'kg' }, mr: { value: 5.5, unit: 'kg' }, sourcing: 'CPU' });
    l.stages.finalOrder = { fact: 'needs_review', dueAt: '2026-10-13T12:00', doneAt: '2026-10-13T11:30', label: 'Substitution in remarks', note: 'Remark asks for Dal Makhani; structured line is Achari Dal.', clearedByIssueId: 'ISS-104' };
    l.stages.ingredientRequest = { fact: 'needs_review', dueAt: '2026-10-13T16:00', doneAt: '2026-10-13T12:30', label: 'Cost incomplete', note: 'Frozen grated coconut has no purchase article mapping.', clearedByIssueId: 'ISS-105' };
  },
  // 9 — dish missing its recipe
  [key('rv-a', TOMORROW, 'Breakfast')]: (l) => {
    l.dishes[2] = { dishId: 'millet-upma', portion: '150 g', projected: { value: 45, unit: 'kg' }, mr: { value: 45, unit: 'kg' }, sourcing: 'CPU' };
    l.stages.ingredientRequest = { fact: 'blocked', dueAt: '2026-10-13T16:30', label: 'Recipe missing', note: 'Millet Upma has no recipe; its ingredients cannot be calculated.', clearedByIssueId: 'ISS-111' };
  },
  // 6 — legitimate cancellation to zero (no issue raised)
  [key('rv-a', TOMORROW, 'Lunch')]: (l) => {
    const p = l.dishes.find((d) => d.dishId === 'paneer-butter-masala')!;
    p.projected = { value: 45, unit: 'kg' };
    p.mr = { value: 0, unit: 'kg' };
    p.remark = 'Visiting delegation cancelled';
  },
  // 11 — paratha through both CPU and stock transfer
  [key('rv-a', TOMORROW, 'Dinner')]: (l) => {
    l.dishes = [
      { dishId: 'egg-curry', portion: '120 g', projected: { value: 36, unit: 'kg' }, mr: { value: 36, unit: 'kg' }, sourcing: 'CPU' },
      { dishId: 'paratha', portion: '1 piece', projected: { value: 200, unit: 'pcs' }, mr: { value: 200, unit: 'pcs' }, sourcing: 'CPU' },
      { dishId: 'paratha', portion: '1 piece', mr: { value: 200, unit: 'pcs' }, sourcing: 'SAP stock transfer (STO)' },
    ];
    l.stages.finalOrder = { fact: 'needs_review', dueAt: '2026-10-13T13:00', doneAt: '2026-10-13T13:05', label: 'Possible duplicate', note: 'Paratha 200 pcs via CPU and 200 pcs via STO.', clearedByIssueId: 'ISS-112' };
  },
  // 1 — menu saved but not (re)published
  [key('hp-main', TOMORROW, 'Snacks')]: (l) => {
    l.stages.menuPublication = { fact: 'needs_review', dueAt: '2026-10-13T14:00', doneAt: '2026-10-06T16:40', label: 'v2 saved, not published', note: 'Chef saved v2 (Samosa replaces Veg Puff) at 10:15. Units still see v1.', clearedByIssueId: 'ISS-107' };
  },
  // 8 — late change after the ingredient request was submitted
  [key('hp-main', TOMORROW, 'Lunch')]: (l) => {
    const p = l.dishes.find((d) => d.dishId === 'paneer-butter-masala')!;
    p.projected = { value: 100, unit: 'kg' };
    p.mr = { value: 130, unit: 'kg' };
    l.stages.ingredientRequest = { fact: 'needs_review', dueAt: '2026-10-13T16:30', doneAt: '2026-10-13T12:45', label: 'Changed after submission', note: 'Paneer Butter Masala +30 kg at 13:10, after the 12:45 indent.', clearedByIssueId: 'ISS-108' };
  },
  // 14 — custom "Other" dish
  [key('hp-main', TOMORROW, 'Breakfast')]: (l) => {
    l.dishes.push({ dishId: 'other-kerala-chutney', portion: '40 g', emr: { value: 6, unit: 'kg' }, pax: 150, sourcing: 'Local kitchen' });
    l.stages.ingredientRequest = { fact: 'needs_review', dueAt: '2026-10-13T16:30', doneAt: '2026-10-13T12:45', label: 'No ingredient plan', note: 'Custom “Other” dish has no recipe or explicit ingredient plan.', clearedByIssueId: 'ISS-109' };
  },
  // Harbour dinner MR not yet due (cutoff 14:00) — pending, not an issue
  [key('hp-main', TOMORROW, 'Dinner')]: (l) => {
    l.dishes.forEach((d) => (d.mr = undefined));
    l.stages.finalOrder = { fact: 'not_done', dueAt: '2026-10-13T14:00', label: 'Draft — not submitted' };
    l.stages.productionPlan = { fact: 'not_done', dueAt: '2026-10-13T16:00', label: 'Final export 16:00' };
    l.stages.ingredientRequest = { fact: 'not_done', dueAt: '2026-10-13T16:30', label: 'Not submitted' };
  },
  // 13 — export outdated after an approved change
  [key('hp-exec', TOMORROW, 'Lunch')]: (l) => {
    l.dishes = [
      { dishId: 'veg-pulao', portion: '150 g', projected: { value: 9, unit: 'kg' }, mr: { value: 13.5, unit: 'kg' }, sourcing: 'CPU' },
      { dishId: 'dal-makhani', portion: '120 g', projected: { value: 7, unit: 'kg' }, mr: { value: 11, unit: 'kg' }, sourcing: 'CPU' },
    ];
    l.stages.productionPlan = { fact: 'needs_review', dueAt: '2026-10-13T16:00', doneAt: '2026-10-13T11:00', label: 'Export v1 outdated', note: 'Approved change at 12:20 is not in export v1 (11:00).', clearedByIssueId: 'ISS-110' };
  },
  // 16 — today's lunch dispatch status unavailable
  [key('rv-a', TODAY, 'Lunch')]: (l) => {
    l.stages.cookingDispatch = { fact: 'unknown', dueAt: '2026-10-13T11:30', label: 'Data unavailable', note: 'Dispatch export 10:30 exists; Produced/Dispatched columns are blank. Delivery not confirmed.' };
  },
};

// Lakeview Floor 11 handoff exported but not acknowledged (scenario 15)
const HANDOFF_UNACKED = ['lv-f11'];

function buildServiceLines(): ServiceLine[] {
  const out: ServiceLine[] = [];
  for (const date of [TODAY, TOMORROW]) {
    for (const cafe of CAFES) {
      const exc = CALENDAR_EXCEPTIONS.find((e) => e.cafeId === cafe.id && e.date === date);
      for (const meal of cafe.meals) {
        if (exc && (exc.meals === 'all' || exc.meals.includes(meal))) {
          out.push(notApplicable(cafe.id, date, meal, exc.reason));
          continue;
        }
        const line = baseline(cafe.id, cafe.siteId, date, meal);
        if (date === TOMORROW && HANDOFF_UNACKED.includes(cafe.id)) {
          line.stages.storeHandoff = { fact: 'unknown', dueAt: '2026-10-13T18:00', doneAt: '2026-10-13T13:05', label: 'Exported · receipt not confirmed', note: 'Article export sent 13:05. No store acknowledgment yet.', clearedByIssueId: 'ISS-106' };
        }
        SCENARIOS[key(cafe.id, date, meal)]?.(line);
        out.push(line);
      }
    }
  }
  return out;
}

export const SERVICE_LINES: ServiceLine[] = buildServiceLines();

// ---------------------------------------------------------------- weekly planning

function weekly(cafeId: string, weekId: string, over: Partial<WeeklyPlanning> = {}): WeeklyPlanning {
  const siteId = CAFES.find((c) => c.id === cafeId)!.siteId;
  const W42 = weekId === '2026-W42';
  const projDue = siteId === 'riverside' ? (W42 ? '2026-10-06T12:00' : '2026-10-13T12:00') : W42 ? '2026-10-07T18:00' : '2026-10-14T18:00';
  return {
    cafeId,
    weekId,
    menuPublication: { fact: 'done', dueAt: W42 ? '2026-10-06T18:00' : '2026-10-13T18:00', doneAt: W42 ? '2026-10-06T16:40' : '2026-10-12T16:10', label: 'Published' },
    menuSelection: { fact: 'done', dueAt: projDue, doneAt: W42 ? '2026-10-07T11:05' : '2026-10-13T09:40', label: 'Selected' },
    weeklyProjection: W42
      ? { fact: 'done', dueAt: projDue, doneAt: W42 ? '2026-10-06T10:30' : undefined, label: 'Submitted · locked' }
      : { fact: 'not_done', dueAt: projDue, label: 'Draft saved' },
    projectedTotal: W42 ? { value: Math.round(PAX[cafeId] * 0.55 * 5), unit: 'kg' } : undefined,
    ...over,
  };
}

export const WEEKLY_PLANNING: WeeklyPlanning[] = [
  ...CAFES.map((c) => weekly(c.id, '2026-W42')),
  weekly('lv-f8', '2026-W43'),
  // 2 — one cafe missing selection while another at the same site is complete
  weekly('lv-f11', '2026-W43', {
    menuSelection: { fact: 'not_done', dueAt: '2026-10-14T18:00', label: 'No selection', note: 'Projection screen shows “No Data Found” for this cafe.' },
    weeklyProjection: { fact: 'blocked', dueAt: '2026-10-14T18:00', label: 'Blocked — no selection', note: 'Projection needs the cafe’s menu selection first.' },
  }),
  weekly('lv-atr', '2026-W43', { weeklyProjection: { fact: 'done', dueAt: '2026-10-14T18:00', doneAt: '2026-10-13T09:15', label: 'Submitted' }, projectedTotal: { value: 410, unit: 'kg' } }),
  // 3 — projection not submitted before the local cutoff
  weekly('rv-a', '2026-W43', { weeklyProjection: { fact: 'not_done', dueAt: '2026-10-13T12:00', label: 'Not submitted · entry locked', note: 'After cutoff, quantity entry, Reset and Submit are disabled (existing behaviour).' } }),
  weekly('rv-b', '2026-W43', { weeklyProjection: { fact: 'done', dueAt: '2026-10-13T12:00', doneAt: '2026-10-13T11:20', label: 'Submitted · locked' }, projectedTotal: { value: 330, unit: 'kg' } }),
  weekly('hp-main', '2026-W43', { weeklyProjection: { fact: 'done', dueAt: '2026-10-14T18:00', doneAt: '2026-10-13T12:05', label: 'Submitted' }, projectedTotal: { value: 1120, unit: 'kg' } }),
  weekly('hp-exec', '2026-W43'),
  weekly('hp-well', '2026-W43', { weeklyProjection: { fact: 'done', dueAt: '2026-10-14T18:00', doneAt: '2026-10-12T17:00', label: 'Submitted' }, projectedTotal: { value: 160, unit: 'kg' } }),
];

// ---------------------------------------------------------------- issues

const svc = (date: string, meal?: Meal) => ({ kind: 'service' as const, date, meal });
const wk = (weekId: string) => ({ kind: 'week' as const, weekId });

export const SEED_ISSUES: Issue[] = [
  {
    id: 'ISS-101', title: 'Lunch order increased from 40 kg to 400 kg', short: 'Quantity needs confirmation', severity: 'critical', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f8', scope: svc(TOMORROW, 'Lunch'), stage: 'finalOrder',
    whatHappened: 'The final order (MR) for Jeera Rice (150 g portion) changed from 40 kg to 400 kg at 11:52, just before the 12:00 cutoff. No reason was recorded. Export v1 (12:00) already carries 400 kg.',
    impact: 'If unintended, the kitchen cooks 360 kg extra finished rice and needs about 108 kg more raw rice. If correct (an event, a training), the ingredients still have to be requested.',
    nextAction: 'Confirm the quantity before the kitchen updates production and ingredients at the 15:00 export.',
    owner: PEOPLE.priya, dueAt: '2026-10-13T14:30',
    detection: { provenance: 'proposed', text: 'Proposed demo check: the change exceeds the demo threshold. No universal tolerance has been agreed.' },
    beforeAfter: { label: 'Jeera Rice · 150 g · final order (MR)', before: '40 kg', after: '400 kg' },
    expectedAt: '2026-10-13T12:00', actualAt: '2026-10-13T11:52',
    relatedChangeIds: ['CHG-201'], relatedIssueIds: ['ISS-102'],
    evidence: [
      { label: 'MR edit history', availability: 'available', note: 'Cilantro shows the submitted value and time.' },
      { label: 'Reason for change', availability: 'unavailable', note: 'Reason not recorded.' },
      { label: 'Weekly projection (12–18 Oct)', availability: 'available', note: 'Projection for this day stays 40 kg — the MR does not overwrite it.' },
    ],
    timeline: [
      { at: '2026-10-13T11:52', by: 'Priya Nair', text: 'MR submitted: Jeera Rice 40 → 400 kg.' },
      { at: '2026-10-13T12:00', by: 'System (demo)', text: 'Production export v1 generated with 400 kg.' },
      { at: '2026-10-13T12:05', by: 'Demo check', text: 'Flagged as unusual against the demo threshold.' },
    ],
    notes: [], ingredientImpact: { dishId: 'jeera-rice', delta: { value: 360, unit: 'kg' } },
  },
  {
    id: 'ISS-102', title: 'Approved Dal Makhani EMR added after the 12:00 production export', short: 'Late order not included', severity: 'high', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f8', scope: svc(TOMORROW, 'Lunch'), stage: 'productionPlan',
    whatHappened: 'The CPU coordinator entered an EMR for 18 kg Dal Makhani (150 pax × 120 g) at 12:40 after a phone approval. Export v1 and the 12:30 ingredient request do not include it.',
    impact: 'Sections working from export v1 will not cook Dal Makhani. Urad, rajma, butter and cream for 18 kg were never requested.',
    nextAction: 'Chef: include the EMR in export v2 (15:00). Veg section and stores: acknowledge the extra ingredients.',
    owner: PEOPLE.arjun, dueAt: '2026-10-13T15:00',
    detection: { provenance: 'proposed', text: 'Proposed check: EMR timestamp later than the last production export. EMR entry itself is existing.' },
    beforeAfter: { label: 'Dal Makhani · 120 g · exceptional order (EMR)', before: '0 kg', after: '18 kg' },
    expectedAt: '2026-10-13T12:00', actualAt: '2026-10-13T12:40',
    relatedChangeIds: ['CHG-202'], relatedIssueIds: ['ISS-101'],
    evidence: [
      { label: 'EMR record', availability: 'available', note: 'Entered in Cilantro by the CPU coordinator.' },
      { label: 'Approval trail', availability: 'unavailable', note: 'Approved by phone; no native approval record.' },
      { label: 'Kitchen acknowledgment', availability: 'not_confirmed', note: 'Proposed acknowledgment — see below.' },
    ],
    timeline: [
      { at: '2026-10-13T12:00', by: 'System (demo)', text: 'Production export v1.' },
      { at: '2026-10-13T12:30', by: 'Arjun Rao', text: 'Ingredient request submitted.' },
      { at: '2026-10-13T12:40', by: 'Vikram Joshi', text: 'EMR entered: Dal Makhani 18 kg (client training).' },
    ],
    notes: [], ingredientImpact: { dishId: 'dal-makhani', delta: { value: 18, unit: 'kg' } },
  },
  {
    id: 'ISS-103', title: 'Atrium Cafe lunch order (MR) missing for tomorrow', short: 'Lunch order missing', severity: 'critical', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-atr', scope: svc(TOMORROW, 'Lunch'), stage: 'finalOrder',
    whatHappened: 'No final order was submitted for Atrium Cafe lunch before the 12:00 cutoff. The other two Lakeview cafes submitted.',
    impact: 'Export v1 has no Atrium lunch demand, so the kitchen cannot cook or pack for ~520 people. The weekly projection (62 kg Jeera Rice etc.) is a reference, not an order.',
    nextAction: 'Unit manager: submit the order now; or CPU coordinator: agree feasibility and enter an EMR before the 15:00 export.',
    owner: PEOPLE.rahul, dueAt: '2026-10-13T14:00',
    detection: { provenance: 'proposed', text: 'Pending cafe responses are visible in the existing Kitchen Dashboard; the owner alert and escalation are proposed.' },
    expectedAt: '2026-10-13T12:00',
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [
      { label: 'MR submission', availability: 'unavailable', note: 'No submission recorded.' },
      { label: 'Service calendar', availability: 'available', note: 'Atrium is open on 14 Oct (demo calendar).' },
    ],
    timeline: [{ at: '2026-10-13T12:00', by: 'Demo check', text: 'MR cutoff passed with no submission.' }],
    notes: [],
  },
  {
    id: 'ISS-104', title: 'Dal Makhani requested in remarks against Achari Dal', short: 'Substitution in remarks', severity: 'high', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f11', scope: svc(TOMORROW, 'Lunch'), stage: 'finalOrder',
    whatHappened: 'The MR line is Achari Dal (120 g, 21.5 kg) with the remark “Need Dal Makhani against Achari Dal”.',
    impact: 'Production and ingredients are calculated for Achari Dal (toor dal), while the site expects Dal Makhani (urad, cream). Recipe and packing traceability break.',
    nextAction: 'Agree the actual dish with the chef. If Dal Makhani is approved, order it as a structured line (EMR after cutoff) and remove Achari Dal.',
    owner: PEOPLE.sneha, dueAt: '2026-10-13T15:00',
    detection: { provenance: 'proposed', text: 'Proposed demo check: remark text names a different catalogue dish. Not an existing Cilantro check.' },
    beforeAfter: { label: 'Achari Dal · 120 g · remark', before: 'No remark', after: '“Need Dal Makhani against Achari Dal”' },
    relatedChangeIds: ['CHG-204'], relatedIssueIds: [],
    evidence: [{ label: 'MR remark', availability: 'available', note: 'Visible on the production plan as a site-entered remark.' }],
    timeline: [{ at: '2026-10-13T11:30', by: 'Sneha Kulkarni', text: 'MR submitted with substitution remark.' }],
    notes: [],
  },
  {
    id: 'ISS-105', title: 'Frozen grated coconut has no purchase article mapping', short: 'Article mapping missing', severity: 'medium', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f11', scope: svc(TOMORROW, 'Lunch'), stage: 'ingredientRequest',
    whatHappened: 'Coconut Chutney’s recipe uses the ingredient “Frozen grated coconut”, which has no SAP article mapping.',
    impact: 'The quantity is calculated, but cost shows as incomplete (not zero) and the store cannot identify the article to issue.',
    nextAction: 'Implementation team: map the ingredient to the correct article and confirm the recipe yield with the kitchen.',
    owner: PEOPLE.kiran, dueAt: '2026-10-13T17:00',
    detection: { provenance: 'existing', text: 'Missing article mappings are visible in the actual kitchen indent (existing).' },
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [
      { label: 'Recipe', availability: 'available', note: 'Coconut Chutney recipe exists.' },
      { label: 'Article mapping', availability: 'unavailable', note: 'Mapping missing in Cookbook / MDH.' },
    ],
    timeline: [{ at: '2026-10-13T12:30', by: 'Arjun Rao', text: 'Indent submitted with an unmapped ingredient.' }],
    notes: [], ingredientImpact: { dishId: 'coconut-chutney', delta: { value: 5.5, unit: 'kg' } },
  },
  {
    id: 'ISS-106', title: 'Floor 11 store handoff exported but receipt not confirmed', short: 'Store receipt not confirmed', severity: 'medium', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f11', scope: svc(TOMORROW), stage: 'storeHandoff',
    whatHappened: 'The article export for Floor 11 was sent to stores at 13:05. The store has not acknowledged it.',
    impact: 'An exported file does not prove SAP entry or physical issue. Ingredients may not be issued before cooking.',
    nextAction: 'Store lead: confirm receipt and SAP entry before 18:00.',
    owner: PEOPLE.manoj, dueAt: '2026-10-13T18:00',
    detection: { provenance: 'proposed', text: 'Proposed: track store acknowledgment of each export version.' },
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [
      { label: 'Article export', availability: 'available', note: 'Exported 13:05.' },
      { label: 'SAP entry / issuance', availability: 'unavailable', note: 'No SAP integration.' },
    ],
    timeline: [{ at: '2026-10-13T13:05', by: 'Arjun Rao', text: 'Article export sent to Hyderabad stores.' }],
    notes: [],
  },
  {
    id: 'ISS-107', title: 'Harbour snacks menu changed but not republished', short: 'Menu not republished', severity: 'high', status: 'open',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Snacks'), stage: 'menuPublication',
    whatHappened: 'The chef saved menu v2 at 10:15 (Samosa replaces Veg Puff) but did not publish it. The unit’s order was placed against v1 at 10:40.',
    impact: 'The kitchen may plan Samosa while the order is for Veg Puff. Saving does not make the menu visible to units.',
    nextAction: 'Chef: publish v2 or revert it. Unit manager: re-check the snacks order before the 14:00 cutoff.',
    owner: PEOPLE.farah, dueAt: '2026-10-13T14:00',
    detection: { provenance: 'existing', text: 'Saved vs Published state is shown in the existing Kitchen Dashboard.' },
    beforeAfter: { label: 'Snacks menu', before: 'v1 published: Veg Puff', after: 'v2 saved: Samosa (not published)' },
    relatedChangeIds: ['CHG-205'], relatedIssueIds: [],
    evidence: [{ label: 'Publication versions', availability: 'not_confirmed', note: 'Version history is a proposed evidence requirement.' }],
    timeline: [{ at: '2026-10-13T10:15', by: 'Farah Sheikh', text: 'Menu v2 saved.' }],
    notes: [],
  },
  {
    id: 'ISS-108', title: 'Paneer Butter Masala increased after ingredient request', short: 'Change after ingredient request', severity: 'high', status: 'open',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Lunch'), stage: 'ingredientRequest',
    whatHappened: 'Lunch Paneer Butter Masala (120 g) rose from 100 kg to 130 kg at 13:10. The ingredient request was submitted at 12:45.',
    impact: '+30 kg finished curry needs about 12 kg paneer, 7.5 kg tomato, 4.5 kg onion, 1.8 kg cream and 0.9 kg butter that were not requested.',
    nextAction: 'Chef: revise the ingredient request (partial). Store: confirm extra paneer can be issued.',
    owner: PEOPLE.farah, dueAt: '2026-10-13T15:00',
    detection: { provenance: 'proposed', text: 'Proposed check: order change after a successful submitted indent. Partial/delta behaviour still needs verification.' },
    beforeAfter: { label: 'Paneer Butter Masala · 120 g · final order (MR)', before: '100 kg', after: '130 kg' },
    expectedAt: '2026-10-13T12:45', actualAt: '2026-10-13T13:10',
    relatedChangeIds: ['CHG-206'], relatedIssueIds: [],
    evidence: [
      { label: 'Submitted indent baseline', availability: 'available', note: 'Submitted 12:45.' },
      { label: 'Reason', availability: 'available', note: 'Town hall — extra attendees (recorded).' },
    ],
    timeline: [
      { at: '2026-10-13T12:45', by: 'Farah Sheikh', text: 'Ingredient request submitted.' },
      { at: '2026-10-13T13:10', by: 'Deepa Iyer', text: 'MR changed 100 → 130 kg.' },
      { at: '2026-10-13T13:18', by: 'Farah Sheikh', text: 'Kitchen acknowledged the change (ingredient review still pending).' },
    ],
    notes: [], ingredientImpact: { dishId: 'paneer-butter-masala', delta: { value: 30, unit: 'kg' } },
  },
  {
    id: 'ISS-109', title: 'Custom “Other” chutney has no ingredient plan', short: 'Custom dish not planned', severity: 'medium', status: 'open',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Breakfast'), stage: 'ingredientRequest',
    whatHappened: 'An EMR added “Other: Coconut chutney (Kerala style)”, 6 kg, which is not in the catalogue.',
    impact: 'No recipe means no reliable ingredient, cost, nutrition or allergen calculation for this dish.',
    nextAction: 'Chef: record an explicit ingredient plan for this one-off. If it recurs, request Cookbook onboarding.',
    owner: PEOPLE.vikram, dueAt: '2026-10-13T16:30',
    detection: { provenance: 'existing', text: '“Other” entries are visible in EMR (existing); the follow-up is proposed.' },
    relatedChangeIds: ['CHG-207'], relatedIssueIds: [],
    evidence: [
      { label: 'Recipe', availability: 'unavailable', note: 'Custom dish — no recipe.' },
      { label: 'Approval trail', availability: 'unavailable', note: 'Client request via email (not linked).' },
    ],
    timeline: [{ at: '2026-10-13T09:40', by: 'Vikram Joshi', text: 'EMR Other entry created.' }],
    notes: [],
  },
  {
    id: 'ISS-110', title: 'Executive Dining production export v1 is outdated', short: 'Export outdated', severity: 'high', status: 'open',
    siteId: 'harbour', cafeId: 'hp-exec', scope: svc(TOMORROW, 'Lunch'), stage: 'productionPlan',
    whatHappened: 'An approved headcount change (60 → 90 pax) raised Veg Pulao from 9 kg to 13.5 kg at 12:20, after export v1 (11:00).',
    impact: 'Sections prepping from v1 will under-produce by 4.5 kg Veg Pulao. Stale sheets keep circulating unless withdrawn.',
    nextAction: 'Chef: withdraw v1 from section boards; issue v2 at 16:00 and get the Rice section to acknowledge.',
    owner: PEOPLE.farah, dueAt: '2026-10-13T16:00',
    detection: { provenance: 'proposed', text: 'Proposed: version production exports and compare with later approved changes.' },
    beforeAfter: { label: 'Veg Pulao · 150 g · final order (MR)', before: '9 kg (60 pax)', after: '13.5 kg (90 pax)' },
    relatedChangeIds: ['CHG-208'], relatedIssueIds: [],
    evidence: [{ label: 'Export versions', availability: 'not_confirmed', note: 'Export versioning is proposed.' }],
    timeline: [
      { at: '2026-10-13T11:00', by: 'System (demo)', text: 'Production export v1.' },
      { at: '2026-10-13T12:20', by: 'Deepa Iyer', text: 'Approved change 60 → 90 pax.' },
    ],
    notes: [],
  },
  {
    id: 'ISS-111', title: 'Millet Upma has no recipe', short: 'Recipe missing', severity: 'high', status: 'open',
    siteId: 'riverside', cafeId: 'rv-a', scope: svc(TOMORROW, 'Breakfast'), stage: 'ingredientRequest',
    whatHappened: 'Tower A ordered 45 kg Millet Upma (150 g). The dish has no recipe in Cookbook.',
    impact: 'The ingredient request will be incomplete for this dish; quantities cannot be invented.',
    nextAction: 'Implementation team: add and validate the recipe, or the chef records a manual ingredient plan before 16:30.',
    owner: PEOPLE.kiran, dueAt: '2026-10-13T16:30',
    detection: { provenance: 'existing', text: 'Missing recipes are listed in the actual kitchen indent (existing).' },
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [{ label: 'Recipe', availability: 'unavailable', note: 'Not in Cookbook / MDH.' }],
    timeline: [{ at: '2026-10-13T10:20', by: 'Aman Gupta', text: 'MR submitted including Millet Upma.' }],
    notes: [], ingredientImpact: { dishId: 'millet-upma', delta: { value: 45, unit: 'kg' } },
  },
  {
    id: 'ISS-112', title: 'Paratha may be ordered twice (CPU and stock transfer)', short: 'Possible duplicate order', severity: 'medium', status: 'open',
    siteId: 'riverside', cafeId: 'rv-a', scope: svc(TOMORROW, 'Dinner'), stage: 'finalOrder',
    whatHappened: 'Dinner has 200 parathas through the CPU order and another 200 through an SAP stock transfer (STO) added at 13:05.',
    impact: 'If both stay, 400 parathas arrive for 200 needed.',
    nextAction: 'Unit manager: confirm the supply route and remove the other order.',
    owner: PEOPLE.aman, dueAt: '2026-10-13T15:00',
    detection: { provenance: 'proposed', text: 'Proposed demo check. Requires sourcing data the playbook does not establish in Cilantro.' },
    beforeAfter: { label: 'Paratha · dinner', before: '200 pcs (CPU)', after: '200 pcs (CPU) + 200 pcs (STO)' },
    relatedChangeIds: ['CHG-209'], relatedIssueIds: [],
    evidence: [{ label: 'STO record', availability: 'not_confirmed', note: 'Entered in the demo; no SAP feed.' }],
    timeline: [{ at: '2026-10-13T13:05', by: 'Aman Gupta', text: 'STO for 200 parathas noted.' }],
    notes: [],
  },
  {
    id: 'ISS-113', title: 'Floor 11 Cafe has no menu selection for 19–25 Oct', short: 'Menu selection missing', severity: 'high', status: 'open',
    siteId: 'lakeview', cafeId: 'lv-f11', scope: wk('2026-W43'), stage: 'menuSelection',
    whatHappened: 'Floor 8 and Atrium selected dishes for next week. Floor 11 has none, so its projection shows “No Data Found”.',
    impact: 'Floor 11 cannot project, and its demand will be missing from projected ingredients and vendor planning.',
    nextAction: 'Unit manager: submit Floor 11’s selection, then the projection, before Wed 18:00.',
    owner: PEOPLE.sneha, dueAt: '2026-10-14T18:00',
    detection: { provenance: 'proposed', text: 'Proposed: show expected cafe coverage so an untouched cafe is not hidden by a site summary.' },
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [{ label: 'Selection record', availability: 'unavailable', note: 'No selection submitted.' }],
    timeline: [{ at: '2026-10-13T09:40', by: 'Priya Nair', text: 'Floor 8 selection submitted (for comparison).' }],
    notes: [],
  },
  {
    id: 'ISS-114', title: 'Tower A weekly projection missed the 12:00 cutoff', short: 'Projection missed cutoff', severity: 'high', status: 'open',
    siteId: 'riverside', cafeId: 'rv-a', scope: wk('2026-W43'), stage: 'weeklyProjection',
    whatHappened: 'Riverside’s local cutoff for the 19–25 Oct projection was today 12:00. Tower A has only a draft. Entry is now locked.',
    impact: 'Advance purchasing for next week lacks Tower A’s estimate (~300 people/day).',
    nextAction: 'CPU coordinator: decide on a one-day extension (revert afterwards) or plan from history; unit manager submits if extended.',
    owner: PEOPLE.aman, dueAt: '2026-10-13T17:00',
    detection: { provenance: 'existing', text: 'Projection locks after the site cutoff (existing). The reminder/escalation is proposed.' },
    expectedAt: '2026-10-13T12:00',
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [{ label: 'Projection draft', availability: 'available', note: 'Draft saved, not submitted.' }],
    timeline: [{ at: '2026-10-13T12:00', by: 'Demo check', text: 'Cutoff passed without submission.' }],
    notes: [],
  },
  {
    id: 'ISS-115', title: 'Tower A lunch dispatch not confirmed', short: 'Dispatch not confirmed', severity: 'high', status: 'open',
    siteId: 'riverside', cafeId: 'rv-a', scope: svc(TODAY, 'Lunch'), stage: 'cookingDispatch',
    whatHappened: 'The dispatch export (10:30) exists, but Produced and Dispatched are blank. There is no delivery confirmation.',
    impact: 'We cannot tell whether lunch left the kitchen or reached the cafe. Status stays “Data unavailable” — never “Delivered”.',
    nextAction: 'Dispatch lead: confirm what was dispatched and when.',
    owner: PEOPLE.ravi, dueAt: '2026-10-13T14:00',
    detection: { provenance: 'proposed', text: 'Proposed: manual dispatch confirmation. Automatic actual capture is unproven.' },
    expectedAt: '2026-10-13T11:30',
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [
      { label: 'Dispatch export', availability: 'available', note: 'Exported 10:30.' },
      { label: 'Dispatch / delivery actuals', availability: 'unavailable', note: 'Not captured.' },
    ],
    timeline: [{ at: '2026-10-13T10:30', by: 'System (demo)', text: 'Dispatch export generated.' }],
    notes: [],
  },
  {
    id: 'ISS-116', title: 'Tower B breakfast order submitted 25 min late', short: 'Breakfast order late', severity: 'low', status: 'resolved',
    siteId: 'riverside', cafeId: 'rv-b', scope: svc(TODAY, 'Breakfast'), stage: 'finalOrder',
    whatHappened: 'Yesterday’s MR for today’s breakfast arrived at 13:25, after the 13:00 cutoff.',
    impact: 'None — the CPU included it in the 15:00 export.',
    nextAction: 'No further action.',
    owner: PEOPLE.vikram, dueAt: '2026-10-12T15:00',
    detection: { provenance: 'proposed', text: 'Proposed MR timeliness check.' },
    relatedChangeIds: [], relatedIssueIds: [],
    evidence: [{ label: 'MR submission', availability: 'available', note: 'Submitted 12 Oct 13:25.' }],
    timeline: [
      { at: '2026-10-12T13:25', by: 'Aman Gupta', text: 'MR submitted late.' },
      { at: '2026-10-12T14:10', by: 'Vikram Joshi', text: 'Resolved: included in 15:00 export.' },
    ],
    notes: [], closureNote: 'Included in the 15:00 export; no production impact.',
  },
];

// ---------------------------------------------------------------- changes

export const SEED_CHANGES: Change[] = [
  {
    id: 'CHG-201', kind: 'Final order (MR) quantity change', record: 'Final daily order (MR)',
    siteId: 'lakeview', cafeId: 'lv-f8', scope: svc(TOMORROW, 'Lunch'), dishId: 'jeera-rice', portion: '150 g',
    previous: { value: 40, unit: 'kg' }, next: { value: 400, unit: 'kg' }, by: PEOPLE.priya, at: '2026-10-13T11:52', reason: null,
    late: false, affectedSteps: ['Production export v1 (12:00)', 'Rice section ingredients (raw rice)', 'Floor 8 lunch packing'],
    acknowledgments: [{ team: 'Kitchen (production)', detail: 'Rice section', state: 'pending' }], relatedIssueId: 'ISS-101',
  },
  {
    id: 'CHG-202', kind: 'Exceptional order (EMR) added', record: 'Exceptional order (EMR)',
    siteId: 'lakeview', cafeId: 'lv-f8', scope: svc(TOMORROW, 'Lunch'), dishId: 'dal-makhani', portion: '120 g',
    previous: { value: 0, unit: 'kg' }, next: { value: 18, unit: 'kg' }, by: PEOPLE.vikram, at: '2026-10-13T12:40',
    reason: 'Client training moved into the cafe — approved by phone with the CPU chef',
    late: true, lateAfter: 'Production export v1 (12:00) and ingredient request (12:30)',
    affectedSteps: ['Production export v2 (15:00)', 'Veg section ingredients', 'Floor 8 lunch packing'],
    acknowledgments: [
      { team: 'Kitchen section', detail: 'Veg section', state: 'pending' },
      { team: 'Store team', detail: 'Hyderabad stores', state: 'pending' },
    ], relatedIssueId: 'ISS-102',
  },
  {
    id: 'CHG-203', kind: 'Final order (MR) cancellation', record: 'Final daily order (MR)',
    siteId: 'riverside', cafeId: 'rv-a', scope: svc(TOMORROW, 'Lunch'), dishId: 'paneer-butter-masala', portion: '120 g',
    previous: { value: 45, unit: 'kg' }, next: { value: 0, unit: 'kg' }, by: PEOPLE.aman, at: '2026-10-13T10:05',
    reason: 'Visiting delegation cancelled', late: false,
    affectedSteps: ['Production export (15:00)', 'Veg section ingredients'],
    acknowledgments: [{ team: 'Kitchen (production)', detail: 'Gurgaon CPU', state: 'acknowledged', at: '2026-10-13T10:30', by: 'Meera Bhatt' }],
  },
  {
    id: 'CHG-204', kind: 'Remark used as dish substitution', record: 'Final daily order (MR)',
    siteId: 'lakeview', cafeId: 'lv-f11', scope: svc(TOMORROW, 'Lunch'), dishId: 'achari-dal', portion: '120 g',
    textChange: { previous: 'No remark', next: '“Need Dal Makhani against Achari Dal”' }, by: PEOPLE.sneha, at: '2026-10-13T11:30', reason: null,
    late: false, affectedSteps: ['Production export v1 (12:00)', 'Veg section ingredients', 'Floor 11 packing'],
    acknowledgments: [{ team: 'Kitchen (production)', detail: 'Veg section', state: 'pending' }], relatedIssueId: 'ISS-104',
  },
  {
    id: 'CHG-205', kind: 'Menu edited after publication', record: 'Menu plan',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Snacks'), dishId: 'veg-puff',
    textChange: { previous: 'v1 published — Veg Puff', next: 'v2 saved — Samosa (not published)' }, by: PEOPLE.farah, at: '2026-10-13T10:15',
    reason: 'Veg Puff supplier delay', late: false, affectedSteps: ['Unit menu visibility', 'Snacks order (MR)', 'Bakery / Halwai sections'],
    acknowledgments: [{ team: 'Unit manager', detail: 'Harbour Point', state: 'pending' }], relatedIssueId: 'ISS-107',
  },
  {
    id: 'CHG-206', kind: 'Final order (MR) quantity change', record: 'Final daily order (MR)',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Lunch'), dishId: 'paneer-butter-masala', portion: '120 g',
    previous: { value: 100, unit: 'kg' }, next: { value: 130, unit: 'kg' }, by: PEOPLE.deepa, at: '2026-10-13T13:10',
    reason: 'Town hall — about 250 extra attendees', late: true, lateAfter: 'Ingredient request submitted 12:45',
    affectedSteps: ['Final production export (16:00)', 'Veg section ingredients (paneer, cream)', 'Store issue'],
    acknowledgments: [
      { team: 'Kitchen (production)', detail: 'Harbour kitchen', state: 'acknowledged', at: '2026-10-13T13:18', by: 'Farah Sheikh' },
      { team: 'Store team', detail: 'Harbour stores', state: 'pending' },
    ], relatedIssueId: 'ISS-108',
  },
  {
    id: 'CHG-207', kind: 'Exceptional order (EMR) added', record: 'Exceptional order (EMR)',
    siteId: 'harbour', cafeId: 'hp-main', scope: svc(TOMORROW, 'Breakfast'), dishId: 'other-kerala-chutney', portion: '40 g',
    previous: { value: 0, unit: 'kg' }, next: { value: 6, unit: 'kg' }, by: PEOPLE.vikram, at: '2026-10-13T09:40',
    reason: 'Client requested a Kerala breakfast day', late: false, affectedSteps: ['Production export v1 (11:00)', 'Ingredient request'],
    acknowledgments: [{ team: 'Kitchen (production)', detail: 'Harbour kitchen', state: 'acknowledged', at: '2026-10-13T10:02', by: 'Farah Sheikh' }], relatedIssueId: 'ISS-109',
  },
  {
    id: 'CHG-208', kind: 'Final order (MR) quantity change', record: 'Final daily order (MR)',
    siteId: 'harbour', cafeId: 'hp-exec', scope: svc(TOMORROW, 'Lunch'), dishId: 'veg-pulao', portion: '150 g',
    previous: { value: 9, unit: 'kg' }, next: { value: 13.5, unit: 'kg' }, by: PEOPLE.deepa, at: '2026-10-13T12:20',
    reason: 'Board meeting headcount confirmed (60 → 90)', late: true, lateAfter: 'Production export v1 (11:00)',
    affectedSteps: ['Final production export (16:00)', 'Rice section', 'Executive Dining packing'],
    acknowledgments: [{ team: 'Kitchen section', detail: 'Rice section', state: 'pending' }], relatedIssueId: 'ISS-110',
  },
  {
    id: 'CHG-209', kind: 'Sourcing added via stock transfer', record: 'Sourcing',
    siteId: 'riverside', cafeId: 'rv-a', scope: svc(TOMORROW, 'Dinner'), dishId: 'paratha', portion: '1 piece',
    previous: { value: 0, unit: 'pcs' }, next: { value: 200, unit: 'pcs' }, by: PEOPLE.aman, at: '2026-10-13T13:05', reason: null,
    late: false, affectedSteps: ['CPU paratha order (200 pcs)', 'Store STO'],
    acknowledgments: [], relatedIssueId: 'ISS-112',
  },
  {
    id: 'CHG-210', kind: 'Weekly projection submitted', record: 'Weekly projection',
    siteId: 'lakeview', cafeId: 'lv-atr', scope: wk('2026-W43'),
    previous: undefined, next: { value: 410, unit: 'kg' }, by: PEOPLE.rahul, at: '2026-10-13T09:15', reason: 'Routine weekly submission',
    late: false, affectedSteps: ['Projected indent', 'Vendor planning'], acknowledgments: [],
  },
  {
    id: 'CHG-211', kind: 'Weekly projection submitted', record: 'Weekly projection',
    siteId: 'harbour', cafeId: 'hp-main', scope: wk('2026-W43'),
    previous: undefined, next: { value: 1120, unit: 'kg' }, by: PEOPLE.deepa, at: '2026-10-13T12:05', reason: 'Routine weekly submission',
    late: false, affectedSteps: ['Projected indent', 'Vendor planning'], acknowledgments: [],
  },
];

export { SITES };
