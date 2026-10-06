import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { TOMORROW, serviceDateLabel } from './data/clock';
import { CAFES, PROJECTION_WEEKS } from './data/masters';
import { SettingsMenu, Sidebar, TopBar, VIEWS } from './components/Shell';
import type { View } from './components/Shell';
import { ScopeBar, SummaryCards } from './components/Overview';
import type { CardKey } from './components/Overview';
import { StatusTable, QUICK_LABEL, filterRows } from './components/StatusTable';
import type { QuickFilter } from './components/StatusTable';
import {
  ChangeFilterBar, ChangeLogTable, ChangesPreview, DEFAULT_ISSUE_FILTER, filterChanges, filterIssues, IssueFilters, IssueRows, NoIssues, PlanningTable, StageRows,
} from './components/Lists';
import type { ChangeFilter, IssueFilter } from './components/Lists';
import { DataStatus } from './components/DataStatus';
import { Drawer } from './components/Drawer';
import type { DrawerTarget } from './components/Drawer';
import { EmptyState } from './components/ui';
import {
  buildCafeRow, cafeRows, changesInScope, hasDataFor, isOpen, issuesInScope, planningRows, summarize, workflowCoverage,
} from './lib/derive';
import type { CafeRow, DailyStage, Filters, PlanningStage } from './lib/derive';
import { downloadCsv, rowsToCsv } from './lib/csv';
import { hasLocalChanges, useDemoStore } from './lib/store';
import type { StageKey } from './data/types';

const VIEW_KEYS = VIEWS.map((v) => v.key);
const viewFromHash = (): View => {
  const h = window.location.hash.replace('#', '') as View;
  return VIEW_KEYS.includes(h) ? h : 'overview';
};
const readCollapsed = () => {
  try {
    return localStorage.getItem('cilantro-sidebar-collapsed') === '1';
  } catch {
    return false;
  }
};
const isPlanningStage = (k: StageKey | null): k is PlanningStage => k === 'menuPublication' || k === 'menuSelection' || k === 'weeklyProjection';

