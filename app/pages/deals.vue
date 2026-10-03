<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Deals</h1>
    <p class="text-sm text-(--ui-text-muted) mb-4">
      Variants at least 10% below their lowest price in the previous 7–30 day window.
    </p>
    <p v-if="pending" class="text-(--ui-text-muted)">Loading deals…</p>
    <p v-else-if="!deals.length" class="text-(--ui-text-muted)">
      No deals detected yet — history builds up as snapshots accumulate.
    </p>
    <UTable v-else :data="deals" :columns="columns">
      <template #name-cell="{ row }">
        <NuxtLink :to="`/products/${row.original.productSlug}`" class="underline">
          {{ row.original.productName }}
        </NuxtLink>
      </template>
      <template #currentPriceCents-cell="{ row }">
        <span class="font-semibold text-(--ui-primary)">{{ fmtPrice(row.original.currentPriceCents) }}</span>
      </template>
      <template #discount-cell="{ row }">
        {{ ((1 - row.original.currentPriceCents / row.original.priorFloorCents) * 100).toFixed(0) }}% below
      </template>
    </UTable>
  </div>
</template>

<script setup lang="ts">
const { data: deals, pending } = useFetch("/api/deals");

const columns = [
  { accessorKey: "productName", header: "Product" },
  { accessorKey: "brandName", header: "Brand" },
  { accessorKey: "colour", header: "Colour" },
  { accessorKey: "size", header: "Size" },
  { accessorKey: "priorFloorCents", header: "Was" },
  { accessorKey: "currentPriceCents", header: "Now" },
  { accessorKey: "discount", header: "Drop" },
];

useHead({ title: "Deals — BikeBits" });
</script>
