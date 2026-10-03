export default defineTask({
  meta: { name: "catalog:seed" },
  async run() {
    await db
      .insert(schema.categories)
      .values([
        { slug: "helmets", name: "Helmets" },
        { slug: "jackets", name: "Jackets" },
        { slug: "gloves", name: "Gloves" },
        { slug: "boots", name: "Boots" },
        { slug: "pants", name: "Pants" },
        { slug: "armour", name: "Armour" },
        { slug: "accessories", name: "Accessories" },
      ])
      .onConflictDoNothing({ target: schema.categories.slug });

    await db
      .insert(schema.retailers)
      .values([
        { slug: "mcas", name: "MCAS", adapterId: "mcas", baseUrl: "https://mcas.com.au", isActive: true },
        { slug: "bikebiz", name: "Bikebiz", adapterId: "bikebiz", baseUrl: "https://www.bikebiz.com.au", isActive: true },
      ])
      .onConflictDoNothing({ target: schema.retailers.slug });

    return { result: "seeded" };
  },
});
