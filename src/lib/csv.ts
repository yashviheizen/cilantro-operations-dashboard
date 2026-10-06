import { DAILY_STAGES, STAGE_LABEL, STATUS_LABEL } from './derive';
import type { CafeRow, Filters } from './derive';
import { siteById } from './derive';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(rows: CafeRow[], f: Filters, quick: string, search: string): string {
  const header = [
    'Service date', 'Meal filter', 'Quick filter', 'Search', 'Site', 'Cafe', 'Meals',
    ...DAILY_STAGES.flatMap((k) => [`${STAGE_LABEL[k]} status`, `${STAGE_LABEL[k]} detail`]),
    'Open issues', 'Ready (demo definition)', 'Next action', 'Owner',
  ];
  const body = rows.map((r) => [
    f.date, f.meal, quick, search, r.site.name, r.cafe.name, r.applicable ? r.meals.join(' / ') : `Not applicable — ${r.naReason}`,
    ...DAILY_STAGES.flatMap((k) => [STATUS_LABEL[r.stages[k].status], r.stages[k].text]),
    r.openIssues.length, r.applicable ? (r.ready ? 'Yes' : 'No') : 'Not applicable', r.next.text, r.next.owner,
  ]);
  return [header, ...body].map((line) => line.map(cell).join(',')).join('\n');
}

export function downloadCsv(content: string, f: Filters) {
  const scope = f.siteId === 'all' ? 'all-sites' : siteById(f.siteId).id;
  const name = `cilantro-status_${f.date}_${scope}_${f.meal.toLowerCase()}.csv`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}
