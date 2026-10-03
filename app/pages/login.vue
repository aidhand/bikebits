<template>
  <UCard class="max-w-sm mx-auto mt-10">
    <h1 class="text-xl font-semibold mb-4">Sign in</h1>
    <UForm :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Email">
        <UInput v-model="state.email" type="email" required class="w-full" />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="state.password" type="password" required class="w-full" />
      </UFormField>
      <p v-if="error" class="text-sm text-(--ui-error)">{{ error }}</p>
      <UButton type="submit" block :loading="loading">Sign in</UButton>
    </UForm>
    <p class="mt-4 text-sm text-(--ui-text-muted)">
      No account? <NuxtLink to="/register" class="underline">Register</NuxtLink>
      · <NuxtLink to="/forgot-password" class="underline">Forgot password</NuxtLink>
    </p>
  </UCard>
</template>

<script setup lang="ts">
const state = reactive({ email: "", password: "" });
const error = ref("");
const loading = ref(false);
const route = useRoute();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  const { error: err } = await authClient.signIn.email({
    email: state.email,
    password: state.password,
    callbackURL: (route.query.redirect as string) || "/",
  });
  loading.value = false;
  if (err) {
    error.value = err.message || "Sign-in failed";
    return;
  }
  await navigateTo((route.query.redirect as string) || "/");
}
</script>
