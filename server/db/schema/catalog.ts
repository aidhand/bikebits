import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index,  } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  brandId: integer("brand_id").references(() => brands.id),
  categoryId: integer("category_id").references(() => categories.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  manufacturerUrl: text("manufacturer_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    colour: text("colour").notNull().default(""),
    size: text("size").notNull().default(""),
    name: text("name"),
    imageUrl: text("image_url"),
  },
  (t) => [uniqueIndex("variants_product_attr_uniq").on(t.productId, t.colour, t.size)],
);

export const retailers = pgTable("retailers", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  adapterId: text("adapter_id").notNull(),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").notNull().default(true),
});

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    retailerId: integer("retailer_id")
      .notNull()
      .references(() => retailers.id),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id),
    url: text("url"),
    currentPriceCents: integer("current_price_cents"),
    inStock: boolean("in_stock"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("listings_retailer_variant_uniq").on(t.retailerId, t.variantId)],
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    priceCents: integer("price_cents"),
    inStock: boolean("in_stock"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("price_snapshots_listing_captured_idx").on(t.listingId, t.capturedAt)],
);
