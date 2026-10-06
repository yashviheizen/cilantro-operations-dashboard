import { useId } from 'react';
import type { ReactNode } from 'react';
import { Ban, CircleCheck, CircleHelp, CircleMinus, Clock, Inbox, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { TERMS } from '../data/masters';
import { STATUS_LABEL } from '../lib/derive';
import type { DisplayStatus, EvidenceAvailability, IssueStatus, Provenance, Severity } from '../data/types';

const STATUS_ICON: Record<DisplayStatus, typeof Clock> = {
  complete: CircleCheck,
  pending: Clock,
  review: TriangleAlert,
  overdue: OctagonAlert,
  blocked: Ban,
  unconfirmed: CircleHelp,
  not_applicable: CircleMinus,
};

/** Status is always icon + text; colour is reinforcement only. */
export function StatusBadge({ status, text, compact }: { status: DisplayStatus; text?: string; compact?: boolean }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`status status--${status}${compact ? ' status--compact' : ''}`} title={text ?? STATUS_LABEL[status]}>
      <Icon size={14} aria-hidden="true" strokeWidth={2.25} />
      <span>{text ?? STATUS_LABEL[status]}</span>
    </span>
  );
}

const SEV_ICON: Record<Severity, typeof Clock> = { critical: OctagonAlert, high: TriangleAlert, medium: CircleHelp, low: CircleMinus };

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEV_ICON[severity];
  return (
    <span className={`sev sev--${severity}`}>
      <Icon size={13} aria-hidden="true" />
      {severity[0].toUpperCase() + severity.slice(1)}
    </span>
  );
}

const ISSUE_STATUS: Record<IssueStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`istatus istatus--${status}`}>{ISSUE_STATUS[status]}</span>;
}

const PROV: Record<Provenance, { label: string; title: string }> = {
  existing: { label: 'Existing', title: 'Shown or explained in the playbook walkthroughs.' },
  proposed: { label: 'Proposed', title: 'Proposed dashboard or process support — not an existing system feature.' },
  verify: { label: 'Needs verification', title: 'Rule or behaviour still to be confirmed by the business.' },
};

export function ProvenanceTag({ p }: { p: Provenance }) {
  return (
    <span className={`prov prov--${p}`} title={PROV[p].title}>
      {PROV[p].label}
    </span>
  );
}

const AVAIL: Record<EvidenceAvailability, { label: string; status: DisplayStatus }> = {
  available: { label: 'Available', status: 'complete' },
  not_confirmed: { label: 'Not confirmed', status: 'unconfirmed' },
  unavailable: { label: 'Data unavailable', status: 'not_applicable' },
};

export function AvailabilityBadge({ a }: { a: EvidenceAvailability }) {
  return <StatusBadge status={AVAIL[a].status} text={AVAIL[a].label} compact />;
}

/** Inline glossary term with an accessible tooltip (hover and keyboard focus). */
export function Term({ k, children }: { k: keyof typeof TERMS | string; children?: ReactNode }) {
  const id = useId();
  return (
    <span className="term">
      <button type="button" className="term__btn" aria-describedby={id}>
        {children ?? k}
      </button>
      <span role="tooltip" id={id} className="term__tip">
        {TERMS[k]}
      </span>
    </span>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty" role="status">
      {icon ?? <Inbox size={22} aria-hidden="true" />}
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}

/** Small info icon with an accessible tooltip — used for definitions and caveats. */
export function InfoTip({ label, children, align = 'start' }: { label: string; children: ReactNode; align?: 'start' | 'end' }) {
  const id = useId();
  return (
    <span className={`term term--info${align === 'end' ? ' term--end' : ''}`}>
      <button type="button" className="info-btn" aria-label={label} aria-describedby={id}>
        <Info size={14} aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="term__tip">
        {children}
      </span>
    </span>
  );
}

/** Compact severity: coloured dot + text label (colour is never the only cue). */
export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span className={`sevdot sevdot--${severity}`}>
      <span className="sevdot__dot" aria-hidden="true" />
      {severity[0].toUpperCase() + severity.slice(1)}
    </span>
  );
}

export function SectionHeader({ id, title, sub, children }: { id: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="section__head">
      <div>
        <h2 id={id}>{title}</h2>
        {sub && <p className="section__sub">{sub}</p>}
      </div>
      {children && <div className="section__tools">{children}</div>}
    </div>
  );
}
