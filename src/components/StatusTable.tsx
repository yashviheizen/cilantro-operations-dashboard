import { useMemo, useState } from 'react';
import { ChevronRight, Download, Search, X } from 'lucide-react';
import { fmtDateTime, isPast, relativeToNow, serviceDateLabel } from '../data/clock';
import { SITES } from '../data/masters';
import { REQUIRED_STAGES, ROW_STATUS, rowBlocker, rowStatus, STAGE_LABEL, STAGE_SHORT, worstRowStatus, bySeverity } from '../lib/derive';
import type { CafeRow, DailyStage, Filters, RowStatus } from '../lib/derive';
import { EmptyState, InfoTip, StatusBadge } from './ui';

export type QuickFilter = 'all' | 'attention' | 'overdue' | 'unconfirmed' | 'not_ready' | 'order_pending' | 'ingredient_review';

export const QUICK_LABEL: Record<QuickFilter, string> = {
  all: 'All',
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
  onOpenCafe: (cafeId: string) => void;
  onOpenSite: (siteId: string) => void;
  onPickSite: (siteId: string) => void;
  onExport: (visible: CafeRow[], search: string) => void;
}

export function StatusTable({ rows, filters, quick, onQuick, stage, onClearStage, onOpenCafe, onOpenSite, onPickSite, onExport }: Props) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => [...filterRows(rows, quick, search, stage)].sort(byStatus), [rows, quick, search, stage]);
  const narrowing = quick !== 'all' || !!search.trim() || !!stage;
  // "All sites" shows one summary per site; any narrowing shows the matching cafes so drill-downs land on records.
  const siteMode = filters.siteId === 'all' && filters.cafeId === 'all' && !narrowing;

  return (
    <section className="panel" id="status-table" aria-labelledby="table-title">
      <div className="panel__head">
        <h2 id="table-title">{siteMode ? 'Sites' : 'Cafes'}</h2>
        <span className="meta">{serviceDateLabel(filters.date)} · {filters.meal === 'All' ? 'all meals' : filters.meal}</span>
        <div className="panel__tools">
          <label className="ctl ctl--sm">
            <span className="sr-only">Show</span>
            <select value={quick} onChange={(e) => onQuick(e.target.value as QuickFilter)} aria-label="Show cafes">
              {(Object.keys(QUICK_LABEL) as QuickFilter[]).map((k) => (
                <option key={k} value={k}>
                  {k === 'all' ? 'All cafes' : `${QUICK_LABEL[k]} (${filterRows(rows, k, '', null).length})`}
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
          <button type="button" className="btn btn--link" onClick={() => { onQuick('all'); setSearch(''); onClearStage(); }}>
            Clear table filters
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
                  <InfoTip label="Readiness definition">
                    Ready = {REQUIRED_STAGES.map((k) => STAGE_SHORT[k].toLowerCase()).join(', ')} complete for every meal the cafe serves.
                    Store handoff and dispatch are tracked but not required (data partly unavailable).
                  </InfoTip>
                </span>
              </th>
              <th scope="col">Current blocker</th>
              <th scope="col">Owner</th>
              <th scope="col">Due</th>
              <th scope="col"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {siteMode
              ? SITES.map((site) => {
                  const siteRows = visible.filter((r) => r.site.id === site.id);
                  if (!siteRows.length) return null;
                  return <SiteTr key={site.id} siteId={site.id} name={site.name} rows={siteRows} onPick={onPickSite} onOpen={onOpenSite} />;
                })
              : visible.map((r) => <CafeTr key={r.cafe.id} r={r} showSite={filters.siteId === 'all'} onOpen={onOpenCafe} />)}
          </tbody>
        </table>
      )}
      <p className="panel__foot meta">
        {siteMode
          ? `${SITES.filter((s) => visible.some((r) => r.site.id === s.id)).length} sites · ${rows.length} cafes. Pick a site to see its cafes.`
          : `Showing ${visible.length} of ${rows.length} cafes.`}
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

function RowBadge({ s, sub }: { s: RowStatus; sub?: string }) {
  return (
    <span className="rowstatus">
      <StatusBadge status={ROW_STATUS[s].display} text={ROW_STATUS[s].label} compact />
      {sub && <span className="meta">{sub}</span>}
    </span>
  );
}

function SiteTr({ siteId, name, rows, onPick, onOpen }: { siteId: string; name: string; rows: CafeRow[]; onPick: (id: string) => void; onOpen: (id: string) => void }) {
  const live = rows.filter((r) => r.applicable);
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
    <tr className="is-clickable" tabIndex={0} aria-label={`View ${name} details`} onClick={() => onOpen(siteId)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(siteId); } }}>
      <th scope="row">
        <button type="button" className="link strong" onClick={(e) => { e.stopPropagation(); onPick(siteId); }} title={`Filter to ${name}`}>{name}</button>
        <span className="meta"> · {rows.length} cafes</span>
      </th>
      <td><RowBadge s={status} sub={live.length ? `${ready}/${live.length} ready` : undefined} /></td>
      <td><Blocker text={b.text} full={b.full} more={b.more} /></td>
      <td className="truncate" title={b.owner}>{b.owner}</td>
      <td><Due at={b.dueAt} /></td>
      <td>
        <button type="button" className="icon-btn icon-btn--sm" onClick={(e) => { e.stopPropagation(); onOpen(siteId); }} aria-label={`View ${name} details`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function CafeTr({ r, showSite, onOpen }: { r: CafeRow; showSite: boolean; onOpen: (id: string) => void }) {
  const b = rowBlocker(r);
  const s = rowStatus(r);
  return (
    <tr className={`is-clickable ${r.applicable ? '' : 'is-na'}`} tabIndex={0} aria-label={`View ${r.cafe.name} details`} onClick={() => onOpen(r.cafe.id)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(r.cafe.id); } }}>
      <th scope="row">
        <button type="button" className="link strong" onClick={(e) => { e.stopPropagation(); onOpen(r.cafe.id); }}>{r.cafe.name}</button>
        {showSite && <span className="meta"> · {r.site.name}</span>}
      </th>
      <td><RowBadge s={s} /></td>
      <td><Blocker text={b.text} full={b.full} more={b.more} /></td>
      <td className="truncate" title={b.owner}>{b.owner}</td>
      <td><Due at={b.dueAt} /></td>
      <td>
        <button type="button" className="icon-btn icon-btn--sm" onClick={(e) => { e.stopPropagation(); onOpen(r.cafe.id); }} aria-label={`View ${r.cafe.name} details`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
