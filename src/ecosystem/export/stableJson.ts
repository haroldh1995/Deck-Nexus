export function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortForStableJson(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        if (typeof record[key] !== "undefined") {
          sorted[key] = sortForStableJson(record[key]);
        }
        return sorted;
      }, {});
  }

  return value;
}

export function stableStringify(value: unknown, space?: number): string {
  return JSON.stringify(sortForStableJson(value), null, space);
}

export function stripChecksumFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripChecksumFields(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((stripped, key) => {
        if (key === "checksum" || key === "snapshotHash") {
          stripped[key] = null;
        } else if (typeof record[key] !== "undefined") {
          stripped[key] = stripChecksumFields(record[key]);
        }
        return stripped;
      }, {});
  }

  return value;
}
