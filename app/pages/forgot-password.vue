<template>
  <UCard class="max-w-sm mx-auto mt-10">
    <h1 class="text-xl font-semibold mb-4">Forgot password</h1>
    <template v-if="sent">
      <p>If that email is registered, a reset link has been sent.</p>
      <p v-if="mailDev" class="mt-2 text-sm text-(--ui-text-muted)">
        (Dev mode: the reset link is printed in the server console.)
      </p>
    </template>
    <UForm v-else :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Email">
        <UInput v-model="state.email" type="email" required class="w-full" />
      </UFormField>
      <p v-if="error" class="text-sm text-(--ui-error)">{{ error }}</p>
      <UButton type="submit" block :loading="loading">Send reset link</UButton>
    </UForm>
    <p class="mt-4 text-sm text-(--ui-text-muted)">
      <NuxtLink to="/login" class="underline">Back to sign in</NuxtLink>
    </p>
  </UCard>
</template>

<script setup lang="ts">
const state = reactive({ email: "" });
const error = ref("");
const loading = ref(false);
const sent = ref(false);
const mailDev = useRuntimeConfig().public.mailDev;

async function onSubmit() {
  error.value = "";
  loading.value = true;
  const { error: err } = await authClient.requestPasswordReset({
    email: state.email,
    redirectTo: `${window.location.origin}/reset-password`,
  });
  loading.value = false;
  if (err) {
    error.value = err.message || "Request failed";
    return;
  }
  sent.value = true;
}
</script>