export default function App() {
  const [state, dispatch] = useDemoStore();
  const [view, setView] = useState<View>(viewFromHash);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileNav, setMobileNav] = useState(false);
  const [filters, setFilters] = useState<Filters>({ siteId: 'all', cafeId: 'all', date: TOMORROW, meal: 'All', weekId: '2026-W43' });
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [dailyStage, setDailyStage] = useState<DailyStage | null>(null);
  const [planStage, setPlanStage] = useState<PlanningStage | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>(DEFAULT_ISSUE_FILTER);
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [drawer, setDrawer] = useState<DrawerTarget[]>([]);
  const [toast, setToast] = useState('');
  const opener = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewChanged = useRef(false);

  const hasData = hasDataFor(filters.date);
  const rows = useMemo(() => (hasData ? cafeRows(filters, state.issues) : []), [filters, state.issues, hasData]);
  const planning = useMemo(() => planningRows(filters, state.issues), [filters, state.issues]);
  const issues = useMemo(() => issuesInScope(state.issues, filters), [state.issues, filters]);
  const changes = useMemo(() => changesInScope(state.changes, filters), [state.changes, filters]);
  const summary = useMemo(() => summarize(rows, state.issues, state.changes, filters), [rows, state.issues, state.changes, filters]);
  const coverage = useMemo(() => workflowCoverage(rows, planning, filters), [rows, planning, filters]);
  const openIssues = issues.filter(isOpen);

  // Keep the view in the URL hash so reload / back return to the same screen.
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== view) history.replaceState(null, '', `#${view}`);
    if (viewChanged.current) {
      window.scrollTo({ top: 0 });
      heading.current?.focus();
    }
  }, [view]);

  const go = (v: View) => {
    viewChanged.current = true;
    setView(v);
    setMobileNav(false);
  };

  const onCollapse = (c: boolean) => {
    setCollapsed(c);
    try {
      localStorage.setItem('cilantro-sidebar-collapsed', c ? '1' : '0');
    } catch {
      /* per-viewer convenience only */
    }
  };

  const notify = useCallback((m: string) => {
    setToast('');
    requestAnimationFrame(() => setToast(m));
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 6000);
  }, []);

  const changeFilters = (f: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...f }));

  // Row clicks and their view buttons both land here; one drawer at a time, focus returns to the row's view button.
  const openDrawer = (t: DrawerTarget, from?: HTMLElement | null) => {
    const top = drawer[drawer.length - 1];
    if (top && top.kind === t.kind && top.id === t.id && drawer.length === 1) return;
    opener.current = from ?? (document.activeElement as HTMLElement);
    setDrawer([t]);
  };
  const closeDrawer = useCallback(() => {
    setDrawer([]);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }, []);
  /** Close after a drawer action that moves the user elsewhere — no focus return to the old row. */
  const leaveDrawer = () => { opener.current = null; setDrawer([]); };
  /** Breadcrumb "All sites": back to the site summary table, keeping date and meal. */
  const allSites = () => {
    changeFilters({ siteId: 'all', cafeId: 'all' });
    setQuick('all');
    setSearch('');
    setDailyStage(null);
    requestAnimationFrame(() => document.getElementById('table-title')?.focus({ preventScroll: true }));
  };
  /** Site → cafe opens beside the site panel; deeper details replace the right panel instead of chaining. */
  const pushDrawer = (t: DrawerTarget) =>
    setDrawer((d) => {
      if (d[0]?.kind === 'site' && t.kind === 'cafe') {
        const cafe = CAFES.find((c) => c.id === t.id)!;
        return [d[0].id === cafe.siteId ? d[0] : { kind: 'site', id: cafe.siteId }, t];
      }
      return d.length >= 3 ? [...d.slice(0, 2), t] : [...d, t];
    });
  const closeMobileNav = useCallback(() => setMobileNav(false), []);

  const activeCard: CardKey | null = quick === 'not_ready' ? 'ready' : quick === 'order_pending' ? 'orders' : null;
  const scrollToTable = () => requestAnimationFrame(() => document.getElementById('status-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  const onCard = (k: CardKey) => {
    if (k === 'ready' || k === 'orders') {
      const q: QuickFilter = k === 'ready' ? 'not_ready' : 'order_pending';
      setQuick(quick === q ? 'all' : q);
      setDailyStage(null);
      if (quick !== q) scrollToTable();
    }
    if (k === 'critical') {
      setIssueFilter({ ...DEFAULT_ISSUE_FILTER, severity: 'critical' });
      go('exceptions');
    }
    if (k === 'late') {
      setChangeFilter('late_unacked');
      go('changes');
    }
  };

  const topDrawer = drawer[drawer.length - 1];
  let drawerRow: CafeRow | undefined;
  if (topDrawer?.kind === 'cafe') drawerRow = buildCafeRow(CAFES.find((c) => c.id === topDrawer.id)!, filters, state.issues);

  const title = VIEWS.find((v) => v.key === view)!.label;
  const shownIssues = filterIssues(issues, issueFilter);
  const shownChanges = filterChanges(changes, changeFilter, state.settings);
  const ingredientLines = summary.ingredientLines;
  const week = PROJECTION_WEEKS.find((w) => w.id === filters.weekId)!;
  const noData = (
    <section className="panel">
      <EmptyState title="Data unavailable for this date in the demo">
        The demo snapshot covers {serviceDateLabel('2026-10-13')} and {serviceDateLabel('2026-10-14')}. Nothing is shown as complete or missing for other dates.
      </EmptyState>
    </section>
  );

  return (
    <div className={`app${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip" href="#main">Skip to content</a>
      <Sidebar
        view={view}
        onView={go}
        counts={{ exceptions: openIssues.length, changes: summary.lateAwaitingAck }}
        collapsed={collapsed}
        onCollapse={onCollapse}
        mobileOpen={mobileNav}
        onMobileClose={closeMobileNav}
        settings={
          <SettingsMenu
            settings={state.settings}
            onSettings={(s) => dispatch({ type: 'settings', settings: s })}
            onReset={() => { dispatch({ type: 'reset' }); setDrawer([]); notify('Demo data reset to the original snapshot.'); }}
            dirty={hasLocalChanges(state)}
            collapsed={collapsed}
          />
        }
      />

      <div className="content">
        <TopBar title={title} filters={filters} onChange={changeFilters} onMenu={() => setMobileNav(true)} headingRef={heading} />

        <main id="main" className="main">
          {view === 'overview' && (
            hasData ? (
              <>
                {filters.siteId !== 'all' && (
                  <ScopeBar filters={filters} onAllSites={allSites} onSite={(siteId) => changeFilters({ siteId, cafeId: 'all' })} />
                )}
                <SummaryCards s={summary} active={activeCard} onSelect={onCard} />
                <StatusTable
                  rows={rows}
                  filters={filters}
                  quick={quick}
                  onQuick={setQuick}
                  stage={dailyStage}
                  onClearStage={() => setDailyStage(null)}
                  onOpenCafe={(id, from) => openDrawer({ kind: 'cafe', id }, from)}
                  onOpenSite={(id, from) => openDrawer({ kind: 'site', id }, from)}
                  search={search}
                  onSearch={setSearch}
                  onExport={(visible, search) => {
                    const name = downloadCsv(rowsToCsv(visible, filters, QUICK_LABEL[quick], search), filters);
                    notify(`Exported ${visible.length} ${visible.length === 1 ? 'row' : 'rows'} to ${name}.`);
                  }}
                />
                <div className="cols cols--overview">
                  <section className="panel" aria-labelledby="top-title">
                    <div className="panel__head">
                      <h2 id="top-title">Priority issues</h2>
                      <span className="meta">Top {Math.min(5, openIssues.length)} of {openIssues.length} open · by severity, then due</span>
                      <div className="panel__tools">
                        <button type="button" className="btn btn--sm" onClick={() => { setIssueFilter(DEFAULT_ISSUE_FILTER); go('exceptions'); }}>
                          View all exceptions <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {openIssues.length ? (
                      <IssueRows issues={filterIssues(openIssues, DEFAULT_ISSUE_FILTER).slice(0, 5)} onOpen={(id, from) => openDrawer({ kind: 'issue', id }, from)} label="Top priority issues" />
                    ) : (
                      <NoIssues />
                    )}
                  </section>
                  <section className="panel" aria-labelledby="rc-title">
                    <div className="panel__head">
                      <h2 id="rc-title">Recent changes</h2>
                      <div className="panel__tools">
                        <button type="button" className="btn btn--sm" onClick={() => { setChangeFilter('all'); go('changes'); }}>
                          Change log <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {changes.length ? (
                      <ChangesPreview changes={changes.slice(0, 5)} onOpen={(id, from) => openDrawer({ kind: 'change', id }, from)} />
                    ) : (
                      <EmptyState title="No changes in scope" />
                    )}
                  </section>
                </div>
              </>
            ) : noData
          )}

          {view === 'exceptions' && (
            <section className="panel" aria-labelledby="ex-title">
              <div className="panel__head">
                <h2 id="ex-title">Issues</h2>
                <span className="meta">{shownIssues.length} of {issues.length} in scope</span>
                <IssueFilters filter={issueFilter} onFilter={setIssueFilter} issues={issues} />
              </div>
              {hasData && (
                <div className="filterbar">
                  <span className="meta-ink">
                    Ingredient requests needing review: <strong>{summary.ingredientReview}</strong> of {ingredientLines} meal lines
                  </span>
                  <button type="button" className="btn btn--link" onClick={() => setIssueFilter({ ...DEFAULT_ISSUE_FILTER, stage: 'ingredientRequest' })}>
                    Show ingredient issues
                  </button>
                  <button type="button" className="btn btn--link" onClick={() => { setQuick('ingredient_review'); setDailyStage(null); go('overview'); }}>
                    Show cafes ({filterRows(rows, 'ingredient_review', '', null).length})
                  </button>
                </div>
              )}
              {shownIssues.length ? (
                <IssueRows issues={shownIssues} onOpen={(id, from) => openDrawer({ kind: 'issue', id }, from)} label="Issues" />
              ) : (
                <NoIssues onClear={issues.length ? () => setIssueFilter(DEFAULT_ISSUE_FILTER) : undefined} />
              )}
            </section>
          )}

          {view === 'changes' && (
            <section className="panel" aria-labelledby="cl-title">
              <div className="panel__head">
                <h2 id="cl-title">Changes</h2>
                <span className="meta">Daily orders, menu edits and weekly projections — separate records</span>
              </div>
              <div className="filterbar">
                <ChangeFilterBar filter={changeFilter} onFilter={setChangeFilter} changes={changes} settings={state.settings} />
              </div>
              {shownChanges.length ? (
                <ChangeLogTable changes={shownChanges} settings={state.settings} onOpen={(id, from) => openDrawer({ kind: 'change', id }, from)} />
              ) : (
                <EmptyState title="No changes match">
                  {changeFilter !== 'all' ? <button type="button" className="btn btn--link" onClick={() => setChangeFilter('all')}>Show all changes</button> : 'Nothing recorded for this site, date and meal.'}
                </EmptyState>
              )}
            </section>
          )}

          {view === 'planning' && (
            <div className="stack">
              <section className="panel" aria-labelledby="wk-title">
                <div className="panel__head">
                  <h2 id="wk-title">Weekly planning</h2>
                  <span className="meta">Projection week, independent of service date</span>
                  <div className="panel__tools">
                    <label className="ctl ctl--sm">
                      <span className="sr-only">Projection week</span>
                      <select aria-label="Projection week" value={filters.weekId} onChange={(e) => changeFilters({ weekId: e.target.value })}>
                        {PROJECTION_WEEKS.map((w) => <option key={w.id} value={w.id}>Week {w.label}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
                <StageRows coverage={coverage} period="week" active={planStage} onOpen={(k, from) => openDrawer({ kind: 'stage', id: k }, from)} label="Weekly stage progress" />
              </section>

              <section className="panel" aria-labelledby="pc-title">
                <div className="panel__head">
                  <h2 id="pc-title">Cafes · week {week.label}</h2>
                </div>
                <PlanningTable
                  rows={planning}
                  filters={filters}
                  stage={planStage}
                  onClearStage={() => setPlanStage(null)}
                  onOpenCafe={(id, from) => openDrawer({ kind: 'planning', id }, from)}
                  onOpenIssue={(id, from) => openDrawer({ kind: 'issue', id }, from)}
                  issues={state.issues}
                />
              </section>

              <section className="panel" aria-labelledby="dy-title">
                <div className="panel__head">
                  <h2 id="dy-title">Daily progress</h2>
                  <span className="meta">Service date {serviceDateLabel(filters.date)} · {filters.meal === 'All' ? 'all meals' : filters.meal}</span>
                </div>
                {hasData ? (
                  <StageRows
                    coverage={coverage}
                    period="day"
                    onOpen={(k, from) => openDrawer({ kind: 'stage', id: k }, from)}
                    label="Daily stage progress"
                  />
                ) : (
                  <EmptyState title="Data unavailable for this date in the demo" />
                )}
              </section>
            </div>
          )}

          {view === 'data' && <DataStatus onOpenSource={(id, from) => openDrawer({ kind: 'source', id }, from)} onOpenCutoff={(id, from) => openDrawer({ kind: 'cutoff', id }, from)} />}
        </main>
      </div>

      {drawer.length > 0 && (
        <Drawer
          stack={drawer}
          onPush={pushDrawer}
          onTrim={(n) => setDrawer((d) => d.slice(0, n))}
          onClose={closeDrawer}
          state={state}
          dispatch={dispatch}
          filters={filters}
          row={drawerRow}
          notify={notify}
          onFilterStage={(k) => {
            leaveDrawer();
            if (isPlanningStage(k)) setPlanStage(k as PlanningStage);
            else { setDailyStage(k as DailyStage); setQuick('all'); if (view !== 'overview') go('overview'); scrollToTable(); }
          }}
        />
      )}

      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
    </div>
  );
}
