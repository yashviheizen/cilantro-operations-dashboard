// Pure derivations. Cards, tracker, table, planning panel and issue lists all
// read from the same records through these functions, so their numbers agree.

import { CAFES, SITES } from '../data/masters';
import { SERVICE_LINES, WEEKLY_PLANNING } from '../data/operations';
import { DEMO_DATES, isPast } from '../data/clock';
import type {
  Cafe, Change, DemoSettings, DisplayStatus, Issue, Meal, ServiceLine, Site, StageKey, StageRecord, WeeklyPlanning,
} from '../data/types';

export type DailyStage = Exclude<StageKey, 'weeklyProjection'>;
export type PlanningStage = 'menuPublication' | 'menuSelection' | 'weeklyProjection';

export const DAILY_STAGES: DailyStage[] = [
  'menuPublication', 'menuSelection', 'finalOrder', 'productionPlan', 'ingredientRequest', 'storeHandoff', 'cookingDispatch',
];
export const PLANNING_STAGES: PlanningStage[] = ['menuPublication', 'menuSelection', 'weeklyProjection'];
export const WORKFLOW: StageKey[] = [
  'menuPublication', 'menuSelection', 'weeklyProjection', 'finalOrder', 'productionPlan', 'ingredientRequest', 'storeHandoff', 'cookingDispatch',
];

/** Demo definition of "ready" — shown in the UI. Store handoff and dispatch are tracked, not required. */
export const REQUIRED_STAGES: DailyStage[] = ['menuPublication', 'menuSelection', 'finalOrder', 'productionPlan', 'ingredientRequest'];

export const STAGE_LABEL: Record<StageKey, string> = {
  menuPublication: 'Menu publication',
  menuSelection: 'Cafe menu selection',
  weeklyProjection: 'Weekly projection',
  finalOrder: 'Final order (MR)',
  productionPlan: 'Production plan',
  ingredientRequest: 'Ingredient request',
  storeHandoff: 'Store handoff',
  cookingDispatch: 'Cooking & dispatch',
};

export const STAGE_SHORT: Record<StageKey, string> = {
  menuPublication: 'Publication',
  menuSelection: 'Selection',
  weeklyProjection: 'Projection',
  finalOrder: 'Final order',
  productionPlan: 'Production',
  ingredientRequest: 'Ingredients',
  storeHandoff: 'Store handoff',
  cookingDispatch: 'Dispatch',
};

export const STAGE_EXPLAIN: Record<StageKey, string> = {
  menuPublication: 'Chef publishes the menu. A saved menu is not visible to units until it is published.',
  menuSelection: 'Each cafe picks dishes from the published menu. A cafe with no selection cannot project.',
  weeklyProjection: 'Advance weekly estimate used for purchasing. Locks at the site cutoff. Daily orders never overwrite it.',
  finalOrder: 'Unit manager’s final daily order (MR), due the day before service. Late demand comes in as EMR.',
  productionPlan: 'Kitchen exports production per section. An export is a snapshot — later changes make it outdated.',
  ingredientRequest: 'Actual kitchen indent calculated from recipes. Missing recipe or article mapping makes it incomplete.',
  storeHandoff: 'Article export handed to stores for manual SAP entry. Export ≠ issued; receipt needs confirming.',
  cookingDispatch: 'Cooking and dispatch. Actual dispatch is only shown when confirmed; delivery is not tracked.',
};

/** Who normally acts on a stage (role, not a named person). */
export const STAGE_OWNER_ROLE: Record<StageKey, string> = {
  menuPublication: 'Chef',
  menuSelection: 'Unit manager',
  weeklyProjection: 'Unit manager',
  finalOrder: 'Unit manager',
  productionPlan: 'Kitchen chef',
  ingredientRequest: 'Kitchen chef',
  storeHandoff: 'Store team',
  cookingDispatch: 'Dispatch team',
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  complete: 'Complete',
  pending: 'Pending',
  review: 'Needs review',
  overdue: 'Overdue',
  blocked: 'Blocked',
  unconfirmed: 'Not confirmed',
  not_applicable: 'Not applicable',
};

