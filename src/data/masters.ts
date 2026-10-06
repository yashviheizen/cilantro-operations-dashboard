// DEMO DATA — fictional sites, cafes, people and values.
// Cutoff rules marked `existing` quote the playbook's local operating examples;
// everything else is a labelled demo assumption.

import type { CalendarException, Cafe, DataSource, DemoSettings, Dish, Mog, ProjectionWeek, Recipe, Site } from './types';

export const SITES: Site[] = [
  {
    id: 'lakeview',
    name: 'Lakeview Campus',
    region: 'Hyderabad region',
    arrangement: 'Off-site (CPU supplied)',
    kitchen: 'Hyderabad CPU (demo)',
    cutoffs: {
      menuPublication: { label: 'Menu publication', rule: 'Tuesday 18:00, week before service', provenance: 'verify', note: 'Playbook: "locally Monday/Tuesday". Exact hour is a demo assumption.' },
      projection: { label: 'Weekly projection', rule: 'Wednesday 18:00 before the projection week', provenance: 'existing', note: 'Hyderabad example in the playbook.' },
      finalOrder: { label: 'Final order (MR)', rule: 'D−1 12:00 (noon)', provenance: 'existing', note: 'Hyderabad example in the playbook.' },
      productionExport: { label: 'Production export', rule: 'D−1 12:00, 15:00, 17:00, 20:00', provenance: 'existing', note: 'Hyderabad export schedule described in the playbook.' },
      ingredientRequest: { label: 'Ingredient request (actual indent)', rule: 'D−1 16:00', provenance: 'verify', note: 'Demo assumption. No site was using actual Kitchen Indent on 30 Sep.' },
      storeHandoff: { label: 'Store handoff', rule: 'D−1 18:00 receipt confirmation', provenance: 'proposed', note: 'Store acknowledgment tracking is proposed, not existing.' },
    },
  },
  {
    id: 'riverside',
    name: 'Riverside Towers',
    region: 'Gurgaon region',
    arrangement: 'Hybrid',
    kitchen: 'Gurgaon CPU + Tower A local kitchen (demo)',
    cutoffs: {
      menuPublication: { label: 'Menu publication', rule: 'Monday 18:00, week before service', provenance: 'verify', note: 'Demo assumption.' },
      projection: { label: 'Weekly projection', rule: 'Tuesday 12:00 before the projection week', provenance: 'verify', note: 'Demo assumption — deliberately different from Hyderabad to show site-specific cutoffs.' },
      finalOrder: { label: 'Final order (MR)', rule: 'D−1 13:00', provenance: 'verify', note: 'Demo assumption.' },
      productionExport: { label: 'Production export', rule: 'D−1 15:00', provenance: 'existing', note: 'Gurgaon described a 3 PM export.' },
      ingredientRequest: { label: 'Ingredient request (actual indent)', rule: 'D−1 16:30', provenance: 'verify', note: 'Demo assumption.' },
      storeHandoff: { label: 'Store handoff', rule: 'D−1 18:00 receipt confirmation', provenance: 'proposed', note: 'Proposed acknowledgment step.' },
    },
  },
  {
    id: 'harbour',
    name: 'Harbour Point',
    region: 'Mumbai region',
    arrangement: 'On-site kitchen',
    kitchen: 'Harbour Point on-site kitchen (demo)',
    cutoffs: {
      menuPublication: { label: 'Menu publication', rule: 'Tuesday 18:00, week before service', provenance: 'verify', note: 'Demo assumption.' },
      projection: { label: 'Weekly projection', rule: 'Wednesday 18:00 before the projection week', provenance: 'verify', note: 'Demo assumption.' },
      finalOrder: { label: 'Final order (MR)', rule: 'D−1 14:00', provenance: 'verify', note: 'Demo assumption.' },
      productionExport: { label: 'Production export', rule: 'D−1 11:00 (advance prep) and 16:00 (final)', provenance: 'verify', note: 'Demo assumption.' },
      ingredientRequest: { label: 'Ingredient request (actual indent)', rule: 'D−1 16:30', provenance: 'verify', note: 'Demo assumption.' },
      storeHandoff: { label: 'Store handoff', rule: 'D−1 18:00 receipt confirmation', provenance: 'proposed', note: 'Proposed acknowledgment step.' },
    },
  },
];

