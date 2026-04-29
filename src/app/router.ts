import { createRouter, createWebHistory } from "vue-router";
import ListeningPracticePage from "../pages/listening-practice/ListeningPracticePage.vue";
import StatsPage from "../pages/stats/StatsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: ListeningPracticePage,
    },
    {
      path: "/stats",
      component: StatsPage,
    },
  ],
});
