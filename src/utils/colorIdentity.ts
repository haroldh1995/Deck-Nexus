import type { CommanderColor, SmartBuildSuggestion } from "../types/domain";

const colorOrder: CommanderColor[] = ["W", "U", "B", "R", "G"];

export function normalizeColorIdentity(
  colors: readonly string[],
): CommanderColor[] {
  const allowed = new Set<CommanderColor>();

  for (const color of colors) {
    if (isCommanderColor(color)) {
      allowed.add(color);
    }
  }

  return colorOrder.filter((color) => allowed.has(color));
}

export function isCommanderColor(color: string): color is CommanderColor {
  return (
    color === "W" ||
    color === "U" ||
    color === "B" ||
    color === "R" ||
    color === "G"
  );
}

export function isWithinCommanderColorIdentity(
  commanderIdentity: readonly CommanderColor[],
  cardIdentity: readonly CommanderColor[],
): boolean {
  const commanderColors = new Set(commanderIdentity);
  return cardIdentity.every((color) => commanderColors.has(color));
}

export function splitSuggestionsByCommanderIdentity<
  T extends Pick<SmartBuildSuggestion, "colorIdentity">,
>(commanderIdentity: readonly CommanderColor[], suggestions: readonly T[]) {
  const accepted: T[] = [];
  const rejected: T[] = [];

  for (const suggestion of suggestions) {
    if (
      isWithinCommanderColorIdentity(
        commanderIdentity,
        suggestion.colorIdentity,
      )
    ) {
      accepted.push(suggestion);
    } else {
      rejected.push(suggestion);
    }
  }

  return { accepted, rejected };
}
