import { Diamond, Droplet, Flame, Leaf, Skull, Sun } from "lucide-react";
import type { CommanderColor } from "../../types/domain";
import {
  getColorlessIdentityState,
  getCommanderIdentityOrbStates,
} from "./deckWorkspace";

const orbIcons: Record<CommanderColor, typeof Sun> = {
  W: Sun,
  U: Droplet,
  B: Skull,
  R: Flame,
  G: Leaf,
};

export function CommanderIdentityOrbs({
  colorIdentity,
  hasCommander,
}: {
  colorIdentity: CommanderColor[];
  hasCommander: boolean;
}) {
  const orbs = getCommanderIdentityOrbStates(colorIdentity);
  const colorless = getColorlessIdentityState(colorIdentity, hasCommander);

  return (
    <div
      className={`commander-orbit${colorIdentity.length === 5 ? " commander-orbit--five-color" : ""}`}
      aria-label="Commander color identity"
    >
      {orbs.map((orb) => {
        const Icon = orbIcons[orb.color];

        return (
          <span
            aria-label={orb.description}
            className={orb.active ? "is-active" : ""}
            data-color={orb.color}
            key={orb.color}
            role="img"
            title={orb.description}
          >
            <Icon aria-hidden="true" />
            <small>{orb.shortLabel}</small>
          </span>
        );
      })}
      <span
        aria-label={colorless.description}
        className={`commander-colorless-rune${colorless.active ? " is-active" : ""}`}
        data-color="C"
        role="img"
        title={colorless.description}
      >
        <Diamond aria-hidden="true" />
        <small>Colorless</small>
      </span>
    </div>
  );
}
