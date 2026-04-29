# Listen to Viet

Minimal Vietnamese listening practice built on a binary-choice spaced-repetition loop.

Each round:

- autoplays a short mp3 clip
- shows two transcript options in random order
- uses the real transcript for one option
- generates the other by mutating a confusable Vietnamese letter or tone mark
- keeps only clips whose transcript has at most 5 space-split words

Wrong answers disable the chosen option and force a correction. Correct answers move straight to the next clip. Progress is stored in `localStorage` and can be exported from the UI.

## Dev

```bash
npm install
npm run dev
npm run build
```

## Stack

- Vue 3
- Vite
- Tailwind CSS
- daisyUI
- ebisu-js
