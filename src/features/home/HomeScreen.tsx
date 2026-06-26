import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/AppIcon";
import { useSettings } from "../../app/useSettings";
import { useDecks } from "../../db/hooks";
import { listFavorites } from "../../db/repositories";
import type { FavoriteItem } from "../../types/domain";
import type { HomeOrbitItem } from "../../types/navigation";
import {
  buildHomeOrbitItems,
  moveHomeOrbitItem,
  reorderHomeOrbitItems,
} from "./homeOrbit";

export function HomeScreen() {
  const { settings, updateSettings } = useSettings();
  const { decks } = useDecks();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orbitOffset, setOrbitOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("create-deck");
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refreshFavorites() {
      const nextFavorites = await listFavorites();
      if (mounted) {
        setFavorites(nextFavorites);
      }
    }

    void refreshFavorites();

    return () => {
      mounted = false;
    };
  }, []);

  const orbitItems = useMemo(
    () => buildHomeOrbitItems(favorites, settings.homeOrbitOrder),
    [favorites, settings.homeOrbitOrder],
  );

  const activeSelectedId = orbitItems.some((item) => item.id === selectedId)
    ? selectedId
    : orbitItems[0]?.id ?? "";

  const staticHome = settings.staticHomeScreen || settings.reducedMotion;
  const hasDecks = decks.length > 0;

  async function persistOrbitOrder(nextItems: HomeOrbitItem[]) {
    await updateSettings({
      homeOrbitOrder: nextItems.map((item) => item.id),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (staticHome) {
      return;
    }
    dragStartX.current = event.clientX;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (staticHome || dragStartX.current === null) {
      return;
    }
    const delta = event.clientX - dragStartX.current;
    dragStartX.current = event.clientX;
    setOrbitOffset((current) => current + delta * 0.22);
  }

  function handlePointerUp() {
    dragStartX.current = null;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (staticHome) {
      return;
    }
    setOrbitOffset((current) => current - event.deltaY * 0.08);
  }

  async function moveSelected(direction: -1 | 1) {
    const nextItems = moveHomeOrbitItem(orbitItems, activeSelectedId, direction);
    await persistOrbitOrder(nextItems);
  }

  async function handleDrop(targetId: string) {
    if (!draggedId) {
      return;
    }

    const nextItems = reorderHomeOrbitItems(orbitItems, draggedId, targetId);
    setDraggedId(null);
    await persistOrbitOrder(nextItems);
  }

  return (
    <div className="home-screen">
      <section
        className={`nexus-orbit${staticHome ? " nexus-orbit--static" : ""}`}
        aria-label="Commander Nexus navigation orbit"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="rune-disc rune-disc--upper" aria-hidden="true" />
        <div className="rune-disc rune-disc--lower" aria-hidden="true" />
        <div className="nexus-beam" aria-hidden="true" />

        <div className="nexus-core" aria-live="polite">
          <div className="nexus-core__crystal" aria-hidden="true" />
          <h1>{hasDecks ? "Commander Nexus" : "No decks summoned"}</h1>
          <p>
            {hasDecks
              ? `${decks.length} local Commander deck${
                  decks.length === 1 ? "" : "s"
                } anchored`
              : "Create or import your first Commander deck"}
          </p>
        </div>

        <div className="orbit-card-field">
          {orbitItems.map((item, index) => {
            const angle = (index / orbitItems.length) * 360 + orbitOffset;
            const style = {
              "--angle": `${angle}deg`,
              "--card-index": index,
            } as CSSProperties;

            return (
              <Link
                className="orbit-card"
                data-kind={item.kind}
                draggable
                key={item.id}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  setDraggedId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDrop={() => void handleDrop(item.id)}
                onFocus={() => setSelectedId(item.id)}
                style={style}
                to={item.route}
              >
                <span className="orbit-card__runes" aria-hidden="true" />
                <AppIcon name={item.icon} />
                <strong>{item.label}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="orbit-order-panel" aria-label="Orbit order controls">
        <label htmlFor="orbit-order-select">Orbit order</label>
        <select
          id="orbit-order-select"
          onChange={(event) => setSelectedId(event.target.value)}
          value={activeSelectedId}
        >
          {orbitItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Move selected orbit card earlier"
          title="Move earlier"
          type="button"
          onClick={() => void moveSelected(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          aria-label="Move selected orbit card later"
          title="Move later"
          type="button"
          onClick={() => void moveSelected(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
