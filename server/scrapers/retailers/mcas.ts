import { fetchStatic, parseHtml } from "../http";
import { normalizeAttr } from "../normalize";
import type { ScrapedOffer, RetailerScraper } from "../types";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

const BASE = "https://www.mcas.com.au";

export const mcasCategoryPaths: Record<string, string[]> = {
  helmets: [
    "/all-products/motorcycle-dirt-bike-gear/dirt-bike-helmets/",
    "/all-products/road-motorcycle-gear/road-helmets/",
  ],
  gloves: [
    "/all-products/motorcycle-dirt-bike-gear/dirt-bike-gloves/",
    "/all-products/road-motorcycle-gear/motorcycle-gloves/",
  ],
  boots: [
    "/all-products/motorcycle-dirt-bike-gear/mx-boots/",
    "/all-products/road-motorcycle-gear/motorcycle-boots/",
  ],
  jackets: ["/all-products/dirt/jackets-vests/", "/all-products/road/jackets-vests/"],
  pants: [
    "/all-products/motorcycle-dirt-bike-gear/dirt-bike-pants/",
    "/all-products/road-motorcycle-gear/pants/",
  ],
  armour: [
    "/all-products/motorcycle-dirt-bike-gear/motorcycle-body-armour/",
    "/all-products/road-motorcycle-gear/body-armour/knee-armour/",
    "/all-products/road-motorcycle-gear/body-armour/shoulder-elbow-armour/",
    "/all-products/road-motorcycle-gear/body-armour/hip-armour/",
  ],
};

export interface McasTile {
  brandName: string;
  productName: string;
  url: string;
  priceCents: number | null;
  imageUrl?: string;
}

interface McasJsonLd {
  "@type"?: string;
  name?: string;
  color?: string;
  image?: { contentUrl?: string }[];
}

export function parseCents(display: string | undefined): number | null {
  if (!display) return null;
  const m = display.match(/^\s*\$?\s*(\d{1,6})(?:\.(\d{2}))?\s*$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2] ?? "0");
}

function lenientJsonParse(text: string): McasJsonLd | null {
  try {
    return JSON.parse(text.replace(/[\u0000-\u001F]/g, " ")) as McasJsonLd;
  } catch {
    return null;
  }
}

/** Parses MCAS category listing tiles (schema.org Product microdata). */
export function parseCategoryTiles($: CheerioAPI): McasTile[] {
  const tiles: McasTile[] = [];
  $("[itemtype*='schema.org/Product']").each((_: number, el: Element) => {
    const tile = $(el);
    const brandName = tile.find("meta[itemprop='brand']").attr("content");
    const productName = tile.find("[itemprop='name']").text().trim();
    const url = tile.find("a.thumbnail-image").attr("href");
    const image = tile.find("img[itemprop='image']").attr("src");
    const price = tile.find("span[itemprop='price']").attr("content");
    if (!brandName || !productName || !url) return;
    tiles.push({
      brandName: normalizeAttr(brandName),
      productName,
      url,
      priceCents: parseCents(price),
      imageUrl: image ? new URL(image, BASE).href : undefined,
    });
  });
  return tiles;
}

/** Parses one MCAS product page: JSON-LD name/colour + selected size + price + stock. */
export function parseProductPage($: CheerioAPI, tile: McasTile, categorySlug: string): ScrapedOffer | null {
  const jsonLd = $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => lenientJsonParse($(el).text()))
    .find((d) => d?.["@type"] === "Product");
  if (!jsonLd?.name) return null;
  const h1 = $("h1[itemprop='name']").first().text().trim();
  const suffix = h1.toLowerCase().startsWith(jsonLd.name.toLowerCase())
    ? h1.slice(jsonLd.name.length).replace(/^[\s-]+/, "")
    : "";
  const parts = suffix.split(/\s+-\s+/).filter(Boolean);
  const jsonColour = jsonLd.color ? normalizeAttr(jsonLd.color) : undefined;
  let colour = jsonColour;
  let size = "";
  if (parts.length === 1) {
    size = parts[0];
  } else if (parts.length > 1) {
    if (!colour) colour = parts[parts.length - 1];
    size = parts
      .filter((p) => !colour || normalizeAttr(p) !== colour)
      .join(" ");
  }
  const priceContent = $("*[itemprop='price']").first().attr("content");
  const availability = $("span[itemprop='availability']").first().attr("content") ?? "";
  return {
    brandName: tile.brandName,
    productName: jsonLd.name,
    categorySlug,
    colour: colour ?? undefined,
    size: size ? normalizeAttr(size) : undefined,
    url: tile.url,
    priceCents: parseCents(priceContent),
    inStock: availability.includes("InStock"),
    imageUrl: jsonLd.image?.[0]?.contentUrl ?? tile.imageUrl,
  };
}

export const DEFAULT_PRODUCT_LIMIT = 150;

export const mcasScraper: RetailerScraper = {
  id: "mcas",
  async scrape(limit: number = DEFAULT_PRODUCT_LIMIT): Promise<ScrapedOffer[]> {
    const offers: ScrapedOffer[] = [];
    outer: for (const [categorySlug, paths] of Object.entries(mcasCategoryPaths)) {
      const tiles = new Map<string, McasTile>();
      for (const path of paths) {
        try {
          const $ = parseHtml(await fetchStatic(`${BASE}${path}`));
          for (const tile of parseCategoryTiles($)) {
            if (!tiles.has(tile.url)) tiles.set(tile.url, tile);
          }
        } catch (err) {
          console.warn(`[mcas] category ${path} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      for (const tile of tiles.values()) {
        if (offers.length >= limit) break outer;
        try {
          const $ = parseHtml(await fetchStatic(tile.url));
          const offer = parseProductPage($, tile, categorySlug);
          if (offer) offers.push(offer);
        } catch (err) {
          console.warn(`[mcas] product ${tile.url} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    return offers;
  },
};
