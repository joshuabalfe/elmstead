# Tasks

## 1. Shortcut

- [ ] 1.1 In `viewer/main.ts`, add the keydown handler for Arrow Up/Arrow Down beside the walk and measure handlers: step from the highest shown storey, no wrapping, ignore walk mode, modifiers, snapshot mode, a hidden selector, auto-repeat, in-flight steps, and form controls other than the storey selector; `preventDefault()` only when it acts. Verify the new tests in 1.3 pass.
- [ ] 1.2 In `viewer/index.html`, add the shortcut to the storey selector's tooltip. Verify the title reads "Show every storey up to and including this one (Up / Down arrows to step)" in the browser.
- [ ] 1.3 In `tests/plan-vs-3d.test.ts`'s "storey selection" tests, add key presses with `page.keyboard.press`: step up and down on a multi-storey model checking the selector value, the URL and that the camera is unmoved; both ends do nothing; a custom `?storeys=` steps to a prefix; the model selector focused does nothing; Shift+ArrowUp does nothing; the storey selector focused after `selectOption` steps exactly once; a single-storey model does nothing; walk mode's arrows leave the selection alone. Verify with `npx vitest run tests/plan-vs-3d.test.ts`.

## 2. Docs and checks

- [ ] 2.1 List the shortcut in the viewer section of `docs/rendering.md` beside the storey selector. Verify the text matches the spec's keys and end behaviour.
- [ ] 2.2 Run `npx openspec validate --all`, `npm test` and `npm run typecheck`; all pass.
