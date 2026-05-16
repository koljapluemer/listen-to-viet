import { createRouter, createWebHistory } from "vue-router";
import ListeningPracticePage from "../pages/listening-practice/ListeningPracticePage.vue";
import PairPracticePage from "../pages/pair-practice/PairPracticePage.vue";
import StatsPage from "../pages/stats/StatsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "practice",
      component: ListeningPracticePage,
    },
    {
      path: "/stats",
      name: "stats",
      component: StatsPage,
    },
    {
      path: "/pair-practice",
      name: "pairPractice",
      component: PairPracticePage,
    },
  ],
});
