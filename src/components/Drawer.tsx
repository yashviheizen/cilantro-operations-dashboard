import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Check, MessageSquarePlus, Play, X } from 'lucide-react';
import { fmtDateTime, relativeToNow, serviceDateLabel } from '../data/clock';
import { DATA_SOURCES, DISHES, PROJECTION_WEEKS } from '../data/masters';
import { ASSIGNABLE, WEEKLY_PLANNING } from '../data/operations';
import {
  cafeById, cafeRows, DAILY_STAGES, fmtQty, hasDataFor, isUnusualChange, PLANNING_STAGES, planningRows, siteById, STAGE_EXPLAIN, STAGE_LABEL,
  stageStatus, stageText, resolvedSet, workflowCoverage, rowStatus, rowBlocker, ROW_STATUS, REQUIRED_STAGES, deadlineFor,
} from '../lib/derive';
import type { CafeRow, Filters } from '../lib/derive';
import { estimateIngredients } from '../lib/ingredients';
import type { Action, DemoState } from '../lib/store';
import type { Change, Issue, Quantity } from '../data/types';
import { AvailabilityBadge, EmptyState, IssueStatusBadge, ProvenanceTag, SeverityBadge, StatusBadge, Term } from './ui';
import { ackSummary, changeValue, dishName, scopeText, StageRows } from './Lists';

export type DrawerTarget = { kind: 'site' | 'cafe' | 'issue' | 'change' | 'source'; id: string };

interface Props {
  stack: DrawerTarget[];
  onPush: (t: DrawerTarget) => void;
  onBack: () => void;
  onClose: () => void;
  state: DemoState;
  dispatch: (a: Action) => void;
  filters: Filters;
  row?: CafeRow;
  notify: (msg: string) => void;
}

