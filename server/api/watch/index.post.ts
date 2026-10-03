import { eq, sql } from "drizzle-orm";
import { db, schema } from "../../utils/drizzle";
import { requireUser } from "../../utils/require-user";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<{ variantId?: number; targetPriceCents?: number }>(event);
  if (!body?.variantId || typeof body.variantId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "variantId is required" });
  }
  const [variant] = await db.select().from(schema.variants).where(eq(schema.variants.id, body.variantId));
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: "Variant not found" });
  }
  const target = typeof body.targetPriceCents === "number" ? body.targetPriceCents : null;
  const [item] = await db
    .insert(schema.watchItems)
    .values({ userId: user.id, variantId: body.variantId, targetPriceCents: target })
    .onConflictDoUpdate({
      target: [schema.watchItems.userId, schema.watchItems.variantId],
      set: { targetPriceCents: sql`excluded.target_price_cents` },
    })
    .returning();
  return item;
});
