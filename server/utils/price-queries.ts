import { and, asc, eq, ilike, or, sql, gte } from "drizzle-orm";
import { db, schema } from "./drizzle";

export interface ProductCard {
  slug: string;
  name: string;
  imageUrl: string | null;
  brandName: string;
  categorySlug: string;
  minPriceCents: number | null;
}

export interface ProductFilters {
  category?: string;
  brand?: string;
  q?: string;
  sort?: string;
}

export async function listProducts(filters: ProductFilters): Promise<ProductCard[]> {
  const conditions = [
    filters.category ? eq(schema.categories.slug, filters.category) : undefined,
    filters.brand ? eq(schema.brands.slug, filters.brand) : undefined,
    filters.q
      ? or(ilike(schema.products.name, `%${filters.q}%`), ilike(schema.brands.name, `%${filters.q}%`))
      : undefined,
  ].filter((c) => c !== undefined);

  const orderBy =
    filters.sort === "price-asc"
      ? asc(sql`min(${schema.listings.currentPriceCents})`)
      : asc(schema.products.name);

  const rows = await db
    .select({
      slug: schema.products.slug,
      name: schema.products.name,
      imageUrl: schema.products.imageUrl,
      brandName: schema.brands.name,
      categorySlug: schema.categories.slug,
      minPriceCents: sql<number | null>`min(${schema.listings.currentPriceCents})::int`,
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .innerJoin(schema.variants, eq(schema.variants.productId, schema.products.id))
    .innerJoin(schema.listings, eq(schema.listings.variantId, schema.variants.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(schema.products.id, schema.brands.name, schema.categories.slug)
    .orderBy(orderBy);

  return rows;
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      manufacturerUrl: schema.products.manufacturerUrl,
      brandName: schema.brands.name,
      brandSlug: schema.brands.slug,
      categorySlug: schema.categories.slug,
      categoryName: schema.categories.name,
    })
    .from(schema.products)
    .innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(eq(schema.products.slug, slug));
  if (!product) return null;

  const variantRows = await db
    .select({
      id: schema.variants.id,
      colour: schema.variants.colour,
      size: schema.variants.size,
      name: schema.variants.name,
      imageUrl: schema.variants.imageUrl,
    })
    .from(schema.variants)
    .where(eq(schema.variants.productId, product.id))
    .orderBy(asc(schema.variants.colour), asc(schema.variants.size));

  const listingRows = variantRows.length
    ? await db
        .select({
          variantId: schema.listings.variantId,
          retailerName: schema.retailers.name,
          retailerSlug: schema.retailers.slug,
          url: schema.listings.url,
          currentPriceCents: schema.listings.currentPriceCents,
          inStock: schema.listings.inStock,
        })
        .from(schema.listings)
        .innerJoin(schema.retailers, eq(schema.listings.retailerId, schema.retailers.id))
        .where(
          sql`${schema.listings.variantId} in (${sql.join(variantRows.map((v) => sql`${v.id}`), sql`, `)})`,
        )
    : [];

  const seriesRows = variantRows.length
    ? await db
        .select({
          variantId: schema.priceSnapshots.listingId,
          capturedAt: schema.priceSnapshots.capturedAt,
          priceCents: schema.priceSnapshots.priceCents,
        })
        .from(schema.priceSnapshots)
        .innerJoin(schema.listings, eq(schema.priceSnapshots.listingId, schema.listings.id))
        .where(
          and(
            sql`${schema.listings.variantId} in (${sql.join(variantRows.map((v) => sql`${v.id}`), sql`, `)})`,
            gte(schema.priceSnapshots.capturedAt, sql`now() - interval '30 days'`),
          ),
        )
        .orderBy(asc(schema.priceSnapshots.capturedAt))
    : [];

  const listingIds = new Set(listingRows.map((l) => l.variantId));
  const variantSeries: Record<number, { capturedAt: string; priceCents: number | null }[]> = {};
  for (const row of seriesRows) {
    if (!listingIds.has(row.variantId)) continue;
    (variantSeries[row.variantId] ??= []).push({
      capturedAt: row.capturedAt.toISOString(),
      priceCents: row.priceCents,
    });
  }

  return { product, variants: variantRows, listings: listingRows, series: variantSeries };
}

export interface DealRow {
  productSlug: string;
  productName: string;
  brandName: string;
  colour: string;
  size: string;
  imageUrl: string | null;
  currentPriceCents: number;
  priorFloorCents: number;
}

export async function getDeals(): Promise<DealRow[]> {
  const result = await db.execute(sql`
    with current_min as (
      select variant_id, min(current_price_cents) as cm
      from listings
      where current_price_cents is not null
      group by variant_id
    ),
    prior_floor as (
      select l.variant_id, min(s.price_cents) as pm
      from price_snapshots s
      join listings l on l.id = s.listing_id
      where s.price_cents is not null
        and s.captured_at between now() - interval '30 days' and now() - interval '7 days'
      group by l.variant_id
    )
    select p.slug as product_slug, p.name as product_name, p.image_url,
           b.name as brand_name, v.colour, v.size,
           cm.cm as current_price_cents, pf.pm as prior_floor_cents
    from current_min cm
    join prior_floor pf on pf.variant_id = cm.variant_id
    join variants v on v.id = cm.variant_id
    join products p on p.id = v.product_id
    join brands b on b.id = p.brand_id
    where cm.cm <= floor(pf.pm * 0.9)
    order by (pf.pm - cm.cm)::float / pf.pm desc
    limit 50
  `);
  return result as DealRow[];
}