export const CAFES: Cafe[] = [
  { id: 'lv-f8', siteId: 'lakeview', name: 'Floor 8 Cafe', meals: ['Breakfast', 'Lunch', 'Snacks'] },
  { id: 'lv-f11', siteId: 'lakeview', name: 'Floor 11 Cafe', meals: ['Breakfast', 'Lunch', 'Snacks'] },
  { id: 'lv-atr', siteId: 'lakeview', name: 'Atrium Cafe', meals: ['Lunch'] },
  { id: 'rv-a', siteId: 'riverside', name: 'Tower A Cafe', meals: ['Breakfast', 'Lunch', 'Dinner'] },
  { id: 'rv-b', siteId: 'riverside', name: 'Tower B Cafe', meals: ['Breakfast', 'Lunch'] },
  { id: 'hp-main', siteId: 'harbour', name: 'Main Cafe', meals: ['Breakfast', 'Lunch', 'Snacks', 'Dinner'] },
  { id: 'hp-exec', siteId: 'harbour', name: 'Executive Dining', meals: ['Lunch'] },
  { id: 'hp-well', siteId: 'harbour', name: 'Wellness Cafe', meals: ['Breakfast', 'Snacks'] },
];

export const CALENDAR_EXCEPTIONS: CalendarException[] = [
  { cafeId: 'rv-b', date: '2026-10-14', meals: 'all', reason: 'Closed — floor maintenance (demo service calendar)' },
];

export const PROJECTION_WEEKS: ProjectionWeek[] = [
  { id: '2026-W42', label: '12–18 Oct 2026', start: '2026-10-12', end: '2026-10-18' },
  { id: '2026-W43', label: '19–25 Oct 2026', start: '2026-10-19', end: '2026-10-25' },
];

export const DISHES: Dish[] = [
  { id: 'rava-idli', name: 'Rava Idli', section: 'Breakfast/Snacks', recipeStatus: 'available' },
  { id: 'tiffin-sambar', name: 'Tiffin Sambar', section: 'Veg', recipeStatus: 'available' },
  { id: 'poha', name: 'Poha', section: 'Breakfast/Snacks', recipeStatus: 'available' },
  { id: 'millet-upma', name: 'Millet Upma', section: 'Breakfast/Snacks', recipeStatus: 'missing' },
  { id: 'jeera-rice', name: 'Jeera Rice', section: 'Rice', recipeStatus: 'available' },
  { id: 'achari-dal', name: 'Achari Dal', section: 'Veg', recipeStatus: 'available' },
  { id: 'dal-makhani', name: 'Dal Makhani', section: 'Veg', recipeStatus: 'available' },
  { id: 'paneer-butter-masala', name: 'Paneer Butter Masala', section: 'Veg', recipeStatus: 'available' },
  { id: 'veg-pulao', name: 'Veg Pulao', section: 'Rice', recipeStatus: 'available' },
  { id: 'coconut-chutney', name: 'Coconut Chutney', section: 'Breakfast/Snacks', recipeStatus: 'available' },
  { id: 'other-kerala-chutney', name: 'Other: Coconut chutney (Kerala style)', section: 'Unassigned', recipeStatus: 'missing', custom: true },
  { id: 'egg-curry', name: 'Eggcellent Andhra curry', section: 'Non-veg', recipeStatus: 'available' },
  { id: 'paratha', name: 'Paratha', section: 'Breads', recipeStatus: 'available' },
  { id: 'veg-puff', name: 'Veg Puff', section: 'Bakery', recipeStatus: 'available' },
  { id: 'samosa', name: 'Samosa', section: 'Halwai', recipeStatus: 'available' },
  { id: 'mint-chutney', name: 'Mint Chutney', section: 'Breakfast/Snacks', recipeStatus: 'available' },
  { id: 'chapati', name: 'Chapati', section: 'Breads', recipeStatus: 'available' },
  { id: 'mixed-veg', name: 'Mixed Veg Curry', section: 'Veg', recipeStatus: 'available' },
  { id: 'steamed-rice', name: 'Steamed Rice', section: 'Rice', recipeStatus: 'available' },
];

