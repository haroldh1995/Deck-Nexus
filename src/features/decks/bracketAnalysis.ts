import type { Bracket, Deck } from "../../types/domain";
import { getMainDeckCards } from "./cardClassification";
import type { BracketFactor, LiveBracketAnalysis } from "./builderTypes";

const bracketValues: Record<Bracket, number> = {
  bracket_1: 1,
  bracket_2: 2,
  bracket_3: 3,
  bracket_4: 4,
  bracket_5: 5,
  custom: 3,
};

function bracketFromValue(value: number): Bracket {
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  return `bracket_${rounded}` as Bracket;
}

function hasTag(deckCardTags: readonly string[], expected: string): boolean {
  const normalizedExpected = expected.toLowerCase();
  return deckCardTags.some((tag) =>
    tag.toLowerCase().includes(normalizedExpected),
  );
}

function getCombinedTags(card: { roleTags: string[]; customTags: string[] }) {
  return [...card.roleTags, ...card.customTags];
}

function parseManaValue(manaCost?: string): number | undefined {
  if (!manaCost) {
    return undefined;
  }

  const generic = [...manaCost.matchAll(/\{(\d+)\}/g)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  const symbolCount = [...manaCost.matchAll(/\{[WUBRGCX/]+\}/g)].length;
  return generic + symbolCount;
}

function makeFactor(
  label: string,
  count: number,
  impact: number,
  tone: BracketFactor["tone"],
): BracketFactor {
  return { label, count, impact, tone };
}

export function analyzeLiveBracket(deck: Deck): LiveBracketAnalysis {
  const cards = getMainDeckCards(deck.cards);
  const nonCommanderCards = cards.filter((card) => card.section !== "commander");
  const cardImpacts: Record<string, number> = {};

  let fastMana = 0;
  let tutors = 0;
  let combos = 0;
  let stax = 0;
  let interaction = 0;
  let synergy = 0;
  let ramp = 0;
  let draw = 0;
  let removal = 0;
  let offTheme = 0;
  let manaTotal = 0;
  let manaSamples = 0;

  for (const card of nonCommanderCards) {
    const tags = getCombinedTags(card);
    let impact = 0;

    if (hasTag(tags, "fast mana")) {
      fastMana += 1;
      impact += 0.55;
    }
    if (hasTag(tags, "tutor")) {
      tutors += 1;
      impact += 0.35;
    }
    if (hasTag(tags, "combo")) {
      combos += 1;
      impact += 0.5;
    }
    if (hasTag(tags, "stax")) {
      stax += 1;
      impact += 0.42;
    }
    if (
      hasTag(tags, "interaction") ||
      hasTag(tags, "counter") ||
      hasTag(tags, "removal")
    ) {
      interaction += 1;
      impact += 0.12;
    }
    if (hasTag(tags, "synergy")) {
      synergy += 1;
      impact += 0.08;
    }
    if (hasTag(tags, "ramp")) {
      ramp += 1;
    }
    if (hasTag(tags, "draw")) {
      draw += 1;
    }
    if (hasTag(tags, "removal")) {
      removal += 1;
    }
    if (hasTag(tags, "off-theme")) {
      offTheme += 1;
      impact -= 0.1;
    }

    const manaValue = parseManaValue(card.manaCost);
    if (manaValue !== undefined) {
      manaSamples += 1;
      manaTotal += manaValue;
    }

    cardImpacts[card.id] = Number((card.bracketImpact ?? impact).toFixed(2));
  }

  const cardCount = nonCommanderCards.length || 1;
  const averageManaValue = manaSamples > 0 ? manaTotal / manaSamples : 3.4;
  const interactionDensity = interaction / cardCount;
  const synergyDensity = synergy / cardCount;
  const consistencyPressure = tutors + synergy + combos;
  const missingCore = [
    ramp < 8 ? 1 : 0,
    draw < 8 ? 1 : 0,
    removal < 6 ? 1 : 0,
  ].reduce((total, value) => total + value, 0);

  let score = 1.2;
  score += fastMana * 0.38;
  score += tutors * 0.22;
  score += combos * 0.35;
  score += stax * 0.28;
  score += interactionDensity > 0.16 ? 0.45 : 0;
  score += synergyDensity > 0.32 ? 0.35 : 0;
  score += averageManaValue <= 2.45 ? 0.45 : 0;
  score += consistencyPressure >= 10 ? 0.35 : 0;
  score -= offTheme * 0.06;
  score -= missingCore * 0.12;

  const factors: BracketFactor[] = [
    makeFactor("Fast mana tags", fastMana, fastMana * 0.38, "serious"),
    makeFactor("Tutor tags", tutors, tutors * 0.22, "attention"),
    makeFactor("Combo tags", combos, combos * 0.35, "serious"),
    makeFactor("Stax tags", stax, stax * 0.28, "attention"),
    makeFactor(
      "Interaction density",
      interaction,
      interactionDensity > 0.16 ? 0.45 : 0.1,
      "boost",
    ),
    makeFactor(
      "Synergy density",
      synergy,
      synergyDensity > 0.32 ? 0.35 : 0.1,
      "normal",
    ),
    makeFactor(
      "Missing ramp/draw/removal",
      missingCore,
      -missingCore * 0.12,
      "attention",
    ),
  ];

  const estimatedBracket = bracketFromValue(score);
  const selectedBracket = deck.bracketLock.bracket;
  const selectedValue = bracketValues[selectedBracket];
  const estimatedValue = bracketValues[estimatedBracket];
  const drift = estimatedValue - selectedValue;
  const confidence =
    nonCommanderCards.length >= 80
      ? "High"
      : nonCommanderCards.length >= 35
        ? "Medium"
        : "Low";

  const meterTone =
    estimatedValue === 5
      ? "maximum"
      : deck.bracketLock.enabled && drift > 0
        ? "serious"
        : deck.bracketLock.enabled && drift === 0
          ? "within"
          : Math.abs(drift) >= 1
            ? "attention"
            : "normal";

  return {
    selectedBracket,
    estimatedBracket,
    drift,
    confidence,
    factors,
    cardImpacts,
    meterTone,
  };
}

export function formatBracket(bracket: Bracket): string {
  if (bracket === "custom") {
    return "Custom";
  }

  return bracket.replace("bracket_", "Bracket ");
}
