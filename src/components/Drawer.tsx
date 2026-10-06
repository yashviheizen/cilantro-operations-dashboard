import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageSquarePlus, Play, X } from 'lucide-react';
import { fmtDateTime, relativeToNow, serviceDateLabel } from '../data/clock';
import { DATA_SOURCES, DISHES, PROJECTION_WEEKS, SITES } from '../data/masters';
import { ASSIGNABLE, WEEKLY_PLANNING } from '../data/operations';
import {
  cafeById, cafeRows, DAILY_STAGES, fmtQty, hasDataFor, isUnusualChange, PLANNING_STAGES, planningRows, siteById, STAGE_EXPLAIN, STAGE_LABEL,
  stageStatus, stageText, resolvedSet, workflowCoverage, rowStatus, rowBlocker, ROW_STATUS, REQUIRED_STAGES, deadlineFor,
  changesInScope, CUTOFF_KEY, STAGE_OWNER_ROLE, worst, worstRowStatus, bySeverity,
} from '../lib/derive';
import type { CafeRow, Filters } from '../lib/derive';
import { estimateIngredients } from '../lib/ingredients';
import type { Action, DemoState } from '../lib/store';
import type { Change, Issue, Quantity, Site, StageKey } from '../data/types';
import { AvailabilityBadge, EmptyState, IssueStatusBadge, ProvenanceTag, SeverityBadge, StatusBadge, InfoTip, Term } from './ui';
import { ackSummary, changeValue, dishName, scopeText, stageBreakdown, StageRows } from './Lists';
import { CUTOFFS } from './DataStatus';

export type DrawerTarget = { kind: 'site' | 'cafe' | 'planning' | 'stage' | 'cutoff' | 'issue' | 'change' | 'source'; id: string };

interface Props {
  stack: DrawerTarget[];
  onPush: (t: DrawerTarget) => void;
  /** Keep the first n entries of the stack (n ≥ 1). */
  onTrim: (n: number) => void;
  onClose: () => void;
  state: DemoState;
  dispatch: (a: Action) => void;
  filters: Filters;
  row?: CafeRow;
  notify: (msg: string) => void;
  /** Filter the overview to one site and close the drawer. */
  /** Apply a stage filter (daily → overview table, weekly → planning table) and close the drawer. */
  onFilterStage: (k: StageKey) => void;
}

const FOCUSABLE = 'button:not([disabled]), select, input, textarea, [href], [tabindex]:not([tabindex="-1"])';
const tkey = (t: DrawerTarget) => `${t.kind}:${t.id}`;

/**
 * One right-hand drawer. A site opened at the root shows its cafes; picking a cafe splits the drawer into
 * a compact site panel (left) and the cafe panel (right). Deeper issue/change details replace the right panel
 * content rather than adding more panels. Nothing here changes the global filters.
 */