const PRECEDENCE: DisplayStatus[] = ['overdue', 'blocked', 'review', 'unconfirmed', 'pending', 'complete', 'not_applicable'];

export function worst(statuses: DisplayStatus[]): DisplayStatus {
  if (!statuses.length) return 'not_applicable';
  return statuses.reduce((a, b) => (PRECEDENCE.indexOf(b) < PRECEDENCE.indexOf(a) ? b : a));
}

export function isAttention(s: DisplayStatus): boolean {
  return s === 'overdue' || s === 'blocked' || s === 'review';
}

/** Raw fact + demo clock + resolved issues → what the UI shows. */
export function stageStatus(rec: StageRecord, resolved: Set<string>): DisplayStatus {
  switch (rec.fact) {
    case 'done':
      return 'complete';
    case 'not_done':
      return isPast(rec.dueAt) ? 'overdue' : 'pending';
    case 'needs_review':
    case 'blocked':
      if (rec.clearedByIssueId && resolved.has(rec.clearedByIssueId)) return 'complete';
      return rec.fact === 'blocked' ? 'blocked' : 'review';
    case 'unknown':
      if (rec.clearedByIssueId && resolved.has(rec.clearedByIssueId)) return 'complete';
      return 'unconfirmed';
    case 'not_applicable':
      return 'not_applicable';
  }
}

export function stageText(rec: StageRecord, status: DisplayStatus): string {
  if (status === 'complete' && rec.fact !== 'done') return 'Resolved';
  if (status === 'overdue') return rec.fact === 'not_done' ? `Overdue · ${rec.label ?? 'not done'}` : rec.label ?? 'Overdue';
  return rec.label ?? STATUS_LABEL[status];
}

// ---------------------------------------------------------------- filters & scope

export interface Filters {
  siteId: string; // 'all' or a site id
  cafeId: string; // 'all' or a cafe id
  date: string;
  meal: Meal | 'All';
  weekId: string;
}

export const siteById = (id: string): Site => SITES.find((s) => s.id === id)!;
export const cafeById = (id: string): Cafe => CAFES.find((c) => c.id === id)!;

export function cafesInScope(f: Pick<Filters, 'siteId' | 'cafeId'>): Cafe[] {
  return CAFES.filter((c) => (f.siteId === 'all' || c.siteId === f.siteId) && (f.cafeId === 'all' || c.id === f.cafeId));
}

export function hasDataFor(date: string): boolean {
  return DEMO_DATES.includes(date);
}

export function resolvedSet(issues: Issue[]): Set<string> {
  return new Set(issues.filter((i) => i.status === 'resolved').map((i) => i.id));
}

function inPlaceScope(x: { siteId: string; cafeId?: string }, f: Filters) {
  return (f.siteId === 'all' || x.siteId === f.siteId) && (f.cafeId === 'all' || x.cafeId === f.cafeId);
}

/** Service-scoped records match the service date + meal; week-scoped ones match the projection week. */
export function inTimeScope(scope: Issue['scope'], f: Filters): boolean {
  if (scope.kind === 'week') return scope.weekId === f.weekId;
  if (scope.date !== f.date) return false;
  return f.meal === 'All' || !scope.meal || scope.meal === f.meal;
}

export function issuesInScope(issues: Issue[], f: Filters): Issue[] {
  return issues.filter((i) => inPlaceScope(i, f) && inTimeScope(i.scope, f));
}

