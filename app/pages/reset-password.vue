<template>
  <UCard class="max-w-sm mx-auto mt-10">
    <h1 class="text-xl font-semibold mb-4">Reset password</h1>
    <template v-if="done">
      <p>Password updated.</p>
      <UButton to="/login" class="mt-4" variant="outline">Sign in</UButton>
    </template>
    <UForm v-else :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="New password">
        <UInput v-model="state.newPassword" type="password" required minlength="8" class="w-full" />
      </UFormField>
      <p v-if="error" class="text-sm text-(--ui-error)">{{ error }}</p>
      <UButton type="submit" block :loading="loading">Reset password</UButton>
    </UForm>
  </UCard>
</template>

<script setup lang="ts">
const state = reactive({ newPassword: "" });
const error = ref("");
const loading = ref(false);
const done = ref(false);
const route = useRoute();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  const { error: err } = await authClient.resetPassword({
    newPassword: state.newPassword,
    token: route.query.token as string,
  });
  loading.value = false;
  if (err) {
    error.value = err.message || "Reset failed";
    return;
  }
  done.value = true;
}
</script>
