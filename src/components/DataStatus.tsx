import { fmtDateTime, DEMO_NOW } from '../data/clock';
import { DATA_SOURCES, SITES, TERMS } from '../data/masters';
import { REQUIRED_STAGES, STAGE_LABEL } from '../lib/derive';
import type { Site } from '../data/types';
import { AvailabilityBadge, ProvenanceTag } from './ui';

const CUTOFFS: { key: keyof Site['cutoffs']; label: string }[] = [
  { key: 'menuPublication', label: 'Menu publication' },
  { key: 'projection', label: 'Weekly projection' },
  { key: 'finalOrder', label: 'Final order (MR)' },
  { key: 'productionExport', label: 'Production export' },
  { key: 'ingredientRequest', label: 'Ingredient request' },
  { key: 'storeHandoff', label: 'Store handoff' },
];

export function DataStatus({ onOpenSource }: { onOpenSource: (id: string) => void }) {
  return (
    <div className="stack">
      <section className="panel" aria-labelledby="src-title">
        <div className="panel__head">
          <h2 id="src-title">Data sources</h2>
          <span className="meta">Missing data is shown as unavailable, never as complete.</span>
        </div>
        <table className="grid grid--sources">
          <colgroup><col className="c-src" /><col className="c-status" /><col className="c-updated" /><col /></colgroup>
          <thead>
            <tr><th scope="col">Source</th><th scope="col">Availability</th><th scope="col">Updated</th><th scope="col">Note</th></tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((d) => (
              <tr key={d.id} className="is-clickable" tabIndex={0} aria-label={`View ${d.name} details`} onClick={() => onOpenSource(d.id)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenSource(d.id); } }}>
                <th scope="row">{d.name}</th>
                <td><AvailabilityBadge a={d.availability} /></td>
                <td className="meta-ink">{d.lastUpdated ? fmtDateTime(d.lastUpdated) : '—'}</td>
                <td className="wrap meta-ink">{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="cols">
        <section className="panel" aria-labelledby="def-title">
          <div className="panel__head"><h2 id="def-title">Definitions & caveats</h2></div>
          <ul className="notes">
            <li><strong>Ready</strong> = {REQUIRED_STAGES.map((k) => STAGE_LABEL[k].toLowerCase()).join(', ')} complete for every meal the cafe serves. Closed cafes and meals not served are excluded from the denominator.</li>
            <li>Store handoff and cooking & dispatch are tracked but not required for readiness, because their data is partly unavailable.</li>
            <li><strong>Export ≠ issued.</strong> An exported article file stays “receipt not confirmed” until the store acknowledges it.</li>
            <li><strong>Dispatch</strong> is shown only when confirmed. Unknown dispatch is “Not confirmed”, never “Delivered”.</li>
            <li><strong>Weekly projection</strong> and the <strong>daily final order (MR)</strong> are separate records; an MR change never alters the projection.</li>
            <li>The unusual-change check is a <ProvenanceTag p="proposed" /> demo rule with a configurable threshold (Demo settings). No tolerance has been agreed.</li>
            <li>Simulated snapshot. Demo clock {fmtDateTime(DEMO_NOW)}. Actions are stored only in this browser; nothing is sent to SAP, email or WhatsApp.</li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="gl-title">
          <div className="panel__head"><h2 id="gl-title">Glossary</h2></div>
          <dl className="glossary">
            {Object.entries(TERMS).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      </div>

      <section className="panel" aria-labelledby="cut-title">
        <div className="panel__head">
          <h2 id="cut-title">Cutoffs by site</h2>
          <span className="meta">Each rule is tagged existing, proposed or needs verification.</span>
        </div>
        <div className="scroll-x" tabIndex={0} aria-label="Cutoffs by site">
          <table className="grid grid--cutoffs">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                {SITES.map((s) => <th scope="col" key={s.id}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {CUTOFFS.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.label}</th>
                  {SITES.map((s) => (
                    <td key={s.id} className="wrap" title={s.cutoffs[c.key].note}>
                      <span>{s.cutoffs[c.key].rule}</span> <ProvenanceTag p={s.cutoffs[c.key].provenance} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
