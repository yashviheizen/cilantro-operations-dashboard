// Local demo state. Seeded from mock data; every action is stored only in
// this browser (localStorage) and is labelled as a local demo action.

import { useEffect, useReducer } from 'react';
import { DEFAULT_SETTINGS } from '../data/masters';
import { SEED_CHANGES, SEED_ISSUES } from '../data/operations';
import { DEMO_NOW } from '../data/clock';
import type { Change, DemoSettings, Issue, Person, Team } from '../data/types';

export const DEMO_USER = 'You (demo user)';
const STORAGE_KEY = 'cilantro-ops-demo-v1';

export interface DemoState {
  issues: Issue[];
  changes: Change[];
  settings: DemoSettings;
}

export type Action =
  | { type: 'assign'; issueId: string; owner: Person }
  | { type: 'note'; issueId: string; text: string }
  | { type: 'acknowledgeIssue'; issueId: string }
  | { type: 'startProgress'; issueId: string }
  | { type: 'resolve'; issueId: string; closureNote: string }
  | { type: 'reopen'; issueId: string }
  | { type: 'recordReason'; changeId: string; reason: string }
  | { type: 'acknowledgeChange'; changeId: string; team: Team; detail?: string }
  | { type: 'settings'; settings: DemoSettings }
  | { type: 'reset' };

export function seedState(): DemoState {
  return structuredClone({ issues: SEED_ISSUES, changes: SEED_CHANGES, settings: DEFAULT_SETTINGS });
}

const event = (text: string) => ({ at: DEMO_NOW, by: DEMO_USER, text, local: true });

function updateIssue(s: DemoState, id: string, fn: (i: Issue) => Issue): DemoState {
  return { ...s, issues: s.issues.map((i) => (i.id === id ? fn(i) : i)) };
}

export function reducer(s: DemoState, a: Action): DemoState {
  switch (a.type) {
    case 'assign':
      return updateIssue(s, a.issueId, (i) => ({
        ...i, owner: a.owner, timeline: [...i.timeline, event(`Owner changed to ${a.owner.name} (${a.owner.role}).`)],
      }));
    case 'note':
      return updateIssue(s, a.issueId, (i) => ({ ...i, notes: [...i.notes, event(a.text)] }));
    case 'acknowledgeIssue':
      // Acknowledging records awareness only — the status is deliberately unchanged.
      return updateIssue(s, a.issueId, (i) => ({
        ...i, acknowledged: { at: DEMO_NOW, by: DEMO_USER }, timeline: [...i.timeline, event('Acknowledged (status unchanged).')],
      }));
    case 'startProgress':
      return updateIssue(s, a.issueId, (i) => ({ ...i, status: 'in_progress', timeline: [...i.timeline, event('Moved to In progress.')] }));
    case 'resolve':
      return updateIssue(s, a.issueId, (i) => ({
        ...i, status: 'resolved', closureNote: a.closureNote, timeline: [...i.timeline, event(`Resolved: ${a.closureNote}`)],
      }));
    case 'reopen':
      return updateIssue(s, a.issueId, (i) => ({
        ...i, status: 'open', closureNote: undefined, timeline: [...i.timeline, event('Reopened.')],
      }));
    case 'recordReason': {
      const change = s.changes.find((c) => c.id === a.changeId);
      const next = { ...s, changes: s.changes.map((c) => (c.id === a.changeId ? { ...c, reason: a.reason } : c)) };
      if (!change?.relatedIssueId) return next;
      return updateIssue(next, change.relatedIssueId, (i) => ({
        ...i,
        timeline: [...i.timeline, event(`Reason recorded on ${a.changeId}: “${a.reason}”.`)],
        evidence: i.evidence.map((e) => (e.label === 'Reason for change' ? { ...e, availability: 'available' as const, note: `Recorded locally: ${a.reason}` } : e)),
      }));
    }
    case 'acknowledgeChange':
      return {
        ...s,
        changes: s.changes.map((c) => {
          if (c.id !== a.changeId) return c;
          const exists = c.acknowledgments.some((k) => k.team === a.team && k.detail === a.detail);
          const ack = { team: a.team, detail: a.detail, state: 'acknowledged' as const, at: DEMO_NOW, by: DEMO_USER, local: true };
          return {
            ...c,
            acknowledgments: exists
              ? c.acknowledgments.map((k) => (k.team === a.team && k.detail === a.detail ? ack : k))
              : [...c.acknowledgments, ack],
          };
        }),
      };
    case 'settings':
      return { ...s, settings: a.settings };
    case 'reset':
      return seedState();
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (Array.isArray(parsed.issues) && Array.isArray(parsed.changes) && parsed.settings) {
        // Fill fields added to the seed after this state was saved (e.g. issue.short), keeping local edits.
        const seed = seedState();
        const seedIssue = new Map(seed.issues.map((i) => [i.id, i]));
        const seedChange = new Map(seed.changes.map((c) => [c.id, c]));
        return {
          ...parsed,
          issues: parsed.issues.map((i) => ({ ...seedIssue.get(i.id), ...i })),
          changes: parsed.changes.map((c) => ({ ...seedChange.get(c.id), ...c })),
          settings: { ...seed.settings, ...parsed.settings },
        };
      }
    }
  } catch {
    /* storage unavailable — fall back to seed */
  }
  return seedState();
}

export function hasLocalChanges(s: DemoState): boolean {
  return JSON.stringify(s) !== JSON.stringify(seedState());
}

export function useDemoStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  return [state, dispatch] as const;
}
