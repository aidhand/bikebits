<template>
  <div class="min-h-screen">
    <header class="border-b border-(--ui-border)">
      <UContainer class="flex h-14 items-center gap-6">
        <NuxtLink to="/" class="font-bold text-lg">BikeBits</NuxtLink>
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink to="/" class="text-(--ui-text-muted) hover:text-(--ui-text)">Browse</NuxtLink>
          <NuxtLink to="/deals" class="text-(--ui-text-muted) hover:text-(--ui-text)">Deals</NuxtLink>
          <NuxtLink to="/watchlist" class="text-(--ui-text-muted) hover:text-(--ui-text)">Watchlist</NuxtLink>
        </nav>
        <div class="ml-auto flex items-center gap-3">
          <template v-if="session">
            <span class="text-sm text-(--ui-text-muted)">{{ session.user.name }}</span>
            <UButton variant="outline" size="sm" @click="signOutNow">Sign out</UButton>
          </template>
          <template v-else>
            <NuxtLink to="/login"><UButton variant="outline" size="sm">Sign in</UButton></NuxtLink>
            <NuxtLink to="/register"><UButton size="sm">Create account</UButton></NuxtLink>
          </template>
        </div>
      </UContainer>
    </header>
    <UContainer class="py-8">
      <slot />
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const { data: session } = authClient.useSession(useFetch);

async function signOutNow() {
  await authClient.signOut();
  await navigateTo("/");
}
</script>
