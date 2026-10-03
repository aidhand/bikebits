export default defineNuxtRouteMiddleware((to) => {
  const { data: session } = authClient.useSession(useFetch);
  if (!session.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