export function changesInScope(changes: Change[], f: Filters): Change[] {
  return changes.filter((c) => inPlaceScope(c, f) && inTimeScope(c.scope, f)).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const isOpen = (i: Issue) => i.status !== 'resolved';
export const awaitingAck = (c: Change) => c.late && c.acknowledgments.some((a) => a.state === 'pending');

// ---------------------------------------------------------------- cafe rows

export interface StageCell {
  status: DisplayStatus;
  text: string;
  note?: string;
  dueAt?: string;
  doneAt?: string;
  perMeal: { meal: Meal; status: DisplayStatus; text: string; rec: StageRecord }[];
}

export interface CafeRow {
  cafe: Cafe;
  site: Site;
  /** False when the cafe is closed or does not serve the selected meal. */
  applicable: boolean;
  naReason?: string;
  meals: Meal[];
  lines: ServiceLine[];
  stages: Record<DailyStage, StageCell>;
  openIssues: Issue[];
  ready: boolean;
  next: { text: string; owner: string; dueAt?: string };
  attention: boolean;
  overdue: boolean;
  unconfirmed: boolean;
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;
export const bySeverity = (a: Issue, b: Issue) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.dueAt.localeCompare(b.dueAt);

function naCell(text: string): StageCell {
  return { status: 'not_applicable', text, perMeal: [] };
}

export function buildCafeRow(cafe: Cafe, f: Filters, issues: Issue[], lines = SERVICE_LINES): CafeRow {
  const site = siteById(cafe.siteId);
  const resolved = resolvedSet(issues);
  const allLines = lines.filter((l) => l.cafeId === cafe.id && l.date === f.date);
  const scoped = allLines.filter((l) => f.meal === 'All' || l.meal === f.meal);
  const servedLines = scoped.filter((l) => l.stages.finalOrder.fact !== 'not_applicable');
  const openIssues = issues
    .filter((i) => isOpen(i) && i.cafeId === cafe.id && i.scope.kind === 'service' && inTimeScope(i.scope, f))
    .sort(bySeverity);

  let naReason: string | undefined;
  if (!servedLines.length) {
    const closed = scoped.find((l) => l.stages.finalOrder.fact === 'not_applicable');
    naReason = closed?.stages.finalOrder.note ?? (f.meal !== 'All' ? `Does not serve ${f.meal.toLowerCase()}` : 'No service');
  }

  const stages = {} as Record<DailyStage, StageCell>;
  for (const key of DAILY_STAGES) {
    if (naReason) {
      stages[key] = naCell('Not applicable');
      continue;
    }
    const perMeal = servedLines.map((l) => {
      const status = stageStatus(l.stages[key], resolved);
      return { meal: l.meal, status, text: stageText(l.stages[key], status), rec: l.stages[key] };
    });
    const status = worst(perMeal.map((p) => p.status));
    const lead = perMeal.find((p) => p.status === status)!;
    const mixed = perMeal.length > 1 && perMeal.some((p) => p.status !== status);
    stages[key] = {
      status,
      text: mixed ? `${lead.meal} · ${lead.text}` : lead.text,
      note: lead.rec.note,
      dueAt: lead.rec.dueAt,
      doneAt: lead.rec.doneAt,
      perMeal,
    };
  }

  const ready = !naReason && REQUIRED_STAGES.every((k) => stages[k].status === 'complete');
  const statuses = DAILY_STAGES.map((k) => stages[k].status);

  let next: CafeRow['next'];
  if (naReason) next = { text: 'No action — not in service', owner: '—' };
  else if (openIssues.length) {
    const top = openIssues[0];
    next = { text: top.nextAction, owner: top.owner.name, dueAt: top.dueAt };
  } else {
    const k = DAILY_STAGES.find((s) => stages[s].status !== 'complete' && stages[s].status !== 'not_applicable');
    next = k
      ? { text: nextStepText(k, stages[k]), owner: STAGE_OWNER_ROLE[k], dueAt: stages[k].dueAt }
      : { text: 'No action needed', owner: '—' };
  }

  return {
    cafe, site, applicable: !naReason, naReason, meals: servedLines.map((l) => l.meal), lines: servedLines, stages, openIssues, ready, next,
    attention: !naReason && (openIssues.length > 0 || statuses.some(isAttention)),
    overdue: statuses.includes('overdue'),
    unconfirmed: statuses.includes('unconfirmed'),
  };
}

function nextStepText(k: DailyStage, cell: StageCell): string {
  const verb: Record<DailyStage, string> = {
    menuPublication: 'Publish the menu',
    menuSelection: 'Complete menu selection',
    finalOrder: 'Submit the final order (MR)',
    productionPlan: 'Export the production plan',
    ingredientRequest: 'Submit the ingredient request',
    storeHandoff: 'Hand off articles to stores and confirm receipt',
    cookingDispatch: cell.status === 'unconfirmed' ? 'Confirm dispatch' : 'Cook and dispatch',
  };
  return verb[k];
}

export function cafeRows(f: Filters, issues: Issue[]): CafeRow[] {
  return cafesInScope(f).map((c) => buildCafeRow(c, f, issues));
}

// ---------------------------------------------------------------- summary cards

export interface Summary {
  ready: number;
  applicableCafes: number;
  orderLines: number;
  ordersPending: number;
  ordersOverdue: number;
  openIssues: number;
  criticalOpen: number;
  lateChanges: number;
  lateAwaitingAck: number;
  ingredientLines: number;
  ingredientReview: number;
}

export function summarize(rows: CafeRow[], issues: Issue[], changes: Change[], f: Filters): Summary {
  const live = rows.filter((r) => r.applicable);
  const order = live.flatMap((r) => r.stages.finalOrder.perMeal);
  const ingredients = live.flatMap((r) => r.stages.ingredientRequest.perMeal);
  const open = issuesInScope(issues, f).filter(isOpen);
  const late = changesInScope(changes, f).filter((c) => c.late);
  return {
    ready: live.filter((r) => r.ready).length,
    applicableCafes: live.length,
    orderLines: order.length,
    ordersPending: order.filter((p) => p.status === 'pending').length,
    ordersOverdue: order.filter((p) => p.status === 'overdue').length,
    openIssues: open.length,
    criticalOpen: open.filter((i) => i.severity === 'critical').length,
    lateChanges: late.length,
    lateAwaitingAck: late.filter(awaitingAck).length,
    ingredientLines: ingredients.length,
    ingredientReview: ingredients.filter((p) => isAttention(p.status)).length,
  };
}

// ---------------------------------------------------------------- weekly planning

export interface PlanningRow {
  cafe: Cafe;
  site: Site;
  record?: WeeklyPlanning;
  stages: Record<PlanningStage, { status: DisplayStatus; text: string; rec?: StageRecord }>;
}

export function planningRows(f: Filters, issues: Issue[], data = WEEKLY_PLANNING): PlanningRow[] {
  const resolved = resolvedSet(issues);
  return cafesInScope(f).map((cafe) => {
    const record = data.find((w) => w.cafeId === cafe.id && w.weekId === f.weekId);
    const stages = {} as PlanningRow['stages'];
    for (const k of PLANNING_STAGES) {
      if (!record) stages[k] = { status: 'unconfirmed', text: 'Data unavailable' };
      else {
        const status = stageStatus(record[k], resolved);
        stages[k] = { status, text: stageText(record[k], status), rec: record[k] };
      }
    }
    return { cafe, site: siteById(cafe.siteId), record, stages };
  });
}

// ---------------------------------------------------------------- workflow tracker

export interface StageCoverage {
  key: StageKey;
  period: 'week' | 'day';
  complete: number;
  total: number;
  status: DisplayStatus;
  counts: Partial<Record<DisplayStatus, number>>;
  deadline: string;
}

const CUTOFF_KEY: Record<StageKey, keyof Site['cutoffs'] | null> = {
  menuPublication: 'menuPublication',
  menuSelection: 'projection',
  weeklyProjection: 'projection',
  finalOrder: 'finalOrder',
  productionPlan: 'productionExport',
  ingredientRequest: 'ingredientRequest',
  storeHandoff: 'storeHandoff',
  cookingDispatch: null,
};

export function deadlineFor(key: StageKey, siteId: string): string {
  const ck = CUTOFF_KEY[key];
  if (!ck) return 'Per meal service time';
  if (siteId !== 'all') {
    const prefix = key === 'menuSelection' ? 'Before projection: ' : '';
    return prefix + siteById(siteId).cutoffs[ck].rule;
  }
  const rules = new Set(SITES.map((s) => s.cutoffs[ck].rule));
  return rules.size === 1 ? [...rules][0] : `Site-specific (${rules.size} rules)`;
}

function cover(key: StageKey, period: 'week' | 'day', statuses: DisplayStatus[], siteId: string): StageCoverage {
  const counted = statuses.filter((s) => s !== 'not_applicable');
  const counts: StageCoverage['counts'] = {};
  counted.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1));
  return {
    key, period, complete: counts.complete ?? 0, total: counted.length, status: worst(counted), counts, deadline: deadlineFor(key, siteId),
  };
}

