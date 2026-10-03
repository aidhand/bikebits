import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../../utils/drizzle";
import { sendMail, priceAlertEmail } from "../../utils/mail";

const ALERT_COOLDOWN_DAYS = 7;

export default defineTask({
  meta: { name: "watch:alerts" },
  async run() {
    const items = await db
      .select({
        userId: schema.watchItems.userId,
        userEmail: schema.user.email,
        variantId: schema.watchItems.variantId,
        targetPriceCents: schema.watchItems.targetPriceCents,
        productName: schema.products.name,
        productSlug: schema.products.slug,
        colour: schema.variants.colour,
        size: schema.variants.size,
      })
      .from(schema.watchItems)
      .innerJoin(schema.variants, eq(schema.watchItems.variantId, schema.variants.id))
      .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
      .innerJoin(schema.user, eq(schema.watchItems.userId, schema.user.id))
      .where(sql`${schema.watchItems.targetPriceCents} is not null`);

    const results: { userId: string; variantId: number; sent: boolean }[] = [];
    for (const item of items) {
      const recentAlert = await db
        .select({ id: schema.alertsSent.id })
        .from(schema.alertsSent)
        .where(
          and(
            eq(schema.alertsSent.userId, item.userId),
            eq(schema.alertsSent.variantId, item.variantId),
            gte(schema.alertsSent.sentAt, sql`now() - interval '${sql.raw(String(ALERT_COOLDOWN_DAYS))} days'`),
          ),
        )
        .limit(1);
      if (recentAlert.length) {
        results.push({ userId: item.userId, variantId: item.variantId, sent: false });
        continue;
      }

      const hit = await db
        .select({
          retailerName: schema.retailers.name,
          url: schema.listings.url,
          currentPriceCents: schema.listings.currentPriceCents,
        })
        .from(schema.listings)
        .innerJoin(schema.retailers, eq(schema.listings.retailerId, schema.retailers.id))
        .where(
          and(
            eq(schema.listings.variantId, item.variantId),
            sql`${schema.listings.currentPriceCents} <= ${item.targetPriceCents}`,
            eq(schema.listings.inStock, true),
          ),
        )
        .limit(1);
      const hitRow = hit[0];
      if (!hitRow) {
        results.push({ userId: item.userId, variantId: item.variantId, sent: false });
        continue;
      }
      const { retailerName, url, currentPriceCents } = hitRow;
      const label = [item.colour, item.size].filter(Boolean).join(" / ");
      await sendMail({
        to: item.userEmail,
        subject: `Price alert: ${item.productName}${label ? ` (${label})` : ""}`,
        html: priceAlertEmail(
          item.productName + (label ? ` (${label})` : ""),
          retailerName,
          `$${(currentPriceCents! / 100).toFixed(2)}`,
          url ?? `https://bikebits.au/products/${item.productSlug}`,
        ),
      });
      await db.insert(schema.alertsSent).values({ userId: item.userId, variantId: item.variantId });
      results.push({ userId: item.userId, variantId: item.variantId, sent: true });
    }

    console.log(`[watch:alerts] checked=${items.length} sent=${results.filter((r) => r.sent).length}`);
    return { result: "done", checked: items.length, sent: results.filter((r) => r.sent).length };
  },
});
