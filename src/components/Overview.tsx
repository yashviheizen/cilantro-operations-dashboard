import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Summary } from '../lib/derive';

export type CardKey = 'ready' | 'orders' | 'critical' | 'late';

/** Four compact KPI cards. Each keeps its denominator; detail lives in the tooltip and the drill-down. */
export function SummaryCards({ s, active, onSelect }: { s: Summary; active: CardKey | null; onSelect: (k: CardKey) => void }) {
  const ordersOpen = s.ordersPending + s.ordersOverdue;
  return (
    <div className="kpis" role="group" aria-label="Summary">
      <Card
        k="ready"
        label="Cafes ready"
        value={s.ready}
        of={`of ${s.applicableCafes} in service`}
        sub={`${s.applicableCafes - s.ready} not ready`}
        tip="Ready = menu published, selection, final order, production plan and ingredient request complete for every meal served. Closed cafes are excluded."
        tone={s.ready === s.applicableCafes ? 'ok' : 'neutral'}
        active={active}
        onSelect={onSelect}
        action="Show not-ready cafes"
      />
      <Card
        k="orders"
        label="Orders pending"
        value={ordersOpen}
        of={`of ${s.orderLines} meal orders`}
        sub={<><span className={s.ordersOverdue ? 'txt-critical' : ''}>{s.ordersOverdue} overdue</span> · {s.ordersPending} pending</>}
        tip="Final orders (MR) not yet submitted, per cafe and meal. Overdue = past the site cutoff; pending = cutoff not reached yet."
        tone={s.ordersOverdue ? 'critical' : ordersOpen ? 'review' : 'ok'}
        active={active}
        onSelect={onSelect}
        action="Show cafes with pending orders"
      />
      <Card
        k="critical"
        label="Critical issues"
        value={s.criticalOpen}
        of={`of ${s.openIssues} open issues`}
        sub={`${s.openIssues - s.criticalOpen} non-critical`}
        tip="Open or in-progress issues with critical severity in the current scope."
        tone={s.criticalOpen ? 'critical' : 'ok'}
        active={active}
        onSelect={onSelect}
        action="Open critical exceptions"
      />
      <Card
        k="late"
        label="Late changes"
        value={s.lateAwaitingAck}
        of={`of ${s.lateChanges} late changes`}
        sub="awaiting acknowledgment"
        tip="Changes made after a production export or ingredient request that one or more teams have not acknowledged yet."
        tone={s.lateAwaitingAck ? 'review' : 'ok'}
        active={active}
        onSelect={onSelect}
        action="Open late changes in the change log"
      />
    </div>
  );
}

function Card({ k, label, value, of, sub, tip, tone, active, onSelect, action }: {
  k: CardKey; label: string; value: number; of: string; sub: ReactNode; tip: string; tone: 'ok' | 'review' | 'critical' | 'neutral';
  active: CardKey | null; onSelect: (k: CardKey) => void; action: string;
}) {
  const on = active === k;
  return (
    <button
      type="button"
      className={`kpi kpi--${tone}${on ? ' is-on' : ''}`}
      aria-pressed={k === 'ready' || k === 'orders' ? on : undefined}
      onClick={() => onSelect(k)}
      title={tip}
      aria-label={`${label}: ${value} ${of}. ${action}.`}
    >
      <span className="kpi__label">{label}</span>
      <span className="kpi__row">
        <span className="kpi__value">{value}</span>
        <span className="kpi__of">{of}</span>
        <ArrowRight size={14} aria-hidden="true" className="kpi__go" />
      </span>
      <span className="kpi__sub">{sub}</span>
    </button>
  );
}