export const MOGS: Mog[] = [
  { id: 'raw-rice', name: 'Raw rice (sona masoori)', articleCode: 'ART-10021', articleName: 'Rice Sona Masoori 25 kg' },
  { id: 'ghee', name: 'Ghee', articleCode: 'ART-10310', articleName: 'Ghee 15 kg tin' },
  { id: 'cumin', name: 'Cumin seeds', articleCode: 'ART-10455', articleName: 'Jeera whole 1 kg' },
  { id: 'salt', name: 'Salt', articleCode: 'ART-10001', articleName: 'Iodised salt 1 kg' },
  { id: 'paneer', name: 'Paneer', articleCode: 'ART-20410', articleName: 'Paneer block 1 kg' },
  { id: 'tomato', name: 'Tomato', articleCode: 'ART-30012', articleName: 'Tomato (fresh)' },
  { id: 'onion', name: 'Onion', articleCode: 'ART-30005', articleName: 'Onion (fresh)' },
  { id: 'cream', name: 'Fresh cream', articleCode: 'ART-20455', articleName: 'Cream 25% 1 L' },
  { id: 'butter', name: 'Butter', articleCode: 'ART-20430', articleName: 'Butter 500 g' },
  { id: 'urad-whole', name: 'Whole black urad', articleCode: 'ART-10612', articleName: 'Urad whole 30 kg' },
  { id: 'rajma', name: 'Rajma', articleCode: 'ART-10630', articleName: 'Rajma 30 kg' },
  { id: 'toor-dal', name: 'Toor dal', articleCode: 'ART-10601', articleName: 'Toor dal 30 kg' },
  { id: 'achar-masala', name: 'Achar masala', articleCode: 'ART-10790', articleName: 'Pickle masala 1 kg' },
  { id: 'frozen-coconut', name: 'Frozen grated coconut', articleCode: null },
  { id: 'roasted-chana', name: 'Roasted chana dal', articleCode: 'ART-10640', articleName: 'Roasted chana 5 kg' },
  { id: 'green-chilli', name: 'Green chilli', articleCode: 'ART-30044', articleName: 'Green chilli (fresh)' },
  { id: 'mixed-veg-cut', name: 'Mixed vegetables (prepped)', articleCode: 'ART-30200', articleName: 'Veg mix (fresh)' },
];

