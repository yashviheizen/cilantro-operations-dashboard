import { CircleCheck, X } from 'lucide-react';
import { fmtDate, fmtDateTime, isPast, relativeToNow } from '../data/clock';
import { DISHES, PROJECTION_WEEKS } from '../data/masters';
import {
  awaitingAck, bySeverity, cafeById, fmtQty, isUnusualChange, PLANNING_STAGES, siteById, STAGE_EXPLAIN, STAGE_LABEL, STAGE_SHORT, STATUS_LABEL, WORKFLOW,
} from '../lib/derive';
import type { Filters, PlanningRow, PlanningStage, StageCoverage } from '../lib/derive';
import type { Change, DemoSettings, Issue, IssueScope, IssueStatus, Severity, StageKey } from '../data/types';
import { EmptyState, IssueStatusBadge, SeverityDot, StatusBadge, Term } from './ui';

export function scopeText(scope: IssueScope, siteId: string, cafeId?: string): string {
  const place = cafeId ? `${siteById(siteId).name} · ${cafeById(cafeId).name}` : siteById(siteId).name;
  if (scope.kind === 'week') return `${place} · projection week ${PROJECTION_WEEKS.find((w) => w.id === scope.weekId)?.label}`;
  return `${place} · ${scope.meal ?? 'All meals'} · service ${fmtDate(scope.date)}`;
}

export const dishName = (id?: string) => DISHES.find((d) => d.id === id)?.name ?? '—';
const placeText = (siteId: string, cafeId?: string) => (cafeId ? `${cafeById(cafeId).name} · ${siteById(siteId).name}` : siteById(siteId).name);
const weekShort = (weekId: string) => PROJECTION_WEEKS.find((w) => w.id === weekId)?.label.split(' ')[0] ?? weekId;

// ---------------------------------------------------------------- issues

export interface IssueFilter {
  severity: 'all' | Severity;
  status: 'active' | 'all' | IssueStatus;
  stage: 'all' | StageKey;
}

export const DEFAULT_ISSUE_FILTER: IssueFilter = { severity: 'all', status: 'active', stage: 'all' };

export function filterIssues(issues: Issue[], f: IssueFilter): Issue[] {
  return issues
    .filter((i) => f.severity === 'all' || i.severity === f.severity)
    .filter((i) => (f.status === 'all' ? true : f.status === 'active' ? i.status !== 'resolved' : i.status === f.status))
    .filter((i) => f.stage === 'all' || i.stage === f.stage)
    .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || bySeverity(a, b));
}

