import { describe, expect, it } from 'vitest';
import { cafeRows, changesInScope, issuesInScope, isUnusualChange, planningRows, stageStatus, summarize } from './derive';
import type { Filters } from './derive';
import { estimateIngredients, paxFromKg } from './ingredients';
import { reducer, seedState } from './store';
import { SERVICE_LINES } from '../data/operations';
import { TODAY, TOMORROW } from '../data/clock';

const F: Filters = { siteId: 'all', cafeId: 'all', date: TOMORROW, meal: 'All', weekId: '2026-W43' };

describe('stage status', () => {
  it('derives overdue/pending from the demo clock', () => {
    expect(stageStatus({ fact: 'not_done', dueAt: '2026-10-13T12:00' }, new Set())).toBe('overdue');
    expect(stageStatus({ fact: 'not_done', dueAt: '2026-10-13T14:00' }, new Set())).toBe('pending');
  });
  it('treats unknown as not confirmed, never complete', () => {
    expect(stageStatus({ fact: 'unknown' }, new Set())).toBe('unconfirmed');
  });
});

describe('cafe rows', () => {
  it('closed cafe is not applicable and raises no alert', () => {
    const row = cafeRows(F, seedState().issues).find((r) => r.cafe.id === 'rv-b')!;
    expect(row.applicable).toBe(false);
    expect(row.attention).toBe(false);
    expect(row.openIssues).toHaveLength(0);
  });
  it('unknown dispatch is never shown as delivered', () => {
    const row = cafeRows({ ...F, date: TODAY }, seedState().issues).find((r) => r.cafe.id === 'rv-a')!;
    expect(row.stages.cookingDispatch.status).toBe('unconfirmed');
    expect(row.stages.cookingDispatch.text).not.toMatch(/deliver(ed)?$/i);
  });
  it('meal not served is not applicable', () => {
    const row = cafeRows({ ...F, meal: 'Dinner' }, seedState().issues).find((r) => r.cafe.id === 'lv-f8')!;
    expect(row.applicable).toBe(false);
  });
});

describe('summary', () => {
  it('cards agree with table rows and issues', () => {
    const s = seedState();
    const rows = cafeRows(F, s.issues);
    const sum = summarize(rows, s.issues, s.changes, F);
    expect(sum.applicableCafes).toBe(rows.filter((r) => r.applicable).length);
    expect(sum.ready).toBe(rows.filter((r) => r.ready).length);
    expect(sum.criticalOpen).toBe(issuesInScope(s.issues, F).filter((i) => i.severity === 'critical' && i.status !== 'resolved').length);
    expect(sum.ordersOverdue).toBe(1); // Atrium lunch
    expect(sum.lateAwaitingAck).toBe(3);
  });
  it('resolving an issue clears its stage and updates readiness', () => {
    let s = seedState();
    const before = cafeRows(F, s.issues).find((r) => r.cafe.id === 'hp-exec')!;
    expect(before.ready).toBe(false);
    s = reducer(s, { type: 'resolve', issueId: 'ISS-110', closureNote: 'Export v2 issued' });
    const after = cafeRows(F, s.issues).find((r) => r.cafe.id === 'hp-exec')!;
    expect(after.ready).toBe(true);
  });
  it('acknowledging does not resolve', () => {
    const s = reducer(seedState(), { type: 'acknowledgeIssue', issueId: 'ISS-101' });
    const i = s.issues.find((x) => x.id === 'ISS-101')!;
    expect(i.status).toBe('open');
    expect(i.acknowledged).toBeDefined();
  });
  it('acknowledging all teams clears the late-change count', () => {
    let s = seedState();
    s = reducer(s, { type: 'acknowledgeChange', changeId: 'CHG-208', team: 'Kitchen section', detail: 'Rice section' });
    const late = changesInScope(s.changes, F).filter((c) => c.late && c.acknowledgments.some((a) => a.state === 'pending'));
    expect(late.map((c) => c.id)).not.toContain('CHG-208');
  });
});

describe('projection vs MR', () => {
  it('MR change does not overwrite the projection', () => {
    const line = SERVICE_LINES.find((l) => l.cafeId === 'lv-f8' && l.date === TOMORROW && l.meal === 'Lunch')!;
    const rice = line.dishes.find((d) => d.dishId === 'jeera-rice')!;
    expect(rice.projected?.value).toBe(40);
    expect(rice.mr?.value).toBe(400);
  });
  it('weekly planning is per projection week', () => {
    const rows = planningRows({ ...F, weekId: '2026-W43' }, seedState().issues);
    expect(rows.find((r) => r.cafe.id === 'rv-a')!.stages.weeklyProjection.status).toBe('overdue');
    const w42 = planningRows({ ...F, weekId: '2026-W42' }, seedState().issues);
    expect(w42.every((r) => r.stages.weeklyProjection.status === 'complete')).toBe(true);
  });
});

describe('calculations', () => {
  it('recipe-ratio ingredients: 360 kg cooked rice → 108 kg raw', () => {
    const e = estimateIngredients('jeera-rice', { value: 360, unit: 'kg' });
    expect(e.complete && e.lines.find((l) => l.mogName.startsWith('Raw rice'))!.qty.value).toBe(108);
  });
  it('missing recipe is incomplete, not zero', () => {
    const e = estimateIngredients('millet-upma', { value: 45, unit: 'kg' });
    expect(e.complete).toBe(false);
  });
  it('missing article makes cost incomplete', () => {
    const e = estimateIngredients('coconut-chutney', { value: 5.5, unit: 'kg' });
    expect(e.complete && e.costComplete).toBe(false);
  });
  it('flags fractional pax', () => {
    expect(paxFromKg(10, 150).fractional).toBe(true);
    expect(paxFromKg(9, 150)).toEqual({ pax: 60, fractional: false });
  });
  it('unusual-change threshold is configurable', () => {
    const c = seedState().changes.find((x) => x.id === 'CHG-201')!;
    expect(isUnusualChange(c, { unusualChangePercent: 50, unusualChangeMinKg: 20 })).toBe(true);
    expect(isUnusualChange(c, { unusualChangePercent: 50, unusualChangeMinKg: 500 })).toBe(false);
  });
});
