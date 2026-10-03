<template>
  <div>
    <div class="flex flex-wrap gap-2 mb-6">
      <UButton
        :variant="!category ? 'solid' : 'outline'"
        size="sm"
        :to="{ path: '/', query: restOfQuery({ category: undefined }) }"
      >All</UButton>
      <UButton
        v-for="cat in categories"
        :key="cat.slug"
        :variant="category === cat.slug ? 'solid' : 'outline'"
        size="sm"
        :to="{ path: '/', query: restOfQuery({ category: cat.slug }) }"
      >{{ cat.name }}</UButton>
    </div>

    <p v-if="pending" class="text-(--ui-text-muted)">Loading products…</p>
    <p v-else-if="!products.length" class="text-(--ui-text-muted)">
      No products yet. Run the <code>prices:snapshot</code> task to scrape retailers.
    </p>
    <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      <UCard
        v-for="product in products"
        :key="product.slug"
        class="hover:ring-2 hover:ring-(--ui-primary) transition"
      >
        <NuxtLink :to="`/products/${product.slug}`" class="block">
          <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" class="h-40 w-full object-contain mb-3" loading="lazy">
          <p class="text-xs uppercase tracking-wide text-(--ui-text-muted)">{{ product.brandName }}</p>
          <p class="font-medium leading-snug">{{ product.name }}</p>
          <p class="mt-2 font-semibold text-(--ui-primary)">from {{ fmtPrice(product.minPriceCents) }}</p>
        </NuxtLink>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const category = computed(() => route.query.category as string | undefined);

function restOfQuery(patch: Record<string, string | undefined>) {
  return { ...route.query, ...patch };
}

const { data: products, pending } = useFetch("/api/products", {
  query: { category, sort: "price-asc" },
});

const { data: categories } = useFetch("/api/categories");

useHead({ title: "BikeBits — motorcycle gear price tracker" });
</script>