/** Recipes are written for a standard finished output (playbook: "standardized to 10 kg"). */
export const RECIPES: Recipe[] = [
  {
    dishId: 'jeera-rice',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'raw-rice', qty: { value: 3, unit: 'kg' } }, // playbook ratio: 10 kg cooked ← 3 kg raw
      { mogId: 'ghee', qty: { value: 0.2, unit: 'kg' } },
      { mogId: 'cumin', qty: { value: 0.05, unit: 'kg' } },
      { mogId: 'salt', qty: { value: 0.08, unit: 'kg' } },
    ],
  },
  {
    dishId: 'paneer-butter-masala',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'paneer', qty: { value: 4, unit: 'kg' } },
      { mogId: 'tomato', qty: { value: 2.5, unit: 'kg' } },
      { mogId: 'onion', qty: { value: 1.5, unit: 'kg' } },
      { mogId: 'cream', qty: { value: 0.6, unit: 'kg' } },
      { mogId: 'butter', qty: { value: 0.3, unit: 'kg' } },
    ],
  },
  {
    dishId: 'dal-makhani',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'urad-whole', qty: { value: 1.6, unit: 'kg' } },
      { mogId: 'rajma', qty: { value: 0.4, unit: 'kg' } },
      { mogId: 'butter', qty: { value: 0.4, unit: 'kg' } },
      { mogId: 'cream', qty: { value: 0.5, unit: 'kg' } },
      { mogId: 'tomato', qty: { value: 1.5, unit: 'kg' } },
    ],
  },
  {
    dishId: 'achari-dal',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'toor-dal', qty: { value: 2, unit: 'kg' } },
      { mogId: 'achar-masala', qty: { value: 0.15, unit: 'kg' } },
      { mogId: 'tomato', qty: { value: 0.8, unit: 'kg' } },
    ],
  },
  {
    dishId: 'coconut-chutney',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'frozen-coconut', qty: { value: 4, unit: 'kg' } },
      { mogId: 'roasted-chana', qty: { value: 0.8, unit: 'kg' } },
      { mogId: 'green-chilli', qty: { value: 0.2, unit: 'kg' } },
      { mogId: 'salt', qty: { value: 0.08, unit: 'kg' } },
    ],
  },
  {
    dishId: 'veg-pulao',
    output: { value: 10, unit: 'kg' },
    ingredients: [
      { mogId: 'raw-rice', qty: { value: 3, unit: 'kg' } },
      { mogId: 'mixed-veg-cut', qty: { value: 1.5, unit: 'kg' } },
      { mogId: 'ghee', qty: { value: 0.25, unit: 'kg' } },
    ],
  },
];

export const DATA_SOURCES: DataSource[] = [
  { id: 'cilantro', name: 'Cilantro 3 — menus, orders, production', availability: 'available', lastUpdated: '2026-10-13T13:25', note: 'Demo snapshot. Publication, selection, projection, MR, EMR, production and indent states.' },
  { id: 'cookbook', name: 'Cookbook / MDH masters', availability: 'available', lastUpdated: '2026-10-13T02:00', note: 'Recipes and mappings arrive by nightly copy (existing). Daytime master fixes appear tomorrow.' },
  { id: 'sap', name: 'SAP purchasing & stores', availability: 'unavailable', note: 'No integration. Indent handoff to SAP is manual (existing); issuance is not visible here.' },
  { id: 'dispatch', name: 'Dispatch & delivery actuals', availability: 'unavailable', note: 'Dispatch export has Produced / Dispatched / Temperature columns, but automatic capture is unproven. Confirmations shown are manual demo entries.' },
  { id: 'approvals', name: 'EMR approval trail', availability: 'unavailable', note: 'Approvals happen by call, email or WhatsApp; no native approval record was demonstrated.' },
  { id: 'acks', name: 'Team acknowledgments', availability: 'not_confirmed', note: 'Proposed dashboard feature. Stored only in this browser for the demo.' },
];

export const DEFAULT_SETTINGS: DemoSettings = {
  unusualChangePercent: 50,
  unusualChangeMinKg: 20,
};

export const TERMS: Record<string, string> = {
  MR: 'Menu Requisition — the unit manager’s final daily order for a cafe (dishes, portions, quantities). Due D−1.',
  EMR: 'Exceptional Menu Requisition — approved late or exceptional demand, entered by the CPU team on the site’s behalf.',
  CPU: 'Central production unit — the kitchen that cooks and packs for off-site cafes.',
  indent: 'Indent — an ingredient request. Projected indent = weekly estimate; actual kitchen indent = request for final daily production.',
  STO: 'Stock transfer order in SAP — an item supplied through stores instead of the CPU.',
  MOG: 'Recipe ingredient identity used for calculation; maps to a purchase article.',
  'D−1': 'The day before service.',
  pax: 'People represented by an order. kg = pax × grams ÷ 1,000.',
};
