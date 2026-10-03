import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { variants } from "./catalog";

export const watchItems = pgTable(
  "watch_items",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id),
    targetPriceCents: integer("target_price_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("watch_items_user_variant_uniq").on(t.userId, t.variantId)],
);

export const alertsSent = pgTable(
  "alerts_sent",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("alerts_sent_user_variant_sent_idx").on(t.userId, t.variantId, t.sentAt)],
);
