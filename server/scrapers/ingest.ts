import { sql } from "drizzle-orm";
import { db, schema } from "../utils/drizzle";
import { slugify, normalizeAttr } from "./normalize";
import type { ScrapedOffer } from "./types";

export interface IngestResult {
  brands: number;
  categories: number;
  products: number;
  variants: number;
  listings: number;
  snapshots: number;
}

const MAX_PARAMS_PER_INSERT = 60_000;

function chunks<T>(items: T[], rowParams: number): T[][] {
  const size = Math.max(1, Math.floor(MAX_PARAMS_PER_INSERT / rowParams));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function ingestOffers(retailerId: number, offers: ScrapedOffer[]): Promise<IngestResult> {
  return db.transaction(async (tx) => {
    const uniqueCategorySlugs = [...new Set(offers.map((o) => o.categorySlug))];
    const uniqueBrandNames = [...new Set(offers.map((o) => o.brandName.trim()))];

    const categoryBySlug = new Map<string, number>();
    for (const batch of chunks(uniqueCategorySlugs, 3)) {
      const inserted = await tx
        .insert(schema.categories)
        .values(batch.map((slug) => ({ slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) })))
        .onConflictDoUpdate({
          target: schema.categories.slug,
          set: { name: sql`excluded.name` },
        })
        .returning({ id: schema.categories.id, slug: schema.categories.slug });
      for (const c of inserted) categoryBySlug.set(c.slug, c.id);
    }

    const brandBySlug = new Map<string, number>();
    for (const batch of chunks(uniqueBrandNames, 3)) {
      const inserted = await tx
        .insert(schema.brands)
        .values(batch.map((name) => ({ slug: slugify(name), name })))
        .onConflictDoUpdate({
          target: schema.brands.slug,
          set: { name: sql`excluded.name` },
        })
        .returning({ id: schema.brands.id, slug: schema.brands.slug });
      for (const b of inserted) brandBySlug.set(b.slug, b.id);
    }

    const productBySlug = new Map<string, { name: string; brandName: string; categorySlug: string; imageUrl?: string; manufacturerUrl?: string }>();
    for (const o of offers) {
      const slug = slugify(`${normalizeAttr(o.brandName)}-${o.productName}`);
      if (!productBySlug.has(slug)) {
        productBySlug.set(slug, {
          name: o.productName,
          brandName: o.brandName.trim(),
          categorySlug: o.categorySlug,
          imageUrl: o.imageUrl,
          manufacturerUrl: o.manufacturerUrl,
        });
      }
    }

    const productIdBySlug = new Map<string, number>();
    for (const batch of chunks([...productBySlug.entries()], 2)) {
      const inserted = await tx
        .insert(schema.products)
        .values(
          batch.map(([slug, p]) => ({
            slug,
            brandId: brandBySlug.get(slugify(normalizeAttr(p.brandName)))!,
            categoryId: categoryBySlug.get(p.categorySlug)!,
            name: p.name,
            imageUrl: p.imageUrl ?? null,
            manufacturerUrl: p.manufacturerUrl ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: schema.products.slug,
          set: {
            name: sql`excluded.name`,
            brandId: sql`excluded.brand_id`,
            categoryId: sql`excluded.category_id`,
            imageUrl: sql`coalesce(excluded.image_url, products.image_url)`,
            manufacturerUrl: sql`coalesce(excluded.manufacturer_url, products.manufacturer_url)`,
          },
        })
        .returning({ id: schema.products.id, slug: schema.products.slug });
      for (const p of inserted) productIdBySlug.set(p.slug, p.id);
    }

    const variantByKey = new Map<string, { productId: number; colour: string; size: string; name: string; imageUrl?: string }>();
    for (const o of offers) {
      const productSlug = slugify(`${normalizeAttr(o.brandName)}-${o.productName}`);
      const productId = productIdBySlug.get(productSlug)!;
      const colour = normalizeAttr(o.colour ?? "");
      const size = normalizeAttr(o.size ?? "");
      const key = `${productId}\u0000${colour}\u0000${size}`;
      if (!variantByKey.has(key)) {
        const label = [colour, size].filter(Boolean).join(" / ");
        variantByKey.set(key, {
          productId,
          colour,
          size,
          name: o.productName + (label ? ` (${label})` : ""),
          imageUrl: o.imageUrl,
        });
      }
    }

    const variantIdByKey = new Map<string, number>();
    for (const batch of chunks([...variantByKey.values()], 6)) {
      const inserted = await tx
        .insert(schema.variants)
        .values(batch)
        .onConflictDoUpdate({
          target: [schema.variants.productId, schema.variants.colour, schema.variants.size],
          set: {
            name: sql`excluded.name`,
            imageUrl: sql`coalesce(excluded.image_url, variants.image_url)`,
          },
        })
        .returning({ id: schema.variants.id, productId: schema.variants.productId, colour: schema.variants.colour, size: schema.variants.size });
      for (const v of inserted) variantIdByKey.set(`${v.productId}\u0000${v.colour}\u0000${v.size}`, v.id);
    }

    const listingByKey = new Map<string, { variantId: number; url: string; priceCents: number | null; inStock: boolean }>();
    for (const o of offers) {
      const productSlug = slugify(`${normalizeAttr(o.brandName)}-${o.productName}`);
      const productId = productIdBySlug.get(productSlug)!;
      const colour = normalizeAttr(o.colour ?? "");
      const size = normalizeAttr(o.size ?? "");
      const variantId = variantIdByKey.get(`${productId}\u0000${colour}\u0000${size}`)!;
      const key = String(variantId);
      if (!listingByKey.has(key)) {
        listingByKey.set(key, { variantId, url: o.url, priceCents: o.priceCents, inStock: o.inStock });
      }
    }

    const idToListing = new Map<number, { priceCents: number | null; inStock: boolean }>();
    for (const batch of chunks([...listingByKey.values()], 7)) {
      const inserted = await tx
        .insert(schema.listings)
        .values(
          batch.map((l) => ({
            retailerId,
            variantId: l.variantId,
            url: l.url,
            currentPriceCents: l.priceCents,
            inStock: l.inStock,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [schema.listings.retailerId, schema.listings.variantId],
          set: {
            url: sql`excluded.url`,
            currentPriceCents: sql`excluded.current_price_cents`,
            inStock: sql`excluded.in_stock`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning({ id: schema.listings.id, variantId: schema.listings.variantId });
      for (const l of inserted) {
        const listing = listingByKey.get(String(l.variantId))!;
        idToListing.set(l.id, { priceCents: listing.priceCents, inStock: listing.inStock });
      }
    }

    const snapshots = [...idToListing.entries()].map(([listingId, l]) => ({
      listingId,
      priceCents: l.priceCents,
      inStock: l.inStock,
    }));
    for (const batch of chunks(snapshots, 4)) {
      await tx.insert(schema.priceSnapshots).values(batch);
    }

    return {
      brands: brandBySlug.size,
      categories: categoryBySlug.size,
      products: productIdBySlug.size,
      variants: variantIdByKey.size,
      listings: idToListing.size,
      snapshots: snapshots.length,
    };
  });
}
