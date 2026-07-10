import { stableStringify, stripChecksumFields } from "./stableJson";

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

export function checksumText(text: string): string {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return `dnx-${hash.toString(16).padStart(16, "0")}`;
}

export function checksumObject(value: unknown): string {
  return checksumText(stableStringify(stripChecksumFields(value)));
}

export function withChecksum<T extends { checksum: string | null }>(value: T): T {
  return {
    ...value,
    checksum: checksumObject(value),
  };
}
