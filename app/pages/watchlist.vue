<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Watchlist</h1>
    <p v-if="pending" class="text-(--ui-text-muted)">Loading…</p>
    <p v-else-if="!items.length" class="text-(--ui-text-muted)">
      Nothing watched yet. Open a product and hit "Watch" on a variant.
    </p>
    <UTable v-else :data="items" :columns="columns">
      <template #variant-cell="{ row }">
        {{ variantLabel(row.original.colour, row.original.size) }}
      </template>
      <template #minPriceCents-cell="{ row }">
        {{ fmtPrice(row.original.minPriceCents) }}
      </template>
      <template #targetPriceCents-cell="{ row }">
        <div class="flex items-center gap-1">
          <UInput
            :model-value="row.original.targetPriceCents === null ? '' : (row.original.targetPriceCents / 100)"
            type="number"
            step="0.01"
            min="0"
            class="w-24"
            @update:model-value="row.original._target = $event"
          />
          <UButton size="xs" variant="outline" @click="saveTarget(row.original)">Save</UButton>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <UButton size="xs" variant="ghost" color="error" @click="remove(row.original.id)">Delete</UButton>
      </template>
    </UTable>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });

interface WatchRow {
  id: number;
  variantId: number;
  productName: string;
  productSlug: string;
  colour: string;
  size: string;
  targetPriceCents: number | null;
  minPriceCents: number | null;
  _target?: number | string | undefined;
}

const { data: items, pending, refresh } = useFetch<WatchRow[]>("/api/watch");

const columns = [
  { accessorKey: "productName", header: "Product" },
  { accessorKey: "variant", header: "Variant" },
  { accessorKey: "minPriceCents", header: "Current best" },
  { accessorKey: "targetPriceCents", header: "Target price" },
  { accessorKey: "actions", header: "" },
];

async function saveTarget(row: WatchRow) {
  const target = row._target === undefined || row._target === "" ? undefined : Math.round(Number(row._target) * 100);
  await $fetch("/api/watch", { method: "POST", body: { variantId: row.variantId, targetPriceCents: target } });
  await refresh();
}

async function remove(id: number) {
  await $fetch(`/api/watch/${id}`, { method: "DELETE" });
  await refresh();
}

useHead({ title: "Watchlist — BikeBits" });
</script>
