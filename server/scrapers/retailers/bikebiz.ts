import { fetchStatic, parseHtml } from "../http";
import { normalizeAttr } from "../normalize";
import type { ScrapedOffer, RetailerScraper } from "../types";

const BASE = "https://www.bikebiz.com.au";
const MAX_PAGES_PER_CATEGORY = 5;

export const bikebizCategoryPaths: Record<string, string[]> = {
  helmets: ["/mx-gear/mx-helmets", "/road-gear/road-helmets"],
  gloves: ["/mx-gear/mx-gloves", "/road-gear/road-gloves"],
  boots: ["/mx-gear/mx-boots", "/road-gear/road-boots"],
  jackets: ["/road-gear/road-jackets"],
  pants: ["/mx-gear/mx-pants", "/road-gear/road-pants"],
  armour: ["/mx-gear/mx-protection", "/road-gear/road-protection"],
};

interface BikebizVariant {
  name?: string;
  color?: string;
  size?: string;
  brand?: { name?: string };
  image?: string | { contentUrl?: string };
  offers?: { price?: string; availability?: string };
}

interface BikebizProductGroup {
  "@type"?: string;
  name?: string;
  hasVariant?: BikebizVariant[];
}

export function parseCents(display: string | undefined): number | null {
  if (!display) return null;
  const m = display.match(/^\s*\$?\s*(\d{1,6})(?:\.(\d{2}))?\s*$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2] ?? "0");
}

function jsonLdBlocks(html: string): unknown[] {
  const $ = parseHtml(html);
  return $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => {
      try {
        return JSON.parse($(el).text().replace(/[\u0000-\u001F]/g, " "));
      } catch {
        return null;
      }
    })
    .filter((d) => d !== null);
}

/** Extracts product URLs from a Bikebiz CollectionPage category listing. */
export function parseCategoryUrls(html: string): string[] {
  const list = jsonLdBlocks(html)
    .map((d) => d as { "@type"?: string; mainEntity?: { itemListElement?: { url?: string }[] } })
    .find((d) => d["@type"] === "CollectionPage");
  const urls = (list?.mainEntity?.itemListElement ?? [])
    .map((item) => item?.url)
    .filter((u): u is string => !!u);
  return urls;
}

export function nextPageUrl(html: string): string | null {
  const $ = parseHtml(html);
  return $('link[rel="next"]').attr("href") ?? null;
}

/** Parses a Bikebiz product page into one offer per ProductGroup variant. */
export function parseProduct(html: string, url: string, categorySlug: string): ScrapedOffer[] {
  const group = jsonLdBlocks(html)
    .map((d) => d as BikebizProductGroup)
    .find((d) => d["@type"] === "ProductGroup");
  if (!group?.name) return [];
  const offers: ScrapedOffer[] = [];
  for (const v of group.hasVariant ?? []) {
    const brandName = v.brand?.name;
    const offer = v.offers;
    if (!brandName || !offer?.price) continue;
    const imageUrl = typeof v.image === "string" ? v.image : v.image?.contentUrl;
    offers.push({
      brandName: normalizeAttr(brandName),
      productName: group.name!,
      categorySlug,
      colour: v.color ? normalizeAttr(v.color) : undefined,
      size: v.size ? normalizeAttr(v.size) : undefined,
      url,
      priceCents: parseCents(offer.price),
      inStock: (offer.availability ?? "").includes("InStock"),
      imageUrl,
    });
  }
  return offers;
}

async function categoryProductUrls(path: string): Promise<string[]> {
  const urls = new Set<string>();
  let next: string | null = `${BASE}${path}`;
  for (let page = 0; page < MAX_PAGES_PER_CATEGORY && next; page++) {
    const html = await fetchStatic(next);
    for (const url of parseCategoryUrls(html)) urls.add(url);
    next = nextPageUrl(html);
  }
  return [...urls];
}

export const DEFAULT_PRODUCT_LIMIT = 150;

export const bikebizScraper: RetailerScraper = {
  id: "bikebiz",
  async scrape(limit: number = DEFAULT_PRODUCT_LIMIT): Promise<ScrapedOffer[]> {
    const offers: ScrapedOffer[] = [];
    outer: for (const [categorySlug, paths] of Object.entries(bikebizCategoryPaths)) {
      const productUrls = new Set<string>();
      for (const path of paths) {
        try {
          for (const url of await categoryProductUrls(path)) productUrls.add(url);
        } catch (err) {
          console.warn(`[bikebiz] category ${path} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      for (const url of productUrls) {
        if (offers.length >= limit) break outer;
        try {
          const html = await fetchStatic(url);
          for (const offer of parseProduct(html, url, categorySlug)) offers.push(offer);
        } catch (err) {
          console.warn(`[bikebiz] product ${url} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    return offers;
  },
};