export function Drawer({ stack, onPush, onTrim, onClose, state, dispatch, filters, row, notify, onFilterStage }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const childPanel = useRef<HTMLElement>(null);
  const childTitle = useRef<HTMLHeadingElement>(null);
  const popped = useRef<DrawerTarget | null>(null);
  const top = stack[stack.length - 1];
  const split = stack.length > 1 && stack[0].kind === 'site';

  const trim = (n: number) => {
    popped.current = stack[n] ?? null;
    onTrim(n);
  };
  const back = () => (stack.length > 1 ? trim(stack.length - 1) : onClose());

  // Focus follows the panel that changed: into a newly opened detail, or back to the item that opened it.
  useEffect(() => {
    const p = popped.current;
    popped.current = null;
    const returnTo = p && dialog.current?.querySelector<HTMLElement>(`[data-target="${tkey(p)}"]`);
    if (returnTo) returnTo.focus();
    else if (split) {
      childPanel.current?.scrollTo({ top: 0 });
      childTitle.current?.focus({ preventScroll: true });
    } else {
      closeBtn.current?.focus();
      dialog.current?.scrollTo({ top: 0 });
    }
  }, [top?.kind, top?.id, stack.length, split]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (stack.length > 1) trim(stack.length - 1);
        else onClose();
      } else if (e.key === 'Tab' && dialog.current) {
        const f = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!top) return null;
  const week = PROJECTION_WEEKS.find((w) => w.id === filters.weekId)?.label ?? filters.weekId;
  const day = `${serviceDateLabel(filters.date)} · ${filters.meal === 'All' ? 'all meals' : filters.meal}`;
  const place = filters.siteId === 'all' ? 'All sites' : filters.cafeId === 'all' ? siteById(filters.siteId).name : `${siteById(filters.siteId).name} · ${cafeById(filters.cafeId).name}`;

  /** Header text for one drawer entry. */
  const meta = (t: DrawerTarget): { kind: string; title: string; ctx: string; crumb: string } | null => {
    switch (t.kind) {
      case 'source': {
        const d = DATA_SOURCES.find((x) => x.id === t.id);
        return d ? { kind: 'Data source', title: d.name, ctx: 'All sites · demo snapshot', crumb: d.name } : null;
      }
      case 'site': {
        const st = siteById(t.id);
        return { kind: 'Site', title: st.name, ctx: `${st.region} · ${day}`, crumb: st.name };
      }
      case 'cafe': {
        const c = cafeById(t.id);
        return { kind: 'Cafe', title: c.name, ctx: `${siteById(c.siteId).name} · ${day}`, crumb: c.name };
      }
      case 'planning': {
        const c = cafeById(t.id);
        return { kind: 'Weekly planning', title: c.name, ctx: `${siteById(c.siteId).name} · projection week ${week}`, crumb: `${c.name} planning` };
      }
      case 'stage': {
        const k = t.id as StageKey;
        const weekly = PLANNING_STAGES.includes(k as never);
        return { kind: weekly ? 'Weekly stage' : 'Daily stage', title: STAGE_LABEL[k], ctx: `${place} · ${weekly ? `projection week ${week}` : day}`, crumb: STAGE_LABEL[k] };
      }
      case 'cutoff': {
        const c = CUTOFFS.find((x) => x.key === t.id);
        return c ? { kind: 'Cutoff rule', title: c.label, ctx: 'All sites · rules as recorded for the demo', crumb: c.label } : null;
      }
      case 'issue': {
        const i = state.issues.find((x) => x.id === t.id);
        return i ? { kind: `Issue ${i.id}`, title: i.title, ctx: scopeText(i.scope, i.siteId, i.cafeId), crumb: `Issue ${i.id}` } : null;
      }
      case 'change': {
        const c = state.changes.find((x) => x.id === t.id);
        return c ? { kind: `Change ${c.id}`, title: c.kind, ctx: scopeText(c.scope, c.siteId, c.cafeId), crumb: `Change ${c.id}` } : null;
      }
    }
  };

  /** Body for one drawer entry. `selected` highlights the cafe open beside a site panel. */
  const body = (t: DrawerTarget, selected?: string) => {
    switch (t.kind) {
      case 'source': {
        const source = DATA_SOURCES.find((d) => d.id === t.id);
        if (!source) break;
        return <>
          <dl className="kv">
            <div><dt>Availability</dt><dd><AvailabilityBadge a={source.availability} /></dd></div>
            <div><dt>Last updated</dt><dd>{source.lastUpdated ? fmtDateTime(source.lastUpdated) : 'Not available'}</dd></div>
            <div><dt>Scope</dt><dd>All sites and cafes in this demo (one shared source)</dd></div>
          </dl>
          <Section title="Coverage & limitations"><p>{source.note}</p></Section>
          <Section title="How to read this status"><p>Availability describes this demo snapshot. It does not confirm a live integration or physical completion. Missing evidence remains unavailable.</p></Section>
        </>;
      }
      case 'site':
        return <SiteDetail siteId={t.id} filters={filters} state={state} onPush={onPush} selected={selected} compact={!!selected} />;
      case 'cafe':
        if (row && row.cafe.id === t.id) return <CafeDetail row={row} filters={filters} state={state} onPush={onPush} />;
        break;
      case 'planning':
        return <PlanningDetail cafeId={t.id} filters={filters} state={state} onPush={onPush} />;
      case 'stage':
        return <StageDetail k={t.id as StageKey} filters={filters} state={state} onPush={onPush} onFilterStage={onFilterStage} />;
      case 'cutoff':
        return <CutoffDetail k={t.id as keyof Site['cutoffs']} />;
      case 'issue': {
        const issue = state.issues.find((i) => i.id === t.id);
        if (issue) return <IssueDetail key={issue.id} issue={issue} state={state} dispatch={dispatch} onPush={onPush} notify={notify} />;
        break;
      }
      case 'change': {
        const change = state.changes.find((c) => c.id === t.id);
        if (change) return <ChangeDetail key={change.id} change={change} state={state} dispatch={dispatch} onPush={onPush} notify={notify} />;
        break;
      }
    }
    return <EmptyState title="Details unavailable" />;
  };

  const topMeta = meta(top) ?? { kind: 'Details', title: 'Details', ctx: '', crumb: 'Details' };

  if (split) {
    const parent = stack[0];
    const pMeta = meta(parent)!;
    const selectedCafe = stack[1].kind === 'cafe' ? stack[1].id : undefined;
    return (
      <div className="drawer-layer">
        <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
        <div className="drawer drawer--split" role="dialog" aria-modal="true" aria-labelledby="drawer-title drawer-child-title" ref={dialog}>
          <section className="dpanel dpanel--parent" aria-labelledby="drawer-title">
            <div className="drawer__head">
              <div className="drawer__titles">
                <span className="drawer__kind">{pMeta.kind}</span>
                <h2 id="drawer-title">{pMeta.title}</h2>
                <span className="drawer__ctx">{pMeta.ctx}</span>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} ref={closeBtn} aria-label={`Close ${pMeta.title} details (closes both panels)`}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="drawer__body">{body(parent, selectedCafe ?? '')}</div>
          </section>

          <section className="dpanel dpanel--child" aria-labelledby="drawer-child-title" ref={childPanel}>
            <div className="drawer__head">
              <button type="button" className="btn btn--sm dpanel__back" onClick={() => trim(1)}>
                <ArrowLeft size={14} aria-hidden="true" /> Back to {pMeta.title}
              </button>
              <div className="drawer__titles">
                <nav className="dcrumbs" aria-label="Drawer location">
                  <ol>
                    {stack.map((t, i) => {
                      const m = meta(t);
                      const last = i === stack.length - 1;
                      return (
                        <li key={tkey(t)}>
                          {last ? (
                            <span aria-current="page">{m?.crumb ?? 'Details'}</span>
                          ) : (
                            <button type="button" className="link" onClick={() => trim(i + 1)} data-target={i > 0 ? tkey(t) : undefined}>{m?.crumb}</button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
                <h2 id="drawer-child-title" tabIndex={-1} ref={childTitle}>{topMeta.title}</h2>
                <span className="drawer__ctx">{topMeta.ctx}</span>
              </div>
              <button type="button" className="icon-btn dpanel__close" onClick={() => trim(1)} aria-label={`Close ${meta(stack[1])?.crumb ?? 'detail'} panel (Escape)`}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="drawer__body">{body(top)}</div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-describedby={topMeta.ctx ? 'drawer-ctx' : undefined} ref={dialog}>
        <div className="drawer__head">
          {stack.length > 1 && (
            <button type="button" className="icon-btn" onClick={back} aria-label={`Back to ${meta(stack[stack.length - 2])?.crumb ?? 'previous detail'}`}>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <div className="drawer__titles">
            <span className="drawer__kind">{topMeta.kind}</span>
            <h2 id="drawer-title">{topMeta.title}</h2>
            {topMeta.ctx && <span className="drawer__ctx" id="drawer-ctx">{topMeta.ctx}</span>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} ref={closeBtn} aria-label="Close details (Escape)">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="drawer__body">{body(top)}</div>
      </div>
    </div>
  );
}

/** Status, blocker, owner and next action — always the first block in a record drawer. */
function StatusBlock({ badge, lines, next, children }: { badge: ReactNode; lines?: ReactNode; next?: ReactNode; children?: ReactNode }) {
  return (
    <div className="drawer__status">
      <div className="drawer__status-row">{badge}{lines}</div>
      {next && <p className="drawer__next">{next}</p>}
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dsec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function LocalNote() {
  return <p className="local-note">Local demo action — saved in this browser only. No email, WhatsApp or reminder is sent.</p>;
}

// ---------------------------------------------------------------- cafe

function CafeDetail({ row, filters, state, onPush }: { row: CafeRow; filters: Filters; state: DemoState; onPush: (t: DrawerTarget) => void }) {
  const resolved = resolvedSet(state.issues);
  const planning = WEEKLY_PLANNING.find((w) => w.cafeId === row.cafe.id && w.weekId === filters.weekId);
  const changes = state.changes.filter((c) => c.cafeId === row.cafe.id && (c.scope.kind === 'week' ? c.scope.weekId === filters.weekId : c.scope.date === filters.date));
  const weekIssues = state.issues.filter((i) => i.cafeId === row.cafe.id && i.scope.kind === 'week' && i.scope.weekId === filters.weekId && i.status !== 'resolved');

  const s = rowStatus(row);
  const b = rowBlocker(row);
  return (
    <>
      <StatusBlock
        badge={<StatusBadge status={ROW_STATUS[s].display} text={ROW_STATUS[s].label} />}
        lines={<span className="meta">{row.applicable ? `Blocker: ${b.full}` : row.naReason}</span>}
        next={row.applicable && !row.ready ? <><strong>Next:</strong> {row.next.text} · {row.next.owner}{row.next.dueAt && ` · due ${fmtDateTime(row.next.dueAt)}`}</> : row.applicable ? <>No preparation step outstanding. Store handoff and dispatch are tracked separately below.</> : <>Closed or not served — no orders are expected and no missing-order alerts are raised.</>}
      />
      <dl className="kv">
        <div><dt>Site</dt><dd>{row.site.name} · {row.site.region}</dd></div>
        <div><dt>Kitchen</dt><dd>{row.site.arrangement} — {row.site.kitchen}</dd></div>
        <div><dt>Service date</dt><dd>{serviceDateLabel(filters.date)}</dd></div>
        <div><dt>Meals</dt><dd>{row.applicable ? row.meals.join(', ') : `Not applicable — ${row.naReason}`}</dd></div>
        <div><dt>Preparation ready</dt><dd>{!row.applicable ? 'Not applicable' : row.ready ? 'Yes — not a dispatch or delivery confirmation' : 'No'}</dd></div>
      </dl>

      <Section title="Open issues">
        {[...row.openIssues, ...weekIssues].length ? (
          <ul className="links">
            {[...row.openIssues, ...weekIssues].map((i) => (
              <li key={i.id}>
                <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'issue', id: i.id })}>
                  <SeverityBadge severity={i.severity} /> {i.short}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No open issues for this cafe in the current scope.</p>
        )}
      </Section>

      <Section title={`Daily stages · ${serviceDateLabel(filters.date)}`}>
        {row.applicable ? (
          <ul className="stagelist">
            {DAILY_STAGES.map((k) => {
              const c = row.stages[k];
              return (
                <li key={k} title={[STAGE_EXPLAIN[k], c.note].filter(Boolean).join(' — ')}>
                  {REQUIRED_STAGES.includes(k) ? (
                    <span className="stagelist__k">{STAGE_LABEL[k]}</span>
                  ) : (
                    <span className="stagelist__k stagelist__k--tip">
                      <span className="truncate">{STAGE_LABEL[k]}</span>
                      <InfoTip label={`About ${STAGE_LABEL[k].toLowerCase()} and readiness`}>
                        Not included in preparation readiness. Still operationally important: it is tracked here, but its data is partly unavailable in the demo.
                      </InfoTip>
                    </span>
                  )}
                  <StatusBadge status={c.status} text={c.text} compact />
                  <span className="meta">{c.dueAt ? `Due ${fmtDateTime(c.dueAt)}` : ''}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="meta">Not applicable — {row.naReason}</p>
        )}
      </Section>

      <Section title={`Weekly planning · ${PROJECTION_WEEKS.find((w) => w.id === filters.weekId)?.label ?? filters.weekId}`}>
        {planning ? (
          <ul className="stagelist">
            {PLANNING_STAGES.map((k) => {
              const st = stageStatus(planning[k], resolved);
              return (
                <li key={k} title={STAGE_EXPLAIN[k]}>
                  <span className="stagelist__k">{STAGE_LABEL[k]}</span>
                  <StatusBadge status={st} text={stageText(planning[k], st)} compact />
                  <span className="meta">{planning[k].dueAt ? `Due ${fmtDateTime(planning[k].dueAt!)}` : ''}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="meta">Data unavailable for this projection week.</p>
        )}
      </Section>

      {row.lines.map((l) => (
        <Section key={l.meal} title={`${l.meal} dishes`}>
          {l.dishes.length ? (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th scope="col">Dish</th>
                    <th scope="col">Portion</th>
                    <th scope="col">Weekly projection</th>
                    <th scope="col">Final order (<Term k="MR" />)</th>
                    <th scope="col"><Term k="EMR" /></th>
                    <th scope="col">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {l.dishes.map((d, i) => {
                    const dish = DISHES.find((x) => x.id === d.dishId);
                    return (
                      <tr key={i}>
                        <th scope="row">
                          {dish?.name}
                          {dish?.recipeStatus === 'missing' && <div className="tiny warn">Recipe missing</div>}
                          {d.remark && <div className="tiny warn">Remark: “{d.remark}”</div>}
                        </th>
                        <td>{d.portion}</td>
                        <td>{d.projected ? fmtQty(d.projected) : <span className="muted">Not in projection</span>}</td>
                        <td>{d.mr ? fmtQty(d.mr) : <span className="warn">Not submitted</span>}</td>
                        <td>{d.emr ? <>{fmtQty(d.emr)}{d.pax && <span className="muted"> ({d.pax} <Term k="pax" />)</span>}</> : '—'}</td>
                        <td className="small">{d.sourcing === 'SAP stock transfer (STO)' ? <Term k="STO">Stock transfer</Term> : d.sourcing}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No dish lines" />
          )}
        </Section>
      ))}

      {row.applicable && (
        <Section title="Stage times by meal">
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  {row.lines.map((l) => <th scope="col" key={l.meal}>{l.meal}</th>)}
                </tr>
              </thead>
              <tbody>
                {DAILY_STAGES.map((k) => (
                  <tr key={k}>
                    <th scope="row" title={STAGE_EXPLAIN[k]}>{STAGE_LABEL[k]}</th>
                    {row.lines.map((l) => {
                      const rec = l.stages[k];
                      const st = stageStatus(rec, resolved);
                      return (
                        <td key={l.meal}>
                          <StatusBadge status={st} text={stageText(rec, st)} compact />
                          <div className="tiny muted">
                            {rec.dueAt && <>Expected {fmtDateTime(rec.dueAt)}</>}
                            {rec.doneAt && <><br />Actual {fmtDateTime(rec.doneAt)}</>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Recent changes">
        {changes.length ? (
          <ul className="links">
            {changes.map((c) => (
              <li key={c.id}>
                <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'change', id: c.id })}>
                  {c.kind}: {c.dishId ? dishName(c.dishId) : c.record} {changeValue(c).prev} → {changeValue(c).next}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recorded changes.</p>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- site

function SiteDetail({ siteId, filters, state, onPush, selected, compact }: {
  siteId: string; filters: Filters; state: DemoState; onPush: (t: DrawerTarget) => void;
  /** Cafe currently open in the adjacent panel. */
  selected?: string;
  /** Parent-panel mode: keep the summary and cafe list, drop the long sections. */
  compact?: boolean;
}) {
  const site = siteById(siteId);
  const f: Filters = { ...filters, siteId, cafeId: 'all' };
  const hasData = hasDataFor(filters.date);
  const rows = hasData ? cafeRows(f, state.issues) : [];
  const coverage = workflowCoverage(rows, planningRows(f, state.issues), f);
  const live = rows.filter((r) => r.applicable);
  const status = worstRowStatus(rows.map(rowStatus));
  const top = rows.flatMap((r) => r.openIssues).sort(bySeverity)[0];
  const changes = changesInScope(state.changes, f).slice(0, 5);
  const info = (
    <dl className="kv">
      <div><dt>Region</dt><dd>{site.region}</dd></div>
      <div><dt>Kitchen</dt><dd>{site.arrangement} — {site.kitchen}</dd></div>
      <div><dt>Service date</dt><dd>{serviceDateLabel(filters.date)} · {filters.meal === 'All' ? 'all meals' : filters.meal}</dd></div>
      <div><dt>Final order cutoff</dt><dd>{deadlineFor('finalOrder', siteId)}</dd></div>
    </dl>
  );

  return (
    <>
      <StatusBlock
        badge={hasData ? <StatusBadge status={ROW_STATUS[status].display} text={ROW_STATUS[status].label} /> : <StatusBadge status="unconfirmed" text="Data unavailable" />}
        lines={hasData && <span className="meta">{live.filter((r) => r.ready).length} of {live.length} cafes in service prep ready{rows.length > live.length && ` · ${rows.length - live.length} not in service`}</span>}
        next={top ? <><strong>Top blocker:</strong> {top.title} · {top.owner.name} · due {fmtDateTime(top.dueAt)}</> : hasData ? 'No open issues for this site in scope.' : undefined}
      />

      <Section title={`Cafes (${rows.length}, ${live.length} in service)`}>
        {hasData ? (
          <ul className="cafelist">
            {rows.map((r) => {
              const s = rowStatus(r);
              const b = rowBlocker(r);
              const on = selected === r.cafe.id;
              return (
                <li key={r.cafe.id}>
                  <button
                    type="button"
                    className={`cafelist__item${on ? ' is-selected' : ''}`}
                    data-target={`cafe:${r.cafe.id}`}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => onPush({ kind: 'cafe', id: r.cafe.id })}
                  >
                    <span className="cafelist__name">{r.cafe.name}</span>
                    <span className="cafelist__meta">
                      <StatusBadge status={ROW_STATUS[s].display} text={ROW_STATUS[s].label} compact />
                      <span className="cafelist__blocker" title={`${b.full}${b.owner !== '—' ? ` · ${b.owner}` : ''}`}>
                        {b.text}{b.more > 0 && ` +${b.more}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="meta">Data unavailable for this date in the demo.</p>
        )}
      </Section>

      {compact ? (
        <details className="dsec siteinfo">
          <summary>Site information</summary>
          {info}
        </details>
      ) : (
        <Section title="Site information">{info}</Section>
      )}

      {!compact && <>
      <Section title={`Daily progress · ${serviceDateLabel(filters.date)}`}>
        {hasData ? <StageRows coverage={coverage} period="day" label="Daily stage progress" /> : <p className="meta">Data unavailable for this date in the demo.</p>}
      </Section>
      <Section title={`Weekly planning · ${PROJECTION_WEEKS.find((w) => w.id === filters.weekId)?.label ?? filters.weekId}`}>
        <StageRows coverage={coverage} period="week" label="Weekly stage progress" />
      </Section>

      <Section title="Recent changes">
        <ChangeLinks changes={changes} onPush={onPush} />
      </Section>
      </>}
    </>
  );
}

function ChangeLinks({ changes, onPush }: { changes: Change[]; onPush: (t: DrawerTarget) => void }) {
  if (!changes.length) return <p className="muted">No recorded changes in scope.</p>;
  return (
    <ul className="links">
      {changes.map((c) => (
        <li key={c.id}>
          <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'change', id: c.id })}>
            {fmtDateTime(c.at)} · {cafeById(c.cafeId).name} · {c.dishId ? dishName(c.dishId) : c.record} {changeValue(c).prev} → {changeValue(c).next}
          </button>
        </li>
      ))}
    </ul>
  );
}

function IssueLinks({ issues, onPush, empty }: { issues: Issue[]; onPush: (t: DrawerTarget) => void; empty: string }) {
  if (!issues.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="links">
      {issues.map((i) => (
        <li key={i.id}>
          <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'issue', id: i.id })}>
            <SeverityBadge severity={i.severity} /> {i.short} · {i.owner.name} · due {fmtDateTime(i.dueAt)}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- weekly planning (one cafe, one projection week)

function PlanningDetail({ cafeId, filters, state, onPush }: { cafeId: string; filters: Filters; state: DemoState; onPush: (t: DrawerTarget) => void }) {
  const cafe = cafeById(cafeId);
  const pr = planningRows({ ...filters, siteId: cafe.siteId, cafeId }, state.issues)[0];
  const status = worst(PLANNING_STAGES.map((k) => pr.stages[k].status));
  const nextKey = PLANNING_STAGES.find((k) => pr.stages[k].status !== 'complete');
  const issues = state.issues.filter((i) => i.cafeId === cafeId && i.scope.kind === 'week' && i.scope.weekId === filters.weekId && i.status !== 'resolved').sort(bySeverity);
  const changes = state.changes.filter((c) => c.cafeId === cafeId && c.scope.kind === 'week' && c.scope.weekId === filters.weekId);

  return (
    <>
      <StatusBlock
        badge={<StatusBadge status={status} text={pr.record ? (status === 'complete' ? 'Weekly planning complete' : undefined) : 'Data unavailable'} />}
        lines={pr.record && <span className="meta">Projection: {pr.record.projectedTotal ? fmtQty(pr.record.projectedTotal) : 'not submitted'}</span>}
        next={nextKey && pr.record ? <><strong>Next:</strong> {STAGE_LABEL[nextKey]} — {pr.stages[nextKey].text} · owner role: {STAGE_OWNER_ROLE[nextKey]}{pr.stages[nextKey].rec?.dueAt && ` · due ${fmtDateTime(pr.stages[nextKey].rec!.dueAt!)}`}</> : undefined}
      />

      <Section title="Publication, selection and projection">
        <ul className="stagelist">
          {PLANNING_STAGES.map((k) => {
            const st = pr.stages[k];
            return (
              <li key={k} title={[STAGE_EXPLAIN[k], st.rec?.note].filter(Boolean).join(' — ')}>
                <span className="stagelist__k">{STAGE_LABEL[k]}</span>
                <StatusBadge status={st.status} text={st.text} compact />
                <span className="meta">
                  {st.rec?.doneAt ? `Done ${fmtDateTime(st.rec.doneAt)}` : st.rec?.dueAt ? `Due ${fmtDateTime(st.rec.dueAt)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
        {PLANNING_STAGES.some((k) => pr.stages[k].rec?.note) && (
          <ul className="bullets small">
            {PLANNING_STAGES.filter((k) => pr.stages[k].rec?.note).map((k) => <li key={k}><strong>{STAGE_SHORT_LABEL(k)}:</strong> {pr.stages[k].rec!.note}</li>)}
          </ul>
        )}
      </Section>

      <dl className="kv">
        <div><dt>Menu publication rule</dt><dd>{deadlineFor('menuPublication', cafe.siteId)}</dd></div>
        <div><dt>Projection cutoff</dt><dd>{deadlineFor('weeklyProjection', cafe.siteId)}</dd></div>
        <div><dt>Projected total</dt><dd>{pr.record?.projectedTotal ? fmtQty(pr.record.projectedTotal) : 'Not submitted'}</dd></div>
        <div><dt>Daily orders</dt><dd>Final orders (<Term k="MR" />) are separate and never overwrite this projection.</dd></div>
      </dl>

      <Section title="Related issues">
        <IssueLinks issues={issues} onPush={onPush} empty="No open issues for this cafe in this projection week." />
      </Section>
      <Section title="Weekly changes">
        <ChangeLinks changes={changes} onPush={onPush} />
      </Section>
      <div className="btn-row">
        <button type="button" className="btn btn--sm" onClick={() => onPush({ kind: 'cafe', id: cafeId })}>
          Daily progress for {serviceDateLabel(filters.date)} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

const STAGE_SHORT_LABEL = (k: StageKey) => STAGE_LABEL[k];

// ---------------------------------------------------------------- stage summary (coverage across cafes in scope)

function StageDetail({ k, filters, state, onPush, onFilterStage }: {
  k: StageKey; filters: Filters; state: DemoState; onPush: (t: DrawerTarget) => void; onFilterStage: (k: StageKey) => void;
}) {
  const weekly = (PLANNING_STAGES as StageKey[]).includes(k);
  const hasData = hasDataFor(filters.date);
  const rows = hasData ? cafeRows(filters, state.issues) : [];
  const plan = planningRows(filters, state.issues);
  const cov = workflowCoverage(rows, plan, filters).find((c) => c.key === k)!;
  const breakdown = stageBreakdown(cov);
  const affected = weekly
    ? plan.filter((p) => p.stages[k as keyof typeof p.stages].status !== 'complete').map((p) => ({ cafe: p.cafe, site: p.site, cell: p.stages[k as keyof typeof p.stages] }))
    : rows.filter((r) => r.applicable && r.stages[k as keyof typeof r.stages].status !== 'complete').map((r) => ({ cafe: r.cafe, site: r.site, cell: r.stages[k as keyof typeof r.stages] }));
  const notInService = weekly ? 0 : rows.filter((r) => !r.applicable).length;
  const ck = CUTOFF_KEY[k];
  const sites = filters.siteId === 'all' ? SITES : [siteById(filters.siteId)];
  const required = (REQUIRED_STAGES as StageKey[]).includes(k);

  return (
    <>
      <StatusBlock
        badge={cov.total ? <StatusBadge status={cov.status} /> : <StatusBadge status={!weekly && !hasData ? 'unconfirmed' : 'not_applicable'} text={!weekly && !hasData ? 'Data unavailable' : undefined} />}
        lines={<span className="meta">{cov.total ? `${cov.complete} of ${cov.total} ${weekly ? 'cafes' : 'cafes in service'} complete` : 'No cafes in scope'}{breakdown && ` · ${breakdown}`}{notInService > 0 && ` · ${notInService} not in service (excluded)`}</span>}
        next={<>{STAGE_EXPLAIN[k]} Owner role: {STAGE_OWNER_ROLE[k]}.{!weekly && !required && ' Not included in preparation readiness, but still operationally important.'}</>}
      >
        {affected.length > 0 && (
          <div className="btn-row">
            <button type="button" className="btn btn--sm" onClick={() => onFilterStage(k)}>
              Show {affected.length} incomplete {affected.length === 1 ? 'cafe' : 'cafes'} in {weekly ? 'planning' : 'overview'} table <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </StatusBlock>

      <Section title="Deadline rules">
        {ck ? (
          <ul className="rules">
            {sites.map((s) => (
              <li key={s.id}>
                <span className="rules__head">{s.name} <ProvenanceTag p={s.cutoffs[ck].provenance} /></span>
                <span>{k === 'menuSelection' ? 'Before projection: ' : ''}{s.cutoffs[ck].rule}</span>
                {s.cutoffs[ck].note && <span className="small muted">{s.cutoffs[ck].note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">Per meal service time. No cutoff rule is recorded; actual dispatch is shown only when confirmed.</p>
        )}
      </Section>

      <Section title={`Affected cafes (${affected.length})`}>
        {affected.length ? (
          <ul className="stagelist">
            {affected.map(({ cafe, site, cell }) => (
              <li key={cafe.id} title={'note' in cell && cell.note ? cell.note : undefined}>
                <button type="button" className="link strong stagelist__k" onClick={() => onPush({ kind: weekly ? 'planning' : 'cafe', id: cafe.id })}>
                  {cafe.name} <span className="meta">· {site.name}</span>
                </button>
                <StatusBadge status={cell.status} text={cell.text} compact />
                <span className="meta">{'dueAt' in cell && cell.dueAt ? `Due ${fmtDateTime(cell.dueAt)}` : 'rec' in cell && cell.rec?.dueAt ? `Due ${fmtDateTime(cell.rec.dueAt)}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{cov.total ? 'Complete for every cafe in scope.' : 'Nothing to show for this scope.'}</p>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- cutoff rule across sites

function CutoffDetail({ k }: { k: keyof Site['cutoffs'] }) {
  const stages = (Object.keys(CUTOFF_KEY) as StageKey[]).filter((s) => CUTOFF_KEY[s] === k);
  return (
    <>
      <StatusBlock
        badge={<span className="tag">Applies to: {stages.map((s) => STAGE_LABEL[s]).join(', ')}</span>}
        next="Existing = shown in the playbook walkthroughs. Needs verification = demo assumption. Proposed = suggested dashboard rule. None of these is enforced by this prototype."
      />
      <ul className="rules">
        {SITES.map((s) => (
          <li key={s.id}>
            <span className="rules__head">{s.name} <ProvenanceTag p={s.cutoffs[k].provenance} /></span>
            <span>{s.cutoffs[k].rule}</span>
            <span className="small muted">{s.cutoffs[k].note ?? 'No verification note recorded.'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- issue

function IssueDetail({ issue, state, dispatch, onPush, notify }: {
  issue: Issue; state: DemoState; dispatch: (a: Action) => void; onPush: (t: DrawerTarget) => void; notify: (m: string) => void;
}) {
  const [note, setNote] = useState('');
  const [closure, setClosure] = useState('');
  const [resolving, setResolving] = useState(false);
  const related = state.changes.filter((c) => issue.relatedChangeIds.includes(c.id));
  const relIssues = state.issues.filter((i) => issue.relatedIssueIds.includes(i.id));
  const done = issue.status === 'resolved';

  return (
    <>
      <div className="badges">
        <SeverityBadge severity={issue.severity} />
        <IssueStatusBadge status={issue.status} />
        {issue.acknowledged && <span className="tag">Acknowledged {fmtDateTime(issue.acknowledged.at)} · still {issue.status === 'resolved' ? 'resolved' : 'open'}</span>}
      </div>
      <StatusBlock
        badge={<span className="strong">{done ? 'Closure note' : 'Next action'}</span>}
        lines={!done && <span className="meta">{issue.owner.name} · due {fmtDateTime(issue.dueAt)} ({relativeToNow(issue.dueAt)})</span>}
        next={done ? issue.closureNote : issue.nextAction}
      />
      <dl className="kv">
        <div><dt>Scope</dt><dd>{scopeText(issue.scope, issue.siteId, issue.cafeId)}</dd></div>
        <div><dt>Stage</dt><dd>{STAGE_LABEL[issue.stage]}</dd></div>
        <div><dt>Owner</dt><dd>{issue.owner.name} <span className="muted">· {issue.owner.role}</span></dd></div>
        <div><dt>Due</dt><dd>{fmtDateTime(issue.dueAt)} <span className="muted">({relativeToNow(issue.dueAt)})</span></dd></div>
        {issue.expectedAt && <div><dt>Expected</dt><dd>{fmtDateTime(issue.expectedAt)}</dd></div>}
        <div><dt>Actual</dt><dd>{issue.actualAt ? fmtDateTime(issue.actualAt) : issue.expectedAt ? <span className="warn">Not recorded</span> : '—'}</dd></div>
        <div><dt>Detection</dt><dd><ProvenanceTag p={issue.detection.provenance} /> {issue.detection.text}</dd></div>
      </dl>

      {issue.beforeAfter && (
        <div className="beforeafter" aria-label="Before and after">
          <span className="small muted">{issue.beforeAfter.label}</span>
          <div className="beforeafter__row">
            <span className="ba ba--before"><span className="tiny">Before</span>{issue.beforeAfter.before}</span>
            <span aria-hidden="true">→</span>
            <span className="ba ba--after"><span className="tiny">After</span>{issue.beforeAfter.after}</span>
          </div>
        </div>
      )}

      <Section title="What happened"><p>{issue.whatHappened}</p></Section>
      <Section title="Impact"><p>{issue.impact}</p></Section>

      {issue.ingredientImpact && (
        <Section title="Ingredient impact (recipe ratio)">
          <IngredientTable dishId={issue.ingredientImpact.dishId} delta={issue.ingredientImpact.delta} />
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Related changes & team acknowledgments">
          {related.map((c) => (
            <ChangeAcks key={c.id} change={c} dispatch={dispatch} notify={notify} onOpen={() => onPush({ kind: 'change', id: c.id })} />
          ))}
        </Section>
      )}

      {relIssues.length > 0 && (
        <Section title="Related issues">
          <ul className="links">
            {relIssues.map((i) => (
              <li key={i.id}>
                <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'issue', id: i.id })}>
                  <SeverityBadge severity={i.severity} /> {i.title}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Evidence">
        <ul className="evidence">
          {issue.evidence.map((e) => (
            <li key={e.label}>
              <span className="strong">{e.label}</span>
              <AvailabilityBadge a={e.availability} />
              <span className="small muted">{e.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Timeline">
        <ol className="timeline">
          {[...issue.timeline, ...issue.notes.map((n) => ({ ...n, text: `Note: ${n.text}` }))]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((t, i) => (
              <li key={i}>
                <span className="tiny muted">{fmtDateTime(t.at)} · {t.by}{t.local && ' · local demo action'}</span>
                <span>{t.text}</span>
              </li>
            ))}
        </ol>
      </Section>

      <Section title="Actions">
        <LocalNote />
        <div className="actions">
          <label className="field">
            <span>Owner</span>
            <select
              value={issue.owner.name}
              disabled={done}
              onChange={(e) => {
                const p = ASSIGNABLE.find((x) => x.name === e.target.value)!;
                dispatch({ type: 'assign', issueId: issue.id, owner: p });
                notify(`Owner set to ${p.name} (local demo — no notification sent).`);
              }}
            >
              {!ASSIGNABLE.some((p) => p.name === issue.owner.name) && <option>{issue.owner.name}</option>}
              {ASSIGNABLE.map((p) => (
                <option key={p.name} value={p.name}>{p.name} — {p.role}</option>
              ))}
            </select>
          </label>

          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              dispatch({ type: 'note', issueId: issue.id, text: note.trim() });
              setNote('');
              notify('Note added (local demo).');
            }}
          >
            <label htmlFor={`note-${issue.id}`}>Add note</label>
            <div className="input-row">
              <input id={`note-${issue.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called the unit manager" />
              <button type="submit" className="btn" disabled={!note.trim()}>
                <MessageSquarePlus size={15} aria-hidden="true" /> Add
              </button>
            </div>
          </form>

          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={done || !!issue.acknowledged}
              onClick={() => {
                dispatch({ type: 'acknowledgeIssue', issueId: issue.id });
                notify('Acknowledged. The issue stays open until it is resolved.');
              }}
            >
              <Check size={15} aria-hidden="true" /> {issue.acknowledged ? 'Acknowledged' : 'Acknowledge'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={issue.status !== 'open'}
              onClick={() => {
                dispatch({ type: 'startProgress', issueId: issue.id });
                notify('Moved to In progress (local demo).');
              }}
            >
              <Play size={15} aria-hidden="true" /> Move to In progress
            </button>
            {done ? (
              <button type="button" className="btn" onClick={() => { dispatch({ type: 'reopen', issueId: issue.id }); notify('Issue reopened (local demo).'); }}>
                Reopen
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setResolving(true)} disabled={resolving}>
                Resolve…
              </button>
            )}
          </div>

          {resolving && !done && (
            <form
              className="field resolve"
              onSubmit={(e) => {
                e.preventDefault();
                if (!closure.trim()) return;
                dispatch({ type: 'resolve', issueId: issue.id, closureNote: closure.trim() });
                setResolving(false);
                notify('Issue resolved with closure note (local demo).');
              }}
            >
              <label htmlFor={`closure-${issue.id}`}>Closure note (required)</label>
              <textarea id={`closure-${issue.id}`} rows={3} value={closure} onChange={(e) => setClosure(e.target.value)} placeholder="What was done and who confirmed it" autoFocus />
              <div className="btn-row">
                <button type="submit" className="btn btn--primary" disabled={!closure.trim()}>Resolve issue</button>
                <button type="button" className="btn" onClick={() => setResolving(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}

function IngredientTable({ dishId, delta }: { dishId: string; delta: Quantity }) {
  const est = estimateIngredients(dishId, delta);
  return (
    <>
      <p className="small">
        {dishName(dishId)}: {delta.value > 0 ? '+' : ''}{fmtQty(delta)} finished food. Finished weight is not raw weight — each ingredient is scaled from the recipe.
      </p>
      {!est.complete ? (
        <StatusBadge status="blocked" text={est.reason} />
      ) : (
        <>
          <table className="table table--compact">
            <thead>
              <tr><th scope="col">Ingredient (<Term k="MOG" />)</th><th scope="col">Estimated raw qty</th><th scope="col">Purchase article</th></tr>
            </thead>
            <tbody>
              {est.lines.map((l) => (
                <tr key={l.mogName}>
                  <th scope="row">{l.mogName}</th>
                  <td>{fmtQty(l.qty)}</td>
                  <td>{l.articleCode ?? <span className="warn">Mapping missing</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!est.costComplete && <p className="small warn">Cost incomplete (not zero) — at least one ingredient has no article mapping.</p>}
        </>
      )}
    </>
  );
}

function ChangeAcks({ change, dispatch, notify, onOpen }: { change: Change; dispatch: (a: Action) => void; notify: (m: string) => void; onOpen?: () => void }) {
  const v = changeValue(change);
  return (
    <div className="ackbox">
      {onOpen && (
        <button type="button" className="btn btn--link" onClick={onOpen}>
          {change.id}: {change.dishId ? dishName(change.dishId) : change.record} {v.prev} → {v.next}
        </button>
      )}
      {change.acknowledgments.length ? (
        <ul className="acks">
          {change.acknowledgments.map((a) => (
            <li key={a.team + a.detail}>
              <span>
                {a.team}{a.detail && <span className="muted"> · {a.detail}</span>}
              </span>
              {a.state === 'acknowledged' ? (
                <StatusBadge status="complete" text={`Acknowledged ${a.at ? fmtDateTime(a.at) : ''}${a.by ? ` by ${a.by}` : ''}`} compact />
              ) : (
                <span className="ack-pending">
                  <StatusBadge status="review" text="Pending" compact />
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      dispatch({ type: 'acknowledgeChange', changeId: change.id, team: a.team, detail: a.detail });
                      notify(`Recorded acknowledgment for ${a.detail ?? a.team} (local demo).`);
                    }}
                  >
                    Record acknowledgment
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">No acknowledgment requested for this change.</p>
      )}
      <p className="tiny muted">Acknowledgment tracking is a proposed feature <ProvenanceTag p="proposed" /></p>
    </div>
  );
}

// ---------------------------------------------------------------- change

function ChangeDetail({ change, state, dispatch, onPush, notify }: {
  change: Change; state: DemoState; dispatch: (a: Action) => void; onPush: (t: DrawerTarget) => void; notify: (m: string) => void;
}) {
  const [reason, setReason] = useState('');
  const v = changeValue(change);
  const ack = ackSummary(change);
  const unusual = isUnusualChange(change, state.settings);
  const issue = state.issues.find((i) => i.id === change.relatedIssueId);
  const delta =
    change.previous && change.next && change.previous.unit === change.next.unit && change.dishId
      ? { value: change.next.value - change.previous.value, unit: change.next.unit }
      : undefined;

  return (
    <>
      <div className="badges">
        <span className="tag">{change.record}</span>
        {change.late && <span className="tag tag--review">Late — after {change.lateAfter}</span>}
        {unusual && <span className="tag tag--review">Unusual (demo check)</span>}
        <StatusBadge status={ack.done ? 'complete' : 'review'} text={ack.text} compact />
      </div>
      <dl className="kv">
        <div><dt>Where</dt><dd>{siteById(change.siteId).name} · {cafeById(change.cafeId).name}</dd></div>
        <div><dt>Scope</dt><dd>{scopeText(change.scope, change.siteId, change.cafeId).split(' · ').slice(2).join(' · ')}</dd></div>
        {change.dishId && <div><dt>Dish / portion</dt><dd>{dishName(change.dishId)}{change.portion && ` · ${change.portion}`}</dd></div>}
        <div><dt>Changed by</dt><dd>{change.by.name} <span className="muted">· {change.by.role}</span></dd></div>
        <div><dt>When</dt><dd>{fmtDateTime(change.at)} <span className="muted">({relativeToNow(change.at)})</span></dd></div>
        <div><dt>Reason</dt><dd>{change.reason ?? <span className="warn">Reason not recorded</span>}</dd></div>
      </dl>

      <div className="beforeafter">
        <span className="small muted">{change.kind}</span>
        <div className="beforeafter__row">
          <span className="ba ba--before"><span className="tiny">Previous</span>{v.prev}</span>
          <span aria-hidden="true">→</span>
          <span className="ba ba--after"><span className="tiny">New</span>{v.next}</span>
        </div>
        {change.record === 'Final daily order (MR)' && (
          <p className="tiny muted">This is the daily order. The weekly projection record is kept separately and is not overwritten.</p>
        )}
        {unusual && (
          <p className="tiny muted">
            Flagged by the proposed demo check (≥{state.settings.unusualChangePercent}% and ≥{state.settings.unusualChangeMinKg} kg). Not an agreed tolerance.
          </p>
        )}
      </div>

      <Section title="Affected steps">
        <ul className="bullets">{change.affectedSteps.map((s) => <li key={s}>{s}</li>)}</ul>
      </Section>

      {delta && delta.unit === 'kg' && delta.value !== 0 && (
        <Section title="Ingredient impact (recipe ratio)">
          <IngredientTable dishId={change.dishId!} delta={delta} />
        </Section>
      )}

      <Section title="Team acknowledgments">
        <ChangeAcks change={change} dispatch={dispatch} notify={notify} />
      </Section>

      {issue && (
        <Section title="Related issue">
          <button type="button" className="btn btn--link" onClick={() => onPush({ kind: 'issue', id: issue.id })}>
            <SeverityBadge severity={issue.severity} /> {issue.title} · <IssueStatusBadge status={issue.status} />
          </button>
        </Section>
      )}

      {!change.reason && (
        <Section title="Record reason">
          <LocalNote />
          <form
            className="input-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) return;
              dispatch({ type: 'recordReason', changeId: change.id, reason: reason.trim() });
              notify('Reason recorded (local demo).');
            }}
          >
            <label htmlFor={`reason-${change.id}`} className="sr-only">Reason for change</label>
            <input id={`reason-${change.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Training batch of 300 confirmed by client" />
            <button type="submit" className="btn btn--primary" disabled={!reason.trim()}>Save reason</button>
          </form>
        </Section>
      )}
    </>
  );
}
