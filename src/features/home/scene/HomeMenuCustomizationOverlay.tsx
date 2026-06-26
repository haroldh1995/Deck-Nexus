import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppIcon } from "../../../components/AppIcon";
import type { HomeOrbitItem } from "../../../types/navigation";
import {
  moveHomeOrbitItem,
  permanentHomeOrbitItems,
  reorderHomeOrbitItems,
} from "../homeOrbit";

const pageSize = 6;

function getDefaultMenuOrder(items: readonly HomeOrbitItem[]) {
  const permanentOrder = new Map(
    permanentHomeOrbitItems.map((item, index) => [item.id, index]),
  );

  return [...items].sort((a, b) => {
    const aPermanentOrder = permanentOrder.get(a.id);
    const bPermanentOrder = permanentOrder.get(b.id);

    if (aPermanentOrder !== undefined && bPermanentOrder !== undefined) {
      return aPermanentOrder - bPermanentOrder;
    }

    if (aPermanentOrder !== undefined) {
      return -1;
    }

    if (bPermanentOrder !== undefined) {
      return 1;
    }

    return items.indexOf(a) - items.indexOf(b);
  });
}

function areArraysEqual(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function normalizeHiddenIds(ids: readonly string[]) {
  return [...new Set(ids)].sort();
}

export function HomeMenuCustomizationOverlay({
  hiddenItemIds,
  items,
  onCancel,
  onSave,
}: {
  hiddenItemIds: readonly string[];
  items: readonly HomeOrbitItem[];
  onCancel: () => void;
  onSave: (nextOrderIds: string[], nextHiddenIds: string[]) => Promise<void>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [draftItems, setDraftItems] = useState(() => [...items]);
  const [draftHiddenIds, setDraftHiddenIds] = useState(
    () => new Set(hiddenItemIds),
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("Customize the floating Home menu.");

  const pageCount = Math.max(1, Math.ceil(draftItems.length / pageSize));
  const boundedPage = Math.min(page, pageCount - 1);
  const visibleItems = draftItems.slice(
    boundedPage * pageSize,
    boundedPage * pageSize + pageSize,
  );

  const initialOrderIds = useMemo(() => items.map((item) => item.id), [items]);
  const initialHiddenIds = useMemo(
    () => normalizeHiddenIds(hiddenItemIds),
    [hiddenItemIds],
  );
  const draftOrderIds = draftItems.map((item) => item.id);
  const normalizedDraftHiddenIds = normalizeHiddenIds([...draftHiddenIds]);
  const hasChanges =
    !areArraysEqual(initialOrderIds, draftOrderIds) ||
    !areArraysEqual(initialHiddenIds, normalizedDraftHiddenIds);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function moveItem(itemId: string, direction: -1 | 1) {
    setDraftItems((current) => moveHomeOrbitItem(current, itemId, direction));
    setStatus(
      direction === -1
        ? "Menu item moved earlier."
        : "Menu item moved later.",
    );
  }

  function toggleHidden(item: HomeOrbitItem) {
    if (item.kind === "permanent") {
      return;
    }

    setDraftHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
        setStatus(`${item.label} restored to Home.`);
      } else {
        next.add(item.id);
        setStatus(`${item.label} hidden from Home.`);
      }
      return next;
    });
  }

  function restoreDefaultOrder() {
    if (hasChanges && !window.confirm("Restore the default Home menu order?")) {
      return;
    }

    setDraftItems(getDefaultMenuOrder(items));
    setDraftHiddenIds(new Set());
    setPage(0);
    setStatus("Default Home menu order restored.");
  }

  async function save() {
    await onSave(draftOrderIds, normalizedDraftHiddenIds);
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      aria-labelledby="home-menu-customizer-title"
      aria-modal="true"
      className="home-menu-overlay"
      onKeyDown={trapFocus}
      ref={overlayRef}
      role="dialog"
    >
      <div className="home-menu-overlay__panel">
        <header className="home-menu-overlay__header">
          <button
            aria-label="Close Home menu customization"
            onClick={onCancel}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
          <h2 id="home-menu-customizer-title">Customize Home Menu</h2>
          <button onClick={() => void save()} type="button">
            <Save aria-hidden="true" />
            <span>Save</span>
          </button>
        </header>

        <div className="home-menu-overlay__grid" data-testid="home-menu-grid">
          {visibleItems.map((item) => {
            const isHidden = draftHiddenIds.has(item.id);
            const globalIndex = draftItems.findIndex(
              (draftItem) => draftItem.id === item.id,
            );
            const canMoveEarlier = globalIndex > 0;
            const canMoveLater = globalIndex < draftItems.length - 1;
            const permanent = item.kind === "permanent";

            return (
              <article
                className={`home-menu-overlay__item${
                  isHidden ? " is-hidden" : ""
                }`}
                draggable
                key={item.id}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDraggedId(item.id)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId) {
                    setDraftItems((current) =>
                      reorderHomeOrbitItems(current, draggedId, item.id),
                    );
                    setStatus("Menu item reordered.");
                  }
                  setDraggedId(null);
                }}
              >
                <GripVertical aria-hidden="true" className="drag-rune" />
                <AppIcon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {permanent ? "Permanent" : isHidden ? "Favorite hidden" : "Favorite"}
                  </small>
                </span>
                <div className="home-menu-overlay__controls">
                  <button
                    aria-label={`Move ${item.label} earlier`}
                    disabled={!canMoveEarlier}
                    onClick={() => moveItem(item.id, -1)}
                    type="button"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Move ${item.label} later`}
                    disabled={!canMoveLater}
                    onClick={() => moveItem(item.id, 1)}
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    aria-label={
                      permanent
                        ? `${item.label} is required`
                        : isHidden
                          ? `Show ${item.label} on Home`
                          : `Hide ${item.label} from Home`
                    }
                    disabled={permanent}
                    onClick={() => toggleHidden(item)}
                    type="button"
                  >
                    {isHidden ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="home-menu-overlay__footer">
          <button onClick={restoreDefaultOrder} type="button">
            <RotateCcw aria-hidden="true" />
            <span>Restore Default</span>
          </button>
          {pageCount > 1 ? (
            <div className="home-menu-overlay__pages">
              <button
                disabled={boundedPage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span>
                {boundedPage + 1} / {pageCount}
              </span>
              <button
                disabled={boundedPage === pageCount - 1}
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="home-menu-overlay__save"
            disabled={!hasChanges}
            onClick={() => void save()}
            type="button"
          >
            Save Order
          </button>
        </footer>

        <p aria-live="polite" className="sr-only">
          {status}
        </p>
      </div>
    </div>
  );
}
