export function fmtPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function variantLabel(colour: string, size: string): string {
  return [colour, size].filter(Boolean).join(" / ") || "—";
}
