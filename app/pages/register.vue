<template>
  <UCard class="max-w-sm mx-auto mt-10">
    <h1 class="text-xl font-semibold mb-4">Create account</h1>
    <template v-if="registered">
      <p>Account created. Check your email to verify your address before signing in.</p>
      <p v-if="mailDev" class="mt-2 text-sm text-(--ui-text-muted)">
        (Dev mode: the verification link is printed in the server console.)
      </p>
      <UButton to="/login" class="mt-4" variant="outline">Go to sign in</UButton>
    </template>
    <UForm v-else :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Name">
        <UInput v-model="state.name" required class="w-full" />
      </UFormField>
      <UFormField label="Email">
        <UInput v-model="state.email" type="email" required class="w-full" />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="state.password" type="password" required minlength="8" class="w-full" />
      </UFormField>
      <p v-if="error" class="text-sm text-(--ui-error)">{{ error }}</p>
      <UButton type="submit" block :loading="loading">Register</UButton>
    </UForm>
    <p class="mt-4 text-sm text-(--ui-text-muted)">
      Already registered? <NuxtLink to="/login" class="underline">Sign in</NuxtLink>
    </p>
  </UCard>
</template>

<script setup lang="ts">
const state = reactive({ name: "", email: "", password: "" });
const error = ref("");
const loading = ref(false);
const registered = ref(false);
const mailDev = useRuntimeConfig().public.mailDev;

async function onSubmit() {
  error.value = "";
  loading.value = true;
  const { error: err } = await authClient.signUp.email({
    name: state.name,
    email: state.email,
    password: state.password,
  });
  loading.value = false;
  if (err) {
    error.value = err.message || "Registration failed";
    return;
  }
  registered.value = true;
}
</script>