export function Drawer({ stack, onPush, onBack, onClose, state, dispatch, filters, row, notify }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const top = stack[stack.length - 1];

  useEffect(() => {
    closeBtn.current?.focus();
    panel.current?.scrollTo({ top: 0 });
  }, [top?.kind, top?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
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
  }, [onClose]);

  if (!top) return null;
  const issue = top.kind === 'issue' ? state.issues.find((i) => i.id === top.id) : undefined;
  const change = top.kind === 'change' ? state.changes.find((c) => c.id === top.id) : undefined;
  const site = top.kind === 'site' ? siteById(top.id) : undefined;
  const source = top.kind === 'source' ? DATA_SOURCES.find((d) => d.id === top.id) : undefined;
  const title = source?.name ?? issue?.title ?? (change ? change.kind : site ? site.name : row ? row.cafe.name : 'Details');
  const kindLabel = top.kind === 'source' ? 'Data source · demo snapshot' : top.kind === 'site' ? 'Site' : top.kind === 'cafe' ? `Cafe · ${row?.site.name ?? ''}` : top.kind === 'issue' ? `Issue ${top.id}` : `Change ${top.id}`;

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={panel}>
        <div className="drawer__head">
          {stack.length > 1 && (
            <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to previous detail">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <div className="drawer__titles">
            <span className="drawer__kind">{kindLabel}</span>
            <h2 id="drawer-title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} ref={closeBtn} aria-label="Close details (Escape)">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="drawer__body">
          {source && <>
            <dl className="kv">
              <div><dt>Availability</dt><dd><AvailabilityBadge a={source.availability} /></dd></div>
              <div><dt>Last updated</dt><dd>{source.lastUpdated ? fmtDateTime(source.lastUpdated) : 'Not available'}</dd></div>
              <div><dt>Scope</dt><dd>Shared demo source information across all sites</dd></div>
            </dl>
            <Section title="What this source provides"><p>{source.note}</p></Section>
            <Section title="How to read this status"><p>Availability describes this demo snapshot. It does not confirm a live integration or physical completion. Missing evidence remains unavailable.</p></Section>
          </>}

          {site && <SiteDetail siteId={site.id} filters={filters} state={state} onPush={onPush} />}
          {top.kind === 'cafe' && row && <CafeDetail row={row} filters={filters} state={state} onPush={onPush} />}
          {issue && <IssueDetail key={issue.id} issue={issue} state={state} dispatch={dispatch} onPush={onPush} notify={notify} />}
          {change && <ChangeDetail key={change.id} change={change} state={state} dispatch={dispatch} onPush={onPush} notify={notify} />}
          {!source && !issue && !change && !site && !(top.kind === 'cafe' && row) && <EmptyState title="Details unavailable" />}
        </div>
      </div>
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

  return (
    <>
      <dl className="kv">
        <div><dt>Site</dt><dd>{row.site.name} · {row.site.region}</dd></div>
        <div><dt>Kitchen</dt><dd>{row.site.arrangement} — {row.site.kitchen}</dd></div>
        <div><dt>Service date</dt><dd>{serviceDateLabel(filters.date)}</dd></div>
        <div><dt>Meals</dt><dd>{row.applicable ? row.meals.join(', ') : `Not applicable — ${row.naReason}`}</dd></div>
        <div><dt>Readiness</dt><dd>{!row.applicable ? <StatusBadge status="not_applicable" /> : row.ready ? <StatusBadge status="complete" text="Ready" /> : <StatusBadge status="pending" text="Not ready" />}</dd></div>
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
                  <span className="stagelist__k">
                    {STAGE_LABEL[k]}
                    {!REQUIRED_STAGES.includes(k) && <span className="meta"> · not required</span>}
                  </span>
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

      <Section title={`Weekly stages · ${PROJECTION_WEEKS.find((w) => w.id === filters.weekId)?.label ?? filters.weekId}`}>
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

      <Section title="Changes">
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

function SiteDetail({ siteId, filters, state, onPush }: { siteId: string; filters: Filters; state: DemoState; onPush: (t: DrawerTarget) => void }) {
  const site = siteById(siteId);
  const f: Filters = { ...filters, siteId, cafeId: 'all' };
  const hasData = hasDataFor(filters.date);
  const rows = hasData ? cafeRows(f, state.issues) : [];
  const coverage = workflowCoverage(rows, planningRows(f, state.issues), f);
  const live = rows.filter((r) => r.applicable);

  return (
    <>
      <dl className="kv">
        <div><dt>Region</dt><dd>{site.region}</dd></div>
        <div><dt>Kitchen</dt><dd>{site.arrangement} — {site.kitchen}</dd></div>
        <div><dt>Service date</dt><dd>{serviceDateLabel(filters.date)} · {filters.meal === 'All' ? 'all meals' : filters.meal}</dd></div>
        <div><dt>Ready</dt><dd>{hasData ? `${live.filter((r) => r.ready).length} of ${live.length} cafes in service` : 'Data unavailable'}</dd></div>
        <div><dt>Final order cutoff</dt><dd>{deadlineFor('finalOrder', siteId)}</dd></div>
      </dl>

      <Section title="Cafes">
        {hasData ? (
          <ul className="stagelist">
            {rows.map((r) => {
              const s = rowStatus(r);
              const b = rowBlocker(r);
              return (
                <li key={r.cafe.id}>
                  <button type="button" className="link strong stagelist__k" onClick={() => onPush({ kind: 'cafe', id: r.cafe.id })}>{r.cafe.name}</button>
                  <StatusBadge status={ROW_STATUS[s].display} text={ROW_STATUS[s].label} compact />
                  <span className="meta" title={b.full}>{b.text}{b.more > 0 && ` +${b.more}`}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="meta">Data unavailable for this date in the demo.</p>
        )}
      </Section>

      <Section title={`Daily stages · ${serviceDateLabel(filters.date)}`}>
        {hasData ? <StageRows coverage={coverage} period="day" label="Daily stage progress" /> : <p className="meta">Data unavailable for this date in the demo.</p>}
      </Section>
      <Section title={`Weekly stages · ${PROJECTION_WEEKS.find((w) => w.id === filters.weekId)?.label ?? filters.weekId}`}>
        <StageRows coverage={coverage} period="week" label="Weekly stage progress" />
      </Section>
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
        {issue.acknowledged && <span className="tag">Acknowledged {fmtDateTime(issue.acknowledged.at)}</span>}
      </div>
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
      <Section title={done ? 'Closure note' : 'Next action'}><p>{done ? issue.closureNote : issue.nextAction}</p></Section>

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