/** Compact issue rows: severity, short title, place, owner, due, status. Full detail opens in the drawer. */
export function IssueRows({ issues, onOpen, label }: { issues: Issue[]; onOpen: (id: string) => void; label: string }) {
  return (
    <div className="irows">
      <div className="irow irow--head" aria-hidden="true">
        <span>Severity</span><span>Issue</span><span>Site / cafe</span><span>Owner</span><span>Due</span><span>Status</span>
      </div>
      <ul aria-label={label}>
        {issues.map((i) => {
          const late = i.status !== 'resolved' && isPast(i.dueAt);
          const place = placeText(i.siteId, i.cafeId);
          const when = i.scope.kind === 'service' ? i.scope.meal : `Week ${weekShort(i.scope.weekId)}`;
          return (
            <li key={i.id}>
              <button
                type="button"
                className={`irow${i.status === 'resolved' ? ' is-resolved' : ''}`}
                onClick={() => onOpen(i.id)}
                aria-label={`${i.severity} severity: ${i.title}. ${place}. Owner ${i.owner.name}. Due ${fmtDateTime(i.dueAt)}${late ? ', overdue' : ''}. ${i.status.replace('_', ' ')}${i.acknowledged ? ', acknowledged' : ''}.`}
              >
                <SeverityDot severity={i.severity} />
                <span className="irow__title" title={i.title}>
                  <span className="truncate">{i.short}</span>
                  {when && <span className="meta">{when}</span>}
                </span>
                <span className="truncate meta-ink" title={place}>{place}</span>
                <span className="truncate meta-ink" title={`${i.owner.name} · ${i.owner.role}`}>{i.owner.name}</span>
                <span className={late ? 'txt-critical' : 'meta-ink'} title={relativeToNow(i.dueAt)}>{fmtDateTime(i.dueAt)}</span>
                <span className="irow__status">
                  <IssueStatusBadge status={i.status} />
                  {i.acknowledged && i.status !== 'resolved' && <span className="ackmark" title="Acknowledged">Ack</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function IssueFilters({ filter, onFilter, issues }: { filter: IssueFilter; onFilter: (f: IssueFilter) => void; issues: Issue[] }) {
  const stages = WORKFLOW.filter((k) => k === filter.stage || issues.some((i) => i.stage === k));
  return (
    <div className="panel__tools">
      <label className="ctl ctl--sm">
        <span className="sr-only">Severity</span>
        <select aria-label="Severity" value={filter.severity} onChange={(e) => onFilter({ ...filter, severity: e.target.value as IssueFilter['severity'] })}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="ctl ctl--sm">
        <span className="sr-only">Status</span>
        <select aria-label="Status" value={filter.status} onChange={(e) => onFilter({ ...filter, status: e.target.value as IssueFilter['status'] })}>
          <option value="active">Open + in progress</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="all">All statuses</option>
        </select>
      </label>
      <label className="ctl ctl--sm">
        <span className="sr-only">Stage</span>
        <select aria-label="Stage" value={filter.stage} onChange={(e) => onFilter({ ...filter, stage: e.target.value as IssueFilter['stage'] })}>
          <option value="all">All stages</option>
          {stages.map((k) => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
        </select>
      </label>
    </div>
  );
}

export function NoIssues({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState title="No issues match" icon={<CircleCheck size={20} aria-hidden="true" />}>
      {onClear ? <button type="button" className="btn btn--link" onClick={onClear}>Clear issue filters</button> : 'Nothing open for this site, date and meal.'}
    </EmptyState>
  );
}

// ---------------------------------------------------------------- changes

export type ChangeFilter = 'all' | 'late_unacked' | 'no_reason' | 'unusual';

export const CHANGE_FILTER_LABEL: Record<ChangeFilter, string> = {
  all: 'All',
  late_unacked: 'Late, awaiting ack',
  no_reason: 'No reason',
  unusual: 'Unusual',
};

export function filterChanges(changes: Change[], filter: ChangeFilter, settings: DemoSettings): Change[] {
  return changes.filter((c) =>
    filter === 'all' ? true : filter === 'late_unacked' ? awaitingAck(c) : filter === 'no_reason' ? !c.reason : isUnusualChange(c, settings),
  );
}

export function ackSummary(c: Change): { text: string; done: boolean } {
  if (!c.acknowledgments.length) return { text: 'Not required', done: true };
  const pending = c.acknowledgments.filter((a) => a.state === 'pending');
  if (!pending.length) return { text: `All ${c.acknowledgments.length} acknowledged`, done: true };
  return { text: `Awaiting ${pending.map((a) => a.detail ?? a.team).join(', ')}`, done: false };
}

export function changeValue(c: Change) {
  if (c.textChange) return { prev: c.textChange.previous, next: c.textChange.next };
  return { prev: c.previous ? fmtQty(c.previous) : 'None', next: fmtQty(c.next) };
}

const changeWhat = (c: Change) => (c.dishId ? dishName(c.dishId) : c.record);
const changeWhen = (c: Change) => (c.scope.kind === 'service' ? `${c.scope.meal ?? 'All meals'} ${fmtDate(c.scope.date)}` : `Week ${weekShort(c.scope.weekId)}`);

export function ChangeFilterBar({ filter, onFilter, changes, settings }: { filter: ChangeFilter; onFilter: (f: ChangeFilter) => void; changes: Change[]; settings: DemoSettings }) {
  return (
    <div className="seg" role="group" aria-label="Change filters">
      {(Object.keys(CHANGE_FILTER_LABEL) as ChangeFilter[]).map((k) => (
        <button
          key={k}
          type="button"
          className={filter === k ? 'is-on' : ''}
          aria-pressed={filter === k}
          onClick={() => onFilter(k)}
          title={k === 'unusual' ? 'Proposed demo check — threshold in Demo settings' : undefined}
        >
          {CHANGE_FILTER_LABEL[k]} <span className="seg__n">{filterChanges(changes, k, settings).length}</span>
        </button>
      ))}
    </div>
  );
}

/** Change log: Time · Site / cafe · Change · Old → new · Changed by · Acknowledgment. */
export function ChangeLogTable({ changes, settings, onOpen }: { changes: Change[]; settings: DemoSettings; onOpen: (id: string) => void }) {
  return (
    <table className="grid grid--changes">
      <colgroup>
        <col className="c-time" />
        <col className="c-place" />
        <col />
        <col className="c-delta" />
        <col className="c-by" />
        <col className="c-ack" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Site / cafe</th>
          <th scope="col">Change</th>
          <th scope="col">Old → new</th>
          <th scope="col">Changed by</th>
          <th scope="col">Acknowledgment</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => {
          const v = changeValue(c);
          const ack = ackSummary(c);
          const unusual = isUnusualChange(c, settings);
          return (
            <tr key={c.id} className="is-clickable" onClick={() => onOpen(c.id)}>
              <td className="meta-ink">{fmtDateTime(c.at)}</td>
              <td className="truncate" title={`${cafeById(c.cafeId).name} · ${siteById(c.siteId).name}`}>
                {cafeById(c.cafeId).name}<span className="meta"> · {siteById(c.siteId).name}</span>
              </td>
              <td>
                <button type="button" className="link change__what" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }} title={`${c.kind}: ${changeWhat(c)}`}>
                  <span className="truncate">{changeWhat(c)}</span>
                </button>
                <span className="change__meta">
                  <span className="meta">{changeWhen(c)}</span>
                  {c.late && <span className="flag flag--review">Late</span>}
                  {unusual && <span className="flag flag--review" title="Proposed demo check, configurable in Demo settings">Unusual</span>}
                  {!c.reason && <span className="flag flag--muted">No reason</span>}
                </span>
              </td>
              <td className="delta">
                <span className="old">{v.prev}</span> <span aria-hidden="true">→</span><span className="sr-only">changed to</span> <strong>{v.next}</strong>
              </td>
              <td className="truncate" title={`${c.by.name} · ${c.by.role}`}>{c.by.name}</td>
              <td className="truncate" title={ack.text}>
                <StatusBadge status={ack.done ? 'complete' : 'review'} text={ack.done ? (c.acknowledgments.length ? 'Acknowledged' : 'Not required') : ack.text} compact />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Small newest-first preview for the overview. */
export function ChangesPreview({ changes, onOpen }: { changes: Change[]; onOpen: (id: string) => void }) {
  return (
    <ul className="cprev">
      {changes.map((c) => {
        const v = changeValue(c);
        return (
          <li key={c.id}>
            <button
              type="button"
              className="cprev__row"
              onClick={() => onOpen(c.id)}
              aria-label={`${changeWhat(c)}, ${cafeById(c.cafeId).name}: ${v.prev} to ${v.next}${c.late ? ', late' : ''}`}
            >
              <span className="meta">{fmtDateTime(c.at).split(' ').slice(-1)[0]}</span>
              <span className="truncate">{changeWhat(c)} <span className="meta">· {cafeById(c.cafeId).name}</span></span>
              <span className="delta truncate"><span className="old">{v.prev}</span> → <strong>{v.next}</strong></span>
              {c.late ? <span className="flag flag--review">Late</span> : <span />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- stage summaries (weekly and daily kept apart)

export function StageRows({ coverage, period, active, onSelect, label }: {
  coverage: StageCoverage[]; period: 'week' | 'day'; active?: StageKey | null; onSelect?: (k: StageKey) => void; label: string;
}) {
  const rows = coverage.filter((c) => c.period === period);
  return (
    <table className="grid grid--stages" aria-label={label}>
      <colgroup>
        <col className="c-stage" />
        <col className="c-count" />
        <col className="c-status" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Complete</th>
          <th scope="col">Status</th>
          <th scope="col">Deadline rule</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const breakdown = Object.entries(c.counts)
            .filter(([s]) => s !== 'complete')
            .map(([s, n]) => `${n} ${STATUS_LABEL[s as keyof typeof STATUS_LABEL].toLowerCase()}`)
            .join(', ');
          return (
            <tr key={c.key} className={active === c.key ? 'is-hl' : ''}>
              <th scope="row" title={STAGE_EXPLAIN[c.key]}>
                {onSelect && c.total > c.complete ? (
                  <button type="button" className="link" onClick={() => onSelect(c.key)} aria-pressed={active === c.key}>{STAGE_LABEL[c.key]}</button>
                ) : (
                  STAGE_LABEL[c.key]
                )}
              </th>
              <td className="num">{c.total ? `${c.complete}/${c.total}` : '—'}</td>
              <td>
                {c.total ? <StatusBadge status={c.status} compact /> : <StatusBadge status="not_applicable" compact />}
                {breakdown && <span className="sr-only"> ({breakdown})</span>}
              </td>
              <td className="truncate meta-ink" title={breakdown ? `${c.deadline} · ${breakdown}` : c.deadline}>{c.deadline}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- weekly planning table

export function PlanningTable({ rows, filters, stage, onClearStage, onOpenIssue, issues }: {
  rows: PlanningRow[]; filters: Filters; stage: PlanningStage | null; onClearStage: () => void; onOpenIssue: (id: string) => void; issues: Issue[];
}) {
  const week = PROJECTION_WEEKS.find((w) => w.id === filters.weekId)!;
  const shown = stage ? rows.filter((r) => r.stages[stage].status !== 'complete') : rows;
  return (
    <>
      {stage && (
        <div className="filterbar">
          <button type="button" className="chip is-on" onClick={onClearStage} aria-label={`Remove stage filter ${STAGE_LABEL[stage]}`}>
            {STAGE_SHORT[stage]} not complete <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}
      {!shown.length ? (
        <EmptyState title={stage ? `${STAGE_LABEL[stage]} is complete for every cafe in scope` : 'No cafes in scope'} />
      ) : (
        <table className="grid" aria-label={`Weekly planning for ${week.label}`}>
          <colgroup>
            <col className="c-name" />
            {PLANNING_STAGES.map((k) => <col key={k} />)}
            <col className="c-qty" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Cafe</th>
              {PLANNING_STAGES.map((k) => (
                <th scope="col" key={k} title={STAGE_EXPLAIN[k]} className={stage === k ? 'is-hl' : ''}>{STAGE_SHORT[k]}</th>
              ))}
              <th scope="col">Projected</th>
              <th scope="col">Issue</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const issue = issues.find((i) => i.cafeId === r.cafe.id && i.scope.kind === 'week' && i.scope.weekId === filters.weekId && i.status !== 'resolved');
              return (
                <tr key={r.cafe.id}>
                  <th scope="row" className="truncate" title={`${r.cafe.name} · ${r.site.name}`}>
                    {r.cafe.name}<span className="meta"> · {r.site.name}</span>
                  </th>
                  {PLANNING_STAGES.map((k) => (
                    <td key={k} className="truncate" title={[r.stages[k].text, r.stages[k].rec?.note, r.stages[k].rec?.dueAt && `Due ${fmtDateTime(r.stages[k].rec!.dueAt!)}`].filter(Boolean).join(' · ')}>
                      <StatusBadge status={r.stages[k].status} text={r.stages[k].text} compact />
                    </td>
                  ))}
                  <td>{r.record?.projectedTotal ? fmtQty(r.record.projectedTotal) : <span className="muted">Not submitted</span>}</td>
                  <td className="truncate">
                    {issue ? (
                      <button type="button" className="link" onClick={() => onOpenIssue(issue.id)} title={issue.title}>
                        {issue.short}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="panel__foot meta">
        Projection week is separate from the service date. Daily orders (<Term k="MR" />) never overwrite the weekly projection.
      </p>
    </>
  );
}
