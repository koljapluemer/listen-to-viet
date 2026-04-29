## Essential Tech Stack

- tailwind + Daisy UI. Actually use daisy components. Avoid manual CSS when possible.
- lucide icons (via the vue package)
- vue router
- dexie as SINGLE source of truth for data (Dexie Cloud ready)

## Architecture

Do NOT!! adhere to the classic folder-by-type architecture Vue comes with.
Instead, use the following folder structure (inspired by Feature-Sliced Design)

- `app`: Stuff that MUST be global, e.g. the vue boilerplate holding the router view. Can import from anywhere, if it must. Should contain little logic.
- `db`: Holding dexie infrastructure and DB types. Necessary evil. Should be as small as possible
- `dumb`: collection of simple, reusable stuff. no business logic. may not import from ANY other high-level folder. may cross-import within the folder. put assets here (if needed)
- `entities`: models/entities. One folder per user-space entity such as "flashcard". May import from `db`, but nothing else.
- `features`: ways of interacting with entities. one folder per feature, following an entity-action (e.g. flashcard-manage) pattern. may NOT import one another. may ONLY import from `dumb` or `entities`, NEVER from other features.
- `meta`: for complex features interacting in turn with multiple `features`. One folder per meta-feature. May only import from below, and not from other meta-features. Name features CLEARLY and DESCRIPTIVELY (instead of short and confusing) with full noun and full verb action.
- `pages`: One folder per page (a page is something used by the `router.ts` file). If functionality is ONLY used on a given page, put it in the page *folder* (avoid having just a single giant page file, split it up!), do not create features or meta-features that are only used by one single page.

No other high-level folders are allowed.
Do not use `index.ts` file reexporting components, simply export directly.

## Guidelines

- Keep design lean. Use cards, wrapper divs and containers ONLY when necessary
- Keep style consistent across the code base
- Setup eslint and ensure green linter (not by disabling it, but by writing clean code)
- Keep files, functions and classes short, with a single purpose, on one abstraction layer. Split complex functionality when called for.
- Do not hallucinate features I did not ask for
- Keep copy and micro-copy short and to the point. Avoid waffling, avoid marketing speak, and avoid labelling everything with triple redundancy.
- make sure UI looks neat. Always put a form input BELOW the label in a new line. Responsive design.
- KEEP. IT. SIMPLE.
- always run `npm run build` and `npm run lint:fix` to ensure everything is well done. Fix problems by writing clean code, not by disabling the linter.
- save inputs on blur, avoid using "Save" buttons


## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## Various

### Persistence Safety

- Never pass Vue reactive state (`ref`, `reactive`, `computed`, proxied arrays/objects) directly into Dexie, IndexedDB, `structuredClone`, `postMessage`, or any browser API that clones data.
- Always convert persisted payloads to plain JS data at the storage boundary. For arrays/objects, explicitly clone/sanitize them first.
- In practice: before writing app data to Dexie/localStorage/IndexedDB, create a plain DTO and copy nested arrays/objects instead of reusing reactive references.
