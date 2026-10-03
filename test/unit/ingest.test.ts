import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestOffers } from "../../server/scrapers/ingest";
import { db, schema } from "../../server/utils/drizzle";
import type { ScrapedOffer } from "../../server/scrapers/types";

const DB_AVAILABLE = await (async () => {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (err) {
    console.warn(`[ingest test] DB unreachable, skipping: ${err instanceof Error ? err.message : err}`);
    return false;
  }
})();

const TEST_RETAILER = { slug: "test-ingest", name: "Ingest Test", adapterId: "test-ingest" };

const offers: ScrapedOffer[] = [
  {
    brandName: "Testbrand",
    productName: "Test Helmet",
    categorySlug: "helmets",
    colour: "black",
    size: "m",
    url: "https://example.com/test-helmet",
    priceCents: 29999,
    inStock: true,
  },
  {
    brandName: "Testbrand",
    productName: "Test Helmet",
    categorySlug: "helmets",
    colour: "black",
    size: "l",
    url: "https://example.com/test-helmet",
    priceCents: 31999,
    inStock: false,
  },
];

async function counts() {
  const rows = await db.execute(sql`
    select
      (select count(*) from products) as products,
      (select count(*) from variants) as variants,
      (select count(*) from listings) as listings,
      (select count(*) from price_snapshots where listing_id in (select id from listings where retailer_id = (select id from retailers where slug = ${TEST_RETAILER.slug}))) as snapshots
  `);
  return rows[0] as Record<string, string>;
}

async function purgeTestData(retailerId: number) {
  await db.execute(sql`delete from price_snapshots where listing_id in (select id from listings where retailer_id = ${retailerId})`);
  await db.execute(sql`delete from listings where retailer_id = ${retailerId}`);
  await db.execute(sql`delete from watch_items where variant_id in (select v.id from variants v join products p on p.id = v.product_id join brands b on b.id = p.brand_id where b.slug = 'testbrand')`);
  await db.execute(sql`delete from variants where product_id in (select id from products where brand_id in (select id from brands where slug = 'testbrand'))`);
  await db.execute(sql`delete from products where brand_id in (select id from brands where slug = 'testbrand')`);
  await db.execute(sql`delete from brands where slug = 'testbrand'`);
}

describe.skipIf(!DB_AVAILABLE)("ingestOffers idempotency", () => {
  let retailerId: number;

  beforeAll(async () => {
    const inserted = await db
      .insert(schema.retailers)
      .values(TEST_RETAILER)
      .onConflictDoUpdate({ target: schema.retailers.slug, set: { name: TEST_RETAILER.name } })
      .returning({ id: schema.retailers.id });
    retailerId = inserted[0].id;
    await purgeTestData(retailerId);
  });

  afterAll(async () => {
    await purgeTestData(retailerId);
    await db.delete(schema.retailers).where(sql`${schema.retailers.id} = ${retailerId}`);
  });

  it("is idempotent: second run changes no counts except +2 snapshots", async () => {
    const first = await ingestOffers(retailerId, offers);
    const before = await counts();

    const second = await ingestOffers(retailerId, offers);
    const after = await counts();

    expect(second.products).toBe(first.products);
    expect(second.variants).toBe(first.variants);
    expect(second.listings).toBe(first.listings);
    expect(Number(after.products)).toBe(Number(before.products));
    expect(Number(after.variants)).toBe(Number(before.variants));
    expect(Number(after.listings)).toBe(Number(before.listings));
    expect(Number(after.snapshots)).toBe(Number(before.snapshots) + 2);
    expect(Number(before.snapshots)).toBe(2);
  });
});