export function workflowCoverage(rows: CafeRow[], planning: PlanningRow[], f: Filters): StageCoverage[] {
  return WORKFLOW.map((key) =>
    key === 'menuPublication' || key === 'menuSelection' || key === 'weeklyProjection'
      ? cover(key, 'week', planning.map((p) => p.stages[key].status), f.siteId)
      : cover(key, 'day', rows.filter((r) => r.applicable).map((r) => r.stages[key].status), f.siteId),
  );
}

// ---------------------------------------------------------------- change checks

/** Proposed demo check — thresholds come from Demo settings, not an agreed tolerance. */
export function isUnusualChange(c: Change, s: DemoSettings): boolean {
  if (!c.previous || !c.next || c.previous.unit !== c.next.unit || c.next.unit !== 'kg') return false;
  const diff = Math.abs(c.next.value - c.previous.value);
  if (diff < s.unusualChangeMinKg) return false;
  if (c.previous.value === 0) return true;
  return (diff / c.previous.value) * 100 >= s.unusualChangePercent;
}

export function fmtQty(q?: { value: number; unit: string }): string {
  if (!q) return '—';
  const v = Number.isInteger(q.value) ? q.value.toString() : q.value.toFixed(q.value < 1 ? 2 : 1).replace(/\.0+$/, '');
  return `${v} ${q.unit}`;
}

