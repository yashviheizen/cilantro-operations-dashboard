// Typed domain model for the Cilantro Operations demo.
// Field names follow the playbook vocabulary (MR, EMR, indent, MOG, article).

export type Meal = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner';
export const MEALS: Meal[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export type Unit = 'kg' | 'g' | 'pcs' | 'pax';

export interface Quantity {
  value: number;
  unit: Unit;
}

/** Where a statement comes from. Rendered as a visible tag wherever it matters. */
export type Provenance =
  | 'existing' // shown or explained in the playbook walkthroughs
  | 'proposed' // proposed dashboard / process support
  | 'verify'; // behaviour or rule that still needs business verification

export type Arrangement = 'Off-site (CPU supplied)' | 'Hybrid' | 'On-site kitchen';

export interface CutoffSetting {
  label: string;
  /** Human-readable rule, e.g. "Wednesday 18:00 before the projection week". */
  rule: string;
  provenance: Provenance;
  note?: string;
}

export interface Site {
  id: string;
  name: string;
  region: string;
  arrangement: Arrangement;
  kitchen: string;
  cutoffs: {
    menuPublication: CutoffSetting;
    projection: CutoffSetting;
    finalOrder: CutoffSetting;
    productionExport: CutoffSetting;
    ingredientRequest: CutoffSetting;
    storeHandoff: CutoffSetting;
  };
}

export interface Cafe {
  id: string;
  siteId: string;
  name: string;
  /** Meals this cafe normally serves. Others are "Not applicable". */
  meals: Meal[];
}

/** Service calendar exception: closed day or meal not served on a date. */
export interface CalendarException {
  cafeId: string;
  date: string; // YYYY-MM-DD
  meals: Meal[] | 'all';
  reason: string;
}

/** Workflow stages in operating order. */
export type StageKey =
  | 'menuPublication'
  | 'menuSelection'
  | 'weeklyProjection'
  | 'finalOrder'
  | 'productionPlan'
  | 'ingredientRequest'
  | 'storeHandoff'
  | 'cookingDispatch';

/**
 * Raw fact recorded for a stage. Display status (overdue, pending, …) is
 * derived from this plus the demo clock, never stored.
 */
export type StageFact =
  | 'done' // submitted / published / exported and, where needed, confirmed
  | 'not_done' // expected but not yet recorded
  | 'needs_review' // recorded, but something must be checked (outdated export, unusual change…)
  | 'blocked' // cannot proceed because an upstream prerequisite is missing
  | 'unknown' // the source does not tell us (e.g. no dispatch actuals)
  | 'not_applicable';

export interface StageRecord {
  fact: StageFact;
  /** Expected completion time (local, ISO without zone). */
  dueAt?: string;
  /** Actual completion / last event time. */
  doneAt?: string;
  /** Short label shown in badges, e.g. "Saved, not published". */
  label?: string;
  /** One-line explanation for tooltips and drawers. */
  note?: string;
  /** If this issue is resolved, the stage is treated as complete (demo link). */
  clearedByIssueId?: string;
}

export type DisplayStatus =
  | 'complete'
  | 'pending'
  | 'review'
  | 'overdue'
  | 'blocked'
  | 'unconfirmed'
  | 'not_applicable';

export interface DishLine {
  dishId: string;
  portion: string; // e.g. "150 g"
  /** Weekly projection for this service day (from the projection week record). */
  projected?: Quantity;
  /** Final daily order (MR). Undefined = no MR line submitted. */
  mr?: Quantity;
  /** Approved exceptional demand (EMR) on top of MR. */
  emr?: Quantity;
  pax?: number;
  remark?: string;
  /** Sourcing route if not CPU. */
  sourcing?: 'CPU' | 'SAP stock transfer (STO)' | 'Local kitchen';
}

/** One cafe × service date × meal. */
export interface ServiceLine {
  cafeId: string;
  date: string;
  meal: Meal;
  stages: Record<Exclude<StageKey, 'weeklyProjection'>, StageRecord>;
  dishes: DishLine[];
}

export interface ProjectionWeek {
  id: string; // e.g. "2026-W43"
  label: string; // "19–25 Oct 2026"
  start: string;
  end: string;
}

/** Weekly planning status for one cafe and projection week. */
export interface WeeklyPlanning {
  cafeId: string;
  weekId: string;
  menuPublication: StageRecord;
  menuSelection: StageRecord;
  weeklyProjection: StageRecord;
  /** Total projected finished food for the week, if submitted. */
  projectedTotal?: Quantity;
}

export interface Recipe {
  dishId: string;
  /** Standard finished output the ingredient list is written for. */
  output: Quantity;
  ingredients: { mogId: string; qty: Quantity }[];
}

export interface Dish {
  id: string;
  name: string;
  section: string;
  recipeStatus: 'available' | 'missing';
  /** True for an EMR "Other" custom entry outside the catalogue. */
  custom?: boolean;
}

export interface Mog {
  id: string;
  name: string;
  /** SAP purchase article; null when the mapping is missing. */
  articleCode: string | null;
  articleName?: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type IssueScope =
  /** meal omitted = applies to every served meal that day. */
  | { kind: 'service'; date: string; meal?: Meal }
  | { kind: 'week'; weekId: string };

export interface Person {
  name: string;
  role: string;
}

export interface TimelineEvent {
  at: string;
  by: string;
  text: string;
  /** Local demo action vs. seeded demo history. */
  local?: boolean;
}

export type EvidenceAvailability = 'available' | 'not_confirmed' | 'unavailable';

export interface Evidence {
  label: string;
  availability: EvidenceAvailability;
  note: string;
}

export interface Issue {
  id: string;
  title: string;
  /** Short scannable label for compact lists; the full title stays in the drawer and accessible name. */
  short: string;
  severity: Severity;
  status: IssueStatus;
  siteId: string;
  cafeId?: string;
  scope: IssueScope;
  stage: StageKey;
  whatHappened: string;
  impact: string;
  nextAction: string;
  owner: Person;
  dueAt: string;
  /** How this issue would be detected. */
  detection: { provenance: Provenance; text: string };
  beforeAfter?: { label: string; before: string; after: string };
  expectedAt?: string;
  actualAt?: string;
  relatedChangeIds: string[];
  relatedIssueIds: string[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  notes: TimelineEvent[];
  closureNote?: string;
  /** Owner acknowledged the issue. Acknowledging never resolves it. */
  acknowledged?: { at: string; by: string };
  /** Optional ingredient impact helper: recompute from recipe ratios. */
  ingredientImpact?: { dishId: string; delta: Quantity };
}

export type ChangeKind =
  | 'Final order (MR) quantity change'
  | 'Final order (MR) cancellation'
  | 'Exceptional order (EMR) added'
  | 'Menu edited after publication'
  | 'Remark used as dish substitution'
  | 'Sourcing added via stock transfer'
  | 'Weekly projection submitted';

export type Team = 'Kitchen (production)' | 'Kitchen section' | 'Store team' | 'Dispatch team' | 'CPU coordinator' | 'Unit manager';

export type AckState = 'acknowledged' | 'pending';

export interface Acknowledgment {
  team: Team;
  detail?: string; // e.g. "Veg section"
  state: AckState;
  at?: string;
  by?: string;
  local?: boolean;
}

export interface Change {
  id: string;
  kind: ChangeKind;
  /** Which record family this change belongs to — keeps weekly and daily apart. */
  record: 'Weekly projection' | 'Final daily order (MR)' | 'Exceptional order (EMR)' | 'Menu plan' | 'Sourcing';
  siteId: string;
  cafeId: string;
  scope: IssueScope;
  dishId?: string;
  portion?: string;
  previous?: Quantity;
  next?: Quantity;
  /** Free-text value change when not a quantity (e.g. menu version). */
  textChange?: { previous: string; next: string };
  by: Person;
  at: string;
  reason: string | null;
  /** Happened after a downstream step (export, indent) had already used the old value. */
  late: boolean;
  lateAfter?: string;
  affectedSteps: string[];
  acknowledgments: Acknowledgment[];
  relatedIssueId?: string;
}

export interface DataSource {
  id: string;
  name: string;
  availability: EvidenceAvailability;
  lastUpdated?: string;
  note: string;
}

export interface DemoSettings {
  /** Demo assumption — NOT an agreed business tolerance. */
  unusualChangePercent: number;
  unusualChangeMinKg: number;
}
