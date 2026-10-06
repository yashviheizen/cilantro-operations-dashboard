import { useMemo } from 'react';
import { Download, Search, X } from 'lucide-react';
import { fmtDateTime, isPast, relativeToNow, serviceDateLabel } from '../data/clock';
import { SITES } from '../data/masters';
import { REQUIRED_STAGES, ROW_STATUS, rowBlocker, rowStatus, siteById, STAGE_LABEL, STAGE_SHORT, worstRowStatus, bySeverity } from '../lib/derive';
import type { CafeRow, DailyStage, Filters, RowStatus } from '../lib/derive';
import { EmptyState, InfoTip, rowOpen, StatusBadge, ViewButton } from './ui';
import type { OpenFn } from './ui';

export type QuickFilter = 'all' | 'attention' | 'overdue' | 'unconfirmed' | 'not_ready' | 'order_pending' | 'ingredient_review';

export const QUICK_LABEL: Record<QuickFilter, string> = {
  all: 'All statuses',
  attention: 'Needs attention',
  overdue: 'Overdue',
  unconfirmed: 'Not confirmed',
  not_ready: 'Not ready',
  order_pending: 'Order pending',
  ingredient_review: 'Ingredient review',
};

export function filterRows(rows: CafeRow[], quick: QuickFilter, search: string, stage: DailyStage | null): CafeRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = [r.cafe.name, r.site.name, r.next.text, r.next.owner, ...r.openIssues.flatMap((i) => [i.title, i.short])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (stage && (!r.applicable || r.stages[stage].status === 'complete')) return false;
    switch (quick) {
      case 'all':
        return true;
      case 'attention':
        return r.attention;
      case 'overdue':
        return r.overdue;
      case 'unconfirmed':
        return r.unconfirmed;
      case 'not_ready':
        return r.applicable && !r.ready;
      case 'order_pending':
        return ['pending', 'overdue'].includes(r.stages.finalOrder.status);
      case 'ingredient_review':
        return ['review', 'blocked', 'overdue'].includes(r.stages.ingredientRequest.status);
    }
  });
}

const RANK: RowStatus[] = ['overdue', 'review', 'unconfirmed', 'pending', 'ready', 'not_applicable'];
const byStatus = (a: CafeRow, b: CafeRow) =>
  RANK.indexOf(rowStatus(a)) - RANK.indexOf(rowStatus(b)) || (a.next.dueAt ?? '9').localeCompare(b.next.dueAt ?? '9') || a.cafe.name.localeCompare(b.cafe.name);

interface Props {
  rows: CafeRow[]; // all rows in place scope
  filters: Filters;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  stage: DailyStage | null;
  onClearStage: () => void;
  onOpenCafe: OpenFn;
  onOpenSite: OpenFn;
  search: string;
  onSearch: (q: string) => void;
  onExport: (visible: CafeRow[], search: string) => void;
}

