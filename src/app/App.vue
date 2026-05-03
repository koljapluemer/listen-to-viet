<template>
  <div class="flex min-h-dvh flex-col bg-base-200">
    <header class="border-b border-base-300 bg-base-100">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <p class="text-base font-semibold">
          Listen to Viet
        </p>
        <div class="join">
          <RouterLink
            :to="{ name: 'practice' }"
            class="btn btn-sm join-item"
            :class="{ 'btn-active': route.name === 'practice' }"
          >
            Practice
          </RouterLink>
          <RouterLink
            :to="{ name: 'stats' }"
            class="btn btn-sm join-item"
            :class="{ 'btn-active': route.name === 'stats' }"
          >
            Stats
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <RouterView />
    </main>

    <footer class="border-t border-base-300 bg-base-100 px-4 py-4 text-sm">
      <div class="mx-auto flex max-w-6xl flex-col gap-2">
        <p>
          Made by
          <a
            class="link"
            href="https://koljasam.com/"
            target="_blank"
          >Kolja Sam</a>.
        </p>

        <p>
          This app uses the
          <a
            class="link"
            href="https://data.mendeley.com/datasets/k9sxg2twv4/4"
            target="_blank"
            rel="noopener"
          >FPT Open Speech Dataset (FOSD) - Vietnamese</a>.
          <button
            type="button"
            class="link ml-1"
            @click="openLicenseModal"
          >
            View license
          </button>
        </p>

        <p>
          All data stays on your device. <a
            href="https://github.com/koljapluemer/listen-to-viet"
            class="link"
          >Open
            Source</a>, no ads, no sign-up, no BS. I track page views with the privacy-friendly <a
            href="https://www.goatcounter.com/"
            class="underline"
            target="_blank"
          >goatcounter</a>, and nothing else.
        </p>

        <p>
          If you want to enable me to build more tools like this in the future, you can <a
            href="https://ko-fi.com/S6S81CWUVD"
            target="_blank"
            rel="noopener"
            class="underline"
          >
            support me on ko-fi
          </a>.
        </p>
      </div>
    </footer>

    <dialog
      ref="licenseModal"
      class="modal"
    >
      <div class="modal-box max-w-3xl">
        <h2 class="text-lg font-semibold">
          FPT Open Speech Dataset License
        </h2>

        <div class="mt-4 space-y-4 leading-relaxed">
          <p>
            Copyright 2018 FPT Corporation
          </p>

          <p>
            Permission is hereby granted, free of charge, non-exclusive, worldwide,
            irrevocable, to any person obtaining a copy of this data or software and
            associated documentation files (the “Data or Software”), to deal in the
            Data or Software without restriction, including without limitation the
            rights to use, copy, modify, remix, transform, merge, build upon,
            publish, distribute and redistribute, sublicense, and/or sell copies of
            the Data or Software, for any purpose, even commercially, and to permit
            persons to whom the Data or Software is furnished to do so, subject to
            the following conditions:
          </p>

          <p>
            The above copyright notice, and this permission notice, and indication of
            any modification to the Data or Software, shall be included in all copies
            or substantial portions of the Data or Software.
          </p>

          <p>
            THE DATA OR SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
            NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
            DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
            OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE DATA OR SOFTWARE
            OR THE USE OR OTHER DEALINGS IN THE DATA OR SOFTWARE.
          </p>

          <p>
            Patent and trademark rights are not licensed under this FPT Public
            License.
          </p>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <button class="btn">
              Close
            </button>
          </form>
        </div>
      </div>

      <form
        method="dialog"
        class="modal-backdrop"
      >
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

const route = useRoute();
const licenseModal = ref<HTMLDialogElement | null>(null);

function openLicenseModal() {
  licenseModal.value?.showModal();
}
</script>
