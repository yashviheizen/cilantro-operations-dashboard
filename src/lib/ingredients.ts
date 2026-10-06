// Recipe-ratio ingredient estimate for a change in finished quantity.
// Finished (cooked) weight is never treated as raw weight: we scale each
// recipe ingredient by delta ÷ recipe output, and refuse when we cannot.

import { DISHES, MOGS, RECIPES } from '../data/masters';
import type { Quantity } from '../data/types';

export interface IngredientLine {
  mogName: string;
  qty: Quantity;
  articleCode: string | null;
}

export type IngredientEstimate =
  | { complete: true; lines: IngredientLine[]; costComplete: boolean }
  | { complete: false; reason: string; lines: IngredientLine[] };

export function estimateIngredients(dishId: string, delta: Quantity): IngredientEstimate {
  const dish = DISHES.find((d) => d.id === dishId);
  const recipe = RECIPES.find((r) => r.dishId === dishId);
  if (!dish || dish.recipeStatus === 'missing' || !recipe) {
    return {
      complete: false,
      lines: [],
      reason: dish?.custom
        ? 'Custom “Other” dish — no recipe. Ingredients need an explicit plan.'
        : 'Recipe missing — ingredient calculation incomplete. No quantities are guessed.',
    };
  }
  if (recipe.output.unit !== delta.unit) {
    return { complete: false, lines: [], reason: `Units not compatible (${delta.unit} vs recipe ${recipe.output.unit}) — conversion rule not confirmed.` };
  }
  const factor = delta.value / recipe.output.value;
  const lines = recipe.ingredients.map((i) => {
    const mog = MOGS.find((m) => m.id === i.mogId)!;
    return { mogName: mog.name, articleCode: mog.articleCode, qty: { value: round(i.qty.value * factor), unit: i.qty.unit } };
  });
  return { complete: true, lines, costComplete: lines.every((l) => l.articleCode) };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Gram-portion conversions. Fractional pax are flagged — the rounding rule is not confirmed. */
export function kgFromPax(pax: number, grams: number): number {
  return (pax * grams) / 1000;
}

export function paxFromKg(kg: number, grams: number): { pax: number; fractional: boolean } {
  const pax = (kg * 1000) / grams;
  return { pax: Math.round(pax * 100) / 100, fractional: !Number.isInteger(Math.round(pax * 1e6) / 1e6) };
}
