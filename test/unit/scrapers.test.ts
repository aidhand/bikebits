import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCents, parseCategoryTiles, parseProductPage } from "../../server/scrapers/retailers/mcas";
import { parseCents as bbParseCents, parseCategoryUrls, parseProduct } from "../../server/scrapers/retailers/bikebiz";
import { parseHtml } from "../../server/scrapers/http";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const wrapScript = (body: string) =>
  `<html><body><script type="application/ld+json">${body}</script></body></html>`;

describe("parseCents", () => {
  it.each([
    ["37.95", 3795],
    ["$449.99", 44999],
    ["12", 1200],
    [" 9.50 ", 950],
    ["not a price", null],
    ["", null],
    [undefined, null],
  ])("%s → %s", (input, expected) => {
    expect(parseCents(input as string | undefined)).toBe(expected);
    expect(bbParseCents(input as string | undefined)).toBe(expected);
  });
});

describe("bikebiz parser", () => {
  it("extracts product URLs from a CollectionPage listing", () => {
    const html = wrapScript(fixture("bikebiz-collectionpage.jsonld"));
    const urls = parseCategoryUrls(html);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toMatch(/^https:\/\/www\.bikebiz\.com\.au\/products\//);
  });

  it("emits one offer per ProductGroup variant", () => {
    const url = "https://www.bikebiz.com.au/products/alpinestars-s-m7-core-helmet";
    const offers = parseProduct(wrapScript(fixture("bikebiz-productgroup.jsonld")), url, "helmets");
    expect(offers.length).toBe(12);
    expect(offers[0]).toMatchObject({
      brandName: "alpinestars",
      productName: "Alpinestars S-M7 Core Helmet",
      categorySlug: "helmets",
      colour: "orange/blue",
      size: "xs",
      url,
      priceCents: 44999,
      inStock: true,
    });
    const pairs = offers.map((o) => `${o.colour}/${o.size}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toContain("orange/blue/xl");
  });
});

describe("mcas parser", () => {
  it("extracts tiles from category listing microdata", () => {
    const tiles = parseCategoryTiles(parseHtml(fixture("mcas-tiles.html")));
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toMatchObject({
      brandName: "oneal",
      productName: "Oneal 2027 Youth Element Cotton Squadron Jersey - Black/Grey",
      url: "https://www.mcas.com.au/shop/oneal-2027-youth-element-cotton-squadron-jersey-bl-ONE03S111-P",
      priceCents: 3795,
    });
    expect(tiles[0].imageUrl).toMatch(/^https:\/\/www\.mcas\.com\.au\//);
  });

  it("parses product page into a single offer with colour and selected size", () => {
    const $ = parseHtml(fixture("mcas-product.html"));
    const tile = {
      brandName: "oneal",
      productName: "Oneal 2027 Youth Element Cotton Squadron Jersey - Black/Grey",
      url: "https://www.mcas.com.au/shop/oneal-2027-youth-element-cotton-squadron-jersey-bl-ONE03S111-P",
      priceCents: 3795,
      imageUrl: undefined,
    };
    const offer = parseProductPage($, tile, "jackets");
    expect(offer).toMatchObject({
      brandName: "oneal",
      productName: "Oneal 2027 Youth Element Cotton Squadron Jersey - Black/Grey",
      categorySlug: "jackets",
      colour: "black/grey",
      size: "xs",
      priceCents: 3795,
      inStock: true,
      url: tile.url,
    });
  });
});
