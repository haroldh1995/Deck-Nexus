import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Heart, Sparkles } from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { db } from "../../db/database";
import type {
  CustomCollection,
  CustomCollectionEntry,
  UpgradeList,
  UpgradeListEntry,
  WishlistEntry,
} from "../../types/domain";

type DirectoryKind = "wishlist" | "upgradeLists" | "collections";

interface CardDirectoriesScreenProps {
  kind: DirectoryKind;
}

function getDirectoryTitle(kind: DirectoryKind): string {
  if (kind === "wishlist") return "Wishlist";
  if (kind === "upgradeLists") return "Upgrade Lists";
  return "Custom Collections";
}

function getDirectorySummary(kind: DirectoryKind): string {
  if (kind === "wishlist") {
    return "Wanted cards for planning. No prices, vendors, or marketplace links.";
  }
  if (kind === "upgradeLists") {
    return "Deck-specific and general upgrade plans created from Search.";
  }
  return "Local card directories such as Staples, Future Commanders, or research lists.";
}

function DirectoryIcon({ kind }: { kind: DirectoryKind }) {
  if (kind === "wishlist") {
    return <Heart aria-hidden="true" />;
  }
  if (kind === "upgradeLists") {
    return <Sparkles aria-hidden="true" />;
  }
  return <Archive aria-hidden="true" />;
}

export function CardDirectoriesScreen({ kind }: CardDirectoriesScreenProps) {
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [upgradeLists, setUpgradeLists] = useState<UpgradeList[]>([]);
  const [upgradeEntries, setUpgradeEntries] = useState<UpgradeListEntry[]>([]);
  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [collectionEntries, setCollectionEntries] = useState<CustomCollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const [nextWishlist, nextUpgradeLists, nextUpgradeEntries, nextCollections, nextCollectionEntries] =
        await Promise.all([
          db.wishlist.orderBy("updatedAt").reverse().toArray(),
          db.upgradeLists.orderBy("updatedAt").reverse().toArray(),
          db.upgradeListEntries.orderBy("updatedAt").reverse().toArray(),
          db.customCollections.orderBy("updatedAt").reverse().toArray(),
          db.customCollectionEntries.orderBy("updatedAt").reverse().toArray(),
        ]);

      if (mounted) {
        setWishlist(nextWishlist);
        setUpgradeLists(nextUpgradeLists);
        setUpgradeEntries(nextUpgradeEntries);
        setCollections(nextCollections);
        setCollectionEntries(nextCollectionEntries);
        setLoading(false);
      }
    }

    void refresh();
    window.addEventListener("deck-nexus:directories-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:directories-updated", refresh);
    };
  }, []);

  const title = getDirectoryTitle(kind);

  return (
    <div className="screen directory-screen">
      <PageHeader title={title}>
        <Link className="secondary-action" to="/search">
          Add From Search
        </Link>
      </PageHeader>

      <HolographicPanel className="directory-summary">
        <DirectoryIcon kind={kind} />
        <div>
          <h2>{title}</h2>
          <p>{getDirectorySummary(kind)}</p>
        </div>
      </HolographicPanel>

      {loading ? (
        <HolographicPanel>
          <p className="foundation-summary">Loading local directory records.</p>
        </HolographicPanel>
      ) : null}

      {!loading && kind === "wishlist" ? (
        wishlist.length === 0 ? (
          <HolographicPanel>
            <div className="empty-panel">
              <h2>No wishlist cards yet</h2>
              <p>Add cards from Search to start planning future copies.</p>
              <Link className="primary-action" to="/search">
                Search Cards
              </Link>
            </div>
          </HolographicPanel>
        ) : (
          <div className="directory-list">
            {wishlist.map((entry) => (
              <HolographicPanel as="article" variant="card" className="directory-card" key={entry.id}>
                <div>
                  <h2>{entry.cardName}</h2>
                  <p>Desired quantity {entry.desiredQuantity} · Acquired {entry.acquiredQuantity}</p>
                  <small>{entry.sourceQuery ? `Source search: ${entry.sourceQuery}` : "Added locally"}</small>
                </div>
                <StatusPill tone={entry.priority === "essential" || entry.priority === "high" ? "violet" : "cyan"}>
                  {entry.priority}
                </StatusPill>
              </HolographicPanel>
            ))}
          </div>
        )
      ) : null}

      {!loading && kind === "upgradeLists" ? (
        upgradeLists.length === 0 ? (
          <HolographicPanel>
            <div className="empty-panel">
              <h2>No upgrade lists yet</h2>
              <p>Create one through Search Add To, Analyzer, or deck planning.</p>
              <Link className="primary-action" to="/search">
                Search Cards
              </Link>
            </div>
          </HolographicPanel>
        ) : (
          <div className="directory-list">
            {upgradeLists.map((list) => {
              const count = upgradeEntries.filter((entry) => entry.upgradeListId === list.id).length;
              return (
                <HolographicPanel as="article" variant="card" className="directory-card" key={list.id}>
                  <div>
                    <h2>{list.name}</h2>
                    <p>{list.description || "Upgrade planning list"}</p>
                    <small>{count} card{count === 1 ? "" : "s"} · {list.relatedDeckId ? "Deck-specific" : "General"}</small>
                  </div>
                  <StatusPill tone={list.favorite ? "violet" : "cyan"}>
                    {list.favorite ? "Favorite" : "Planning"}
                  </StatusPill>
                </HolographicPanel>
              );
            })}
          </div>
        )
      ) : null}

      {!loading && kind === "collections" ? (
        collections.length === 0 ? (
          <HolographicPanel>
            <div className="empty-panel">
              <h2>No custom collections yet</h2>
              <p>Create local directories from Search without affecting ownership or deck counts.</p>
              <Link className="primary-action" to="/search">
                Search Cards
              </Link>
            </div>
          </HolographicPanel>
        ) : (
          <div className="directory-list">
            {collections.map((collection) => {
              const count = collectionEntries.filter((entry) => entry.collectionId === collection.id).length;
              return (
                <HolographicPanel as="article" variant="card" className="directory-card" key={collection.id}>
                  <div>
                    <h2>{collection.name}</h2>
                    <p>{collection.description || "Custom local card directory"}</p>
                    <small>{count} card{count === 1 ? "" : "s"} · Sort: {collection.sortMode}</small>
                  </div>
                  <StatusPill tone={collection.favorite ? "violet" : "cyan"}>
                    {collection.favorite ? "Favorite" : "Collection"}
                  </StatusPill>
                </HolographicPanel>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
