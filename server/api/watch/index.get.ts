import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../../utils/drizzle";
import { requireUser } from "../../utils/require-user";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await db
    .select({
      id: schema.watchItems.id,
      variantId: schema.watchItems.variantId,
      targetPriceCents: schema.watchItems.targetPriceCents,
      createdAt: schema.watchItems.createdAt,
      productName: schema.products.name,
      productSlug: schema.products.slug,
      colour: schema.variants.colour,
      size: schema.variants.size,
      minPriceCents: sql<number | null>`(select min(l.current_price_cents) from listings l where l.variant_id = ${schema.variants.id})::int`,
    })
    .from(schema.watchItems)
    .innerJoin(schema.variants, eq(schema.watchItems.variantId, schema.variants.id))
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(eq(schema.watchItems.userId, user.id))
    .orderBy(desc(schema.watchItems.createdAt));
  return rows;
});
