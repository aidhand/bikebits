// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      "0 2 * * *": ["prices:snapshot"],
      "0 3 * * *": ["watch:alerts"],
    },
  },
  runtimeConfig: {
    public: {
      mailDev: process.env.MAIL_DEV === "true",
    },
  },


  modules: [
    "@nuxt/hints",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@nuxt/ui",
  ],
});
