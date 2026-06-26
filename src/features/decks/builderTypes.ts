import type { Bracket, CommanderColor, DeckCard } from "../../types/domain";

export type BuilderSectionId =
  | "commander"
  | "creatures"
  | "instants"
  | "sorceries"
  | "artifacts"
  | "enchantments"
  | "otherPermanents"
  | "lands";

export type BuilderTab = "main" | "maybeboard" | "cuts";

export type RuleEnforcementMode = "guided" | "strict" | "sandbox";

export type SectionHealth = "normal" | "attention" | "serious" | "protected";

export type AddDestination = "main" | "maybeboard" | "cuts";

export interface ManualCardInput {
  name: string;
  manaCost?: string;
  typeLine: string;
  oracleText?: string;
  colorIdentity: CommanderColor[];
  roleTags: string[];
  customTags: string[];
  notes?: string;
  owned: boolean;
  destination: AddDestination;
  requestedSection?: BuilderSectionId;
}

export interface BuiltDeckCard extends DeckCard {
  typeLine: string;
  colorIdentity: CommanderColor[];
}

export interface RuleWarning {
  id: string;
  severity: "warning" | "illegal";
  message: string;
}

export interface AddCardRuleResult {
  enforcementMode: RuleEnforcementMode;
  legal: boolean;
  blocked: boolean;
  warnings: RuleWarning[];
}

export interface BracketFactor {
  label: string;
  count: number;
  impact: number;
  tone: "normal" | "attention" | "serious" | "boost";
}

export interface LiveBracketAnalysis {
  selectedBracket: Bracket;
  estimatedBracket: Bracket;
  drift: number;
  confidence: "Low" | "Medium" | "High";
  factors: BracketFactor[];
  cardImpacts: Record<string, number>;
  meterTone: "normal" | "within" | "attention" | "serious" | "maximum";
}

export const builderSections: {
  id: BuilderSectionId;
  label: string;
  shortLabel: string;
  glyph: string;
}[] = [
  { id: "commander", label: "Commander", shortLabel: "Commander", glyph: "CM" },
  { id: "creatures", label: "Creatures", shortLabel: "Creatures", glyph: "CR" },
  { id: "instants", label: "Instants", shortLabel: "Instants", glyph: "IN" },
  { id: "sorceries", label: "Sorceries", shortLabel: "Sorceries", glyph: "SO" },
  { id: "artifacts", label: "Artifacts", shortLabel: "Artifacts", glyph: "AR" },
  {
    id: "enchantments",
    label: "Enchantments",
    shortLabel: "Enchantments",
    glyph: "EN",
  },
  {
    id: "otherPermanents",
    label: "Other Permanents",
    shortLabel: "Other",
    glyph: "OP",
  },
  { id: "lands", label: "Lands", shortLabel: "Lands", glyph: "LA" },
];

export const mainBuilderSectionIds: BuilderSectionId[] = [
  "creatures",
  "instants",
  "sorceries",
  "artifacts",
  "enchantments",
  "otherPermanents",
  "lands",
];
