<template>
  <div v-if="data">
    <div class="flex gap-6 flex-col md:flex-row mb-6">
      <img
        v-if="data.product.imageUrl"
        :src="data.product.imageUrl"
        :alt="data.product.name"
        class="w-full md:w-80 h-80 object-contain"
      >
      <div>
        <p class="text-xs uppercase tracking-wide text-(--ui-text-muted)">
          <NuxtLink to="/" class="underline">{{ data.product.categoryName }}</NuxtLink>
          · {{ data.product.brandName }}
        </p>
        <h1 class="text-2xl font-semibold mt-1">{{ data.product.name }}</h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          Cheapest now:
          <span class="font-semibold text-(--ui-primary)">{{ fmtPrice(minPrice) }}</span>
        </p>
        <p v-if="data.product.manufacturerUrl" class="mt-2">
          <UButton
            :to="data.product.manufacturerUrl"
            target="_blank"
            size="xs"
            variant="outline"
          >Manufacturer</UButton>
        </p>
      </div>
    </div>

    <h2 class="font-semibold mb-2">Variants</h2>
    <UTable :data="variantRows" :columns="variantColumns">
      <template #colour-cell="{ row }">
        <UButton
          variant="link"
          class="px-0"
          :class="{ 'text-(--ui-primary)': row.original.id === selectedId }"
          @click="selectedId = row.original.id"
        >{{ row.original.colour || "—" }}</UButton>
      </template>
      <template #price-cell="{ row }">
        <span :class="{ 'font-semibold text-(--ui-primary)': row.original.id === cheapestVariantId }">
          {{ fmtPrice(row.original.minPriceCents) }}
        </span>
      </template>
    </UTable>

    <div v-if="selected" class="mt-8 grid md:grid-cols-2 gap-8">
      <div>
        <h2 class="font-semibold mb-2">Retailer listings — {{ variantLabel(selected.colour, selected.size) }}</h2>
        <UTable :data="selectedListings" :columns="listingColumns">
          <template #url-cell="{ row }">
            <UButton :to="row.original.url" target="_blank" size="xs" variant="link">
              {{ row.original.retailerName }}
            </UButton>
          </template>
        </UTable>

        <div class="mt-4 flex items-end gap-2">
          <UFormField label="Alert me at (AUD)">
            <UInput v-model="targetInput" type="number" step="0.01" min="0" />
          </UFormField>
          <UButton size="sm" :loading="watching" @click="addWatch">Watch</UButton>
          <span v-if="watchMsg" class="text-sm text-(--ui-text-muted)">{{ watchMsg }}</span>
        </div>
      </div>

      <div>
        <h2 class="font-semibold mb-2">30-day price history</h2>
        <p v-if="!series.length" class="text-sm text-(--ui-text-muted)">No snapshot history yet.</p>
        <svg v-else viewBox="0 0 320 120" class="w-full border rounded-lg border-(--ui-border) p-2">
          <polyline
            :points="polylinePoints"
            fill="none"
            stroke="var(--ui-primary)"
            stroke-width="2"
          />
          <circle
            v-for="(pt, i) in polylinePts"
            :key="i"
            :cx="pt.x"
            :cy="pt.y"
            r="2.5"
            fill="var(--ui-primary)"
          />
        </svg>
        <p v-if="series.length" class="text-xs text-(--ui-text-muted) mt-1">
          {{ fmtPrice(series[0].priceCents) }} → {{ fmtPrice(series[series.length - 1].priceCents) }}
        </p>
      </div>
    </div>
  </div>
  <p v-else-if="error">Product not found.</p>
</template>

<script setup lang="ts">
const route = useRoute();
const { data, error } = await useFetch(`/api/products/${route.params.slug}`);
const selectedId = ref<number | null>(null);

interface VariantRow {
  id: number;
  colour: string;
  size: string;
  minPriceCents: number | null;
}
interface ListingRow {
  retailerName: string;
  url: string | null;
  currentPriceCents: number | null;
  inStock: boolean | null;
}

const variantRows = computed<VariantRow[]>(() => {
  const v = data.value?.variants ?? [];
  const l = data.value?.listings ?? [];
  return v.map((variant) => ({
    id: variant.id,
    colour: variant.colour,
    size: variant.size,
    minPriceCents: l
      .filter((listing) => listing.variantId === variant.id && listing.currentPriceCents !== null)
      .map((listing) => listing.currentPriceCents)
      .sort((a, b) => a - b)[0] ?? null,
  }));
});

const cheapestVariantId = computed(() =>
  variantRows.value
    .filter((row) => row.minPriceCents !== null)
    .sort((a, b) => a.minPriceCents! - b.minPriceCents!)[0]?.id ?? null,
);

const selected = computed(() =>
  data.value?.variants.find((variant) => variant.id === selectedId.value) ??
  data.value?.variants[0] ??
  null,
);

const selectedListings = computed<ListingRow[]>(() =>
  (data.value?.listings ?? [])
    .filter((listing) => listing.variantId === selected.value?.id)
    .map((listing) => ({
      retailerName: listing.retailerName,
      url: listing.url,
      currentPriceCents: listing.currentPriceCents,
      inStock: listing.inStock,
    })),
);

const series = computed(() => data.value?.series[selected.value?.id ?? -1] ?? []);

const minPrice = computed(() =>
  variantRows.value
    .map((row) => row.minPriceCents)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)[0] ?? null,
);

const variantColumns = [
  { accessorKey: "colour", header: "Colour" },
  { accessorKey: "size", header: "Size" },
  { accessorKey: "minPriceCents", header: "Cheapest price" },
];
const listingColumns = [
  { accessorKey: "retailerName", header: "Retailer" },
  { accessorKey: "currentPriceCents", header: "Price" },
  { accessorKey: "inStock", header: "In stock" },
  { accessorKey: "url", header: "Link" },
];

const polylinePts = computed(() => {
  const prices = series.value.map((pt) => pt.priceCents).filter((p): p is number => p !== null);
  if (prices.length < 2) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  return prices.map((p, i) => ({
    x: 10 + (i / (prices.length - 1)) * 300,
    y: 100 - ((p - min) / span) * 90 - 5,
  }));
});
const polylinePoints = computed(() => polylinePts.value.map((pt) => `${pt.x},${pt.y}`).join(" "));

const targetInput = ref("");
const watching = ref(false);
const watchMsg = ref("");

async function addWatch() {
  watching.value = true;
  watchMsg.value = "";
  const target = Math.round(Number(targetInput.value) * 100);
  const res = await $fetch("/api/watch", {
    method: "POST",
    body: { variantId: selected.value?.id, targetPriceCents: Number.isFinite(target) ? target : undefined },
  }).catch((err) => ({ error: err?.statusMessage ?? "Sign in required" }));
  watching.value = false;
  watchMsg.value = "error" in res && res.error ? String(res.error) : "Watching this variant";
}

useHead({ title: () => data.value ? `${data.value.product.name} — BikeBits` : "BikeBits" });
</script>
