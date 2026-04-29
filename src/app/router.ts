import { createRouter, createWebHistory } from "vue-router";
import ListeningPracticePage from "../pages/listening-practice/ListeningPracticePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: ListeningPracticePage,
    },
  ],
});