export function StatusTable({ rows, filters, quick, onQuick, stage, onClearStage, onOpenCafe, onOpenSite, search, onSearch: setSearch, onExport }: Props) {
  const visible = useMemo(() => [...filterRows(rows, quick, search, stage)].sort(byStatus), [rows, quick, search, stage]);
  const narrowing = quick !== 'all' || !!search.trim() || !!stage;
  // "All sites" shows one summary per site; any narrowing shows the matching cafes so drill-downs land on records.
  const siteMode = filters.siteId === 'all' && filters.cafeId === 'all' && !narrowing;
  const live = rows.filter((r) => r.applicable).length;
  const title = siteMode
    ? 'Sites overview'
    : filters.siteId === 'all'
      ? 'Cafes at all sites'
      : filters.cafeId === 'all'
        ? `Cafes at ${siteById(filters.siteId).name}`
        : `${rows[0]?.cafe.name ?? 'Cafe'} at ${siteById(filters.siteId).name}`;
  const clearAll = () => { onQuick('all'); setSearch(''); onClearStage(); };

  return (
    <section className="panel" id="status-table" aria-labelledby="table-title">
      <div className="panel__head">
        <h2 id="table-title" tabIndex={-1}>{title}</h2>
        <span className="meta">
          {filters.siteId !== 'all' && `${rows.length} ${rows.length === 1 ? 'cafe' : 'cafes'} (${live} in service) · `}
          {serviceDateLabel(filters.date)} · {filters.meal === 'All' ? 'all meals' : filters.meal}
        </span>
        <div className="panel__tools">
          {narrowing && (
            <button type="button" className="btn btn--link btn--sm" onClick={clearAll}>
              Clear filters
            </button>
          )}
          <label className="ctl ctl--sm ctl--status">
            <span className="ctl__tag" aria-hidden="true">Status</span>
            <select value={quick} onChange={(e) => onQuick(e.target.value as QuickFilter)} aria-label="Status filter">
              {(Object.keys(QUICK_LABEL) as QuickFilter[]).map((k) => (
                <option key={k} value={k}>
                  {k === 'all' ? QUICK_LABEL.all : `${QUICK_LABEL[k]} (${filterRows(rows, k, '', null).length})`}
                </option>
              ))}
            </select>
          </label>
          <label className="search">
            <Search size={14} aria-hidden="true" />
            <span className="sr-only">Search cafes, owners and issues</span>
            <input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="button" className="btn btn--sm" onClick={() => onExport(visible, search)} disabled={!visible.length} title="Export the visible cafe rows and active filters">
            <Download size={14} aria-hidden="true" /> CSV
          </button>
        </div>
      </div>

      {stage && (
        <div className="filterbar">
          <button type="button" className="chip is-on" onClick={onClearStage} aria-label={`Remove stage filter ${STAGE_LABEL[stage]}`}>
            {STAGE_SHORT[stage]} not complete <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {!visible.length ? (
        <EmptyState title="No cafes match these filters">
          <button type="button" className="btn btn--link" onClick={clearAll}>
            Clear filters
          </button>
        </EmptyState>
      ) : (
        <table className="grid">
          <colgroup>
            <col className="c-name" />
            <col className="c-status" />
            <col />
            <col className="c-owner" />
            <col className="c-due" />
            <col className="c-view" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Site / cafe</th>
              <th scope="col">
                <span className="th-info">
                  Status
                  <InfoTip label="Preparation ready definition">
                    Prep ready = {REQUIRED_STAGES.map((k) => STAGE_SHORT[k].toLowerCase()).join(', ')} complete for every meal the cafe serves.
                    It does not mean food is cooked, dispatched or delivered: store handoff and dispatch are tracked separately (data partly unavailable).
                    Closed cafes show Not applicable and are excluded.
                  </InfoTip>
                </span>
              </th>
              <th scope="col">
                <span className="th-info">
                  Current blocker
                  <InfoTip label="About the blocker columns">
                    The highest-priority open blocker for the {siteMode ? 'site' : 'cafe'}. Blocker owner and Action due belong to that blocker.
                  </InfoTip>
                </span>
              </th>
              <th scope="col" title="Owner of the highest-priority blocker">Blocker owner</th>
              <th scope="col" title="When the highest-priority blocker must be actioned">Action due</th>
              <th scope="col"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {siteMode
              ? SITES.map((site) => {
                  const siteRows = visible.filter((r) => r.site.id === site.id);
                  if (!siteRows.length) return null;
                  return <SiteTr key={site.id} siteId={site.id} name={site.name} rows={siteRows} onOpen={onOpenSite} />;
                })
              : visible.map((r) => <CafeTr key={r.cafe.id} r={r} showSite={filters.siteId === 'all'} onOpen={onOpenCafe} />)}
          </tbody>
        </table>
      )}
      <p className="panel__foot meta">
        {siteMode
          ? `${SITES.filter((s) => visible.some((r) => r.site.id === s.id)).length} sites · ${rows.length} cafes (${live} in service). Select a site row to explore its cafes and issues.`
          : `Showing ${visible.length} of ${rows.length} cafes (${live} in service).`}
      </p>
    </section>
  );
}

function Due({ at }: { at?: string }) {
  if (!at) return <span className="muted">—</span>;
  return (
    <span className={isPast(at) ? 'txt-critical' : ''} title={`${fmtDateTime(at)} · ${relativeToNow(at)}`}>
      {fmtDateTime(at)}
    </span>
  );
}

function Blocker({ text, full, more }: { text: string; full: string; more: number }) {
  return (
    <span className="blocker">
      <span className="truncate" title={full}>
        <span aria-hidden="true">{text}</span>
        <span className="sr-only">{full}</span>
      </span>
      {more > 0 && <span className="more">+{more} {more === 1 ? 'issue' : 'issues'}</span>}
    </span>
  );
}

function RowBadge({ s, sub, subTitle }: { s: RowStatus; sub?: string; subTitle?: string }) {
  return (
    <span className="rowstatus">
      <StatusBadge status={ROW_STATUS[s].display} text={ROW_STATUS[s].label} compact />
      {sub && <span className="meta" title={subTitle}>{sub}</span>}
    </span>
  );
}

function SiteTr({ siteId, name, rows, onOpen }: { siteId: string; name: string; rows: CafeRow[]; onOpen: OpenFn }) {
  const live = rows.filter((r) => r.applicable);
  const closed = rows.length - live.length;
  const ready = live.filter((r) => r.ready).length;
  const status = worstRowStatus(rows.map(rowStatus));
  const issues = rows.flatMap((r) => r.openIssues).sort(bySeverity);
  const top = issues[0];
  const fallback = rows.filter((r) => r.applicable && !r.ready).sort(byStatus)[0];
  const b = top
    ? { text: top.short, full: `${top.title} (${rows.find((r) => r.cafe.id === top.cafeId)?.cafe.name ?? name})`, owner: top.owner.name, dueAt: top.dueAt, more: issues.length - 1 }
    : fallback
      ? rowBlocker(fallback)
      : { text: 'None', full: 'No open blocker', owner: '—', dueAt: undefined, more: 0 };
  return (
    <tr {...rowOpen((from) => onOpen(siteId, from))}>
      <th scope="row">
        <span className="strong">{name}</span>
        <span className="meta" title={closed ? `${rows.length} cafes, ${closed} not in service on this date` : undefined}>
          {' '}· {rows.length} cafes{closed ? ` · ${closed} closed` : ''}
        </span>
      </th>
      <td><RowBadge s={status} sub={live.length ? `${ready} of ${live.length} prep ready` : undefined} subTitle={`${ready} of ${live.length} cafes in service are preparation ready`} /></td>
      <td><Blocker text={b.text} full={b.full} more={b.more} /></td>
      <td className="truncate" title={b.owner}>{b.owner}</td>
      <td><Due at={b.dueAt} /></td>
      <td><ViewButton label={`View ${name} details`} onOpen={(from) => onOpen(siteId, from)} /></td>
    </tr>
  );
}

function CafeTr({ r, showSite, onOpen }: { r: CafeRow; showSite: boolean; onOpen: OpenFn }) {
  const b = rowBlocker(r);
  const s = rowStatus(r);
  return (
    <tr {...rowOpen((from) => onOpen(r.cafe.id, from), r.applicable ? '' : 'is-na')}>
      <th scope="row">
        <span className="strong">{r.cafe.name}</span>
        {showSite && <span className="meta"> · {r.site.name}</span>}
      </th>
      <td><RowBadge s={s} /></td>
      <td><Blocker text={b.text} full={b.full} more={b.more} /></td>
      <td className="truncate" title={b.owner}>{b.owner}</td>
      <td><Due at={b.dueAt} /></td>
      <td><ViewButton label={`View ${r.cafe.name} details`} onOpen={(from) => onOpen(r.cafe.id, from)} /></td>
    </tr>
  );
}