// ---------------------------------------------------------------- compact row status

export type RowStatus = 'ready' | 'pending' | 'overdue' | 'review' | 'unconfirmed' | 'not_applicable';

export const ROW_STATUS: Record<RowStatus, { label: string; display: DisplayStatus }> = {
  ready: { label: 'Ready', display: 'complete' },
  pending: { label: 'Pending', display: 'pending' },
  overdue: { label: 'Overdue', display: 'overdue' },
  review: { label: 'Needs review', display: 'review' },
  unconfirmed: { label: 'Not confirmed', display: 'unconfirmed' },
  not_applicable: { label: 'Not applicable', display: 'not_applicable' },
};

const ROW_RANK: RowStatus[] = ['overdue', 'review', 'unconfirmed', 'pending', 'ready', 'not_applicable'];

/** One status per cafe. "Ready" follows the readiness definition so it always matches the card. */
export function rowStatus(r: CafeRow): RowStatus {
  if (!r.applicable) return 'not_applicable';
  if (r.ready) return 'ready';
  const w = worst(DAILY_STAGES.map((k) => r.stages[k].status).filter((s) => s !== 'not_applicable'));
  if (w === 'overdue') return 'overdue';
  if (w === 'blocked' || w === 'review') return 'review';
  if (w === 'unconfirmed') return 'unconfirmed';
  return r.openIssues.length ? 'review' : 'pending';
}

export function worstRowStatus(statuses: RowStatus[]): RowStatus {
  const live = statuses.filter((s) => s !== 'not_applicable');
  if (!live.length) return 'not_applicable';
  return live.reduce((a, b) => (ROW_RANK.indexOf(b) < ROW_RANK.indexOf(a) ? b : a));
}

/** Highest-priority blocker: the top open issue, else the first incomplete stage. */
export function rowBlocker(r: CafeRow): { text: string; full: string; owner: string; dueAt?: string; issueId?: string; more: number } {
  if (!r.applicable) return { text: r.naReason ?? 'Not in service', full: r.naReason ?? 'Not in service', owner: '—', more: 0 };
  const top = r.openIssues[0];
  if (top) return { text: top.short, full: top.title, owner: top.owner.name, dueAt: top.dueAt, issueId: top.id, more: r.openIssues.length - 1 };
  const k = DAILY_STAGES.find((s) => r.stages[s].status !== 'complete' && r.stages[s].status !== 'not_applicable');
  if (!k) return { text: 'None', full: 'No open blocker', owner: '—', more: 0 };
  const c = r.stages[k];
  const text = `${STAGE_SHORT[k]} ${STATUS_LABEL[c.status].toLowerCase()}`;
  return { text, full: `${STAGE_LABEL[k]}: ${c.text}`, owner: r.next.owner, dueAt: c.dueAt, more: 0 };
}
