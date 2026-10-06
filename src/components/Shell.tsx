import { useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import {
  CalendarRange, Database, History, LayoutDashboard, Leaf, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Settings2, TriangleAlert, X,
} from 'lucide-react';
import { CAFES, DATA_SOURCES, SITES } from '../data/masters';
import { DEMO_NOW, fmtDateTime, serviceDateLabel } from '../data/clock';
import { MEALS } from '../data/types';
import type { DemoSettings, Meal } from '../data/types';
import type { Filters } from '../lib/derive';

export const DATE_OPTIONS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

export type View = 'overview' | 'exceptions' | 'changes' | 'planning' | 'data';

export const VIEWS: { key: View; label: string; icon: typeof Leaf }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'exceptions', label: 'Exceptions', icon: TriangleAlert },
  { key: 'changes', label: 'Change log', icon: History },
  { key: 'planning', label: 'Planning & progress', icon: CalendarRange },
  { key: 'data', label: 'Data status', icon: Database },
];

// ---------------------------------------------------------------- sidebar

interface SidebarProps {
  view: View;
  onView: (v: View) => void;
  counts: Partial<Record<View, number>>;
  collapsed: boolean;
  onCollapse: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  settings: ReactNode;
}

export function Sidebar({ view, onView, counts, collapsed, onCollapse, mobileOpen, onMobileClose, settings }: SidebarProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    ref.current?.querySelector<HTMLElement>('.nav__item[aria-current="page"]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onMobileClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} aria-hidden="true" />}
      <aside ref={ref} id="sidebar" className={`sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`} aria-label="Main">
        <div className="sidebar__brand">
          <span className="brand__mark" aria-hidden="true"><Leaf size={16} /></span>
          <span className="brand__name">Cilantro Ops</span>
          <button type="button" className="icon-btn sidebar__close" onClick={onMobileClose} aria-label="Close navigation">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="nav">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className="nav__item"
              aria-current={view === key ? 'page' : undefined}
              title={collapsed ? label : undefined}
              aria-label={counts[key] ? `${label}, ${counts[key]} need attention` : label}
              onClick={() => onView(key)}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav__label">{label}</span>
              {!!counts[key] && <span className="nav__count" aria-hidden="true">{counts[key]}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          {settings}
          <button
            type="button"
            className="nav__item sidebar__collapse"
            onClick={() => onCollapse(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : undefined}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            <span className="nav__label">Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------- top bar

export function TopBar({ title, filters, onChange, onMenu, headingRef }: {
  title: string; filters: Filters; onChange: (f: Partial<Filters>) => void; onMenu: () => void; headingRef: Ref<HTMLHeadingElement>;
}) {
  const cafes = CAFES.filter((c) => filters.siteId === 'all' || c.siteId === filters.siteId);
  const updated = DATA_SOURCES.find((d) => d.id === 'cilantro')!.lastUpdated!;

  return (
    <header className="topbar">
      <div className="topbar__title">
        <button type="button" className="icon-btn topbar__menu" onClick={onMenu} aria-label="Open navigation" aria-controls="sidebar">
          <Menu size={20} aria-hidden="true" />
        </button>
        <h1 tabIndex={-1} ref={headingRef}>{title}</h1>
        <span className="demo-pill" title="Fictional demo data. Nothing is sent to SAP, email or WhatsApp.">Demo</span>
        <span className="topbar__meta" title={`Demo clock ${fmtDateTime(DEMO_NOW)}`}>Updated {fmtDateTime(updated)}</span>
      </div>
      <div className="topbar__filters" role="group" aria-label="Filters">
        <label className="ctl">
          <span className="sr-only">Site</span>
          <select
            value={filters.siteId}
            // Changing site always clears the cafe selection.
            onChange={(e) => onChange({ siteId: e.target.value, cafeId: 'all' })}
            aria-label="Site"
          >
            <option value="all">All sites</option>
            {SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="ctl">
          <span className="sr-only">Cafe</span>
          <select value={filters.cafeId} onChange={(e) => onChange({ cafeId: e.target.value })} aria-label="Cafe">
            <option value="all">All cafes</option>
            {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="ctl">
          <span className="sr-only">Service date</span>
          <select value={filters.date} onChange={(e) => onChange({ date: e.target.value })} aria-label="Service date">
            {DATE_OPTIONS.map((d) => <option key={d} value={d}>{serviceDateLabel(d)}</option>)}
          </select>
        </label>
        <label className="ctl">
          <span className="sr-only">Meal</span>
          <select value={filters.meal} onChange={(e) => onChange({ meal: e.target.value as Meal | 'All' })} aria-label="Meal">
            <option value="All">All meals</option>
            {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- demo settings

export function SettingsMenu({ settings, onSettings, onReset, dirty, collapsed }: {
  settings: DemoSettings; onSettings: (s: DemoSettings) => void; onReset: () => void; dirty: boolean; collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className="nav__item"
        aria-expanded={open}
        aria-controls="demo-settings"
        title={collapsed ? 'Demo settings' : undefined}
        aria-label="Demo settings"
        onClick={() => setOpen(!open)}
      >
        <Settings2 size={18} aria-hidden="true" />
        <span className="nav__label">Demo settings</span>
        {dirty && <span className="nav__dot" title="Local changes" />}
      </button>
      {open && (
        <div className="popover popover--side" id="demo-settings" role="group" aria-label="Demo settings">
          <p className="popover__title">Unusual change check</p>
          <p className="meta">Proposed demo check. Not an agreed tolerance.</p>
          <div className="popover__row">
            <label className="field field--inline">
              <span>At least</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={settings.unusualChangePercent}
                onChange={(e) => onSettings({ ...settings, unusualChangePercent: Math.max(1, Number(e.target.value) || 1) })}
              />
              <span>%</span>
            </label>
            <label className="field field--inline">
              <span>and</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={settings.unusualChangeMinKg}
                onChange={(e) => onSettings({ ...settings, unusualChangeMinKg: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span>kg</span>
            </label>
          </div>
          <hr />
          <p className="popover__title">Local demo actions</p>
          <p className="meta">Stored only in this browser. {dirty ? 'You have local changes.' : 'No local changes yet.'}</p>
          {confirming ? (
            <div className="btn-row">
              <button type="button" className="btn btn--danger" onClick={() => { onReset(); setConfirming(false); setOpen(false); }}>
                Confirm reset
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirming(true)}>
              <RotateCcw size={15} aria-hidden="true" /> Reset demo data
            </button>
          )}
        </div>
      )}
    </div>
  );
}
