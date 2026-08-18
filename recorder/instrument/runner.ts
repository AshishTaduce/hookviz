/**
 * Child process entry point. Runs under `node --inspect-brk` so the parent
 * (stepper.ts) can drive it over CDP.
 *
 * Order matters:
 *   1. jsdom globals   (react-dom/client needs a DOM before it is imported)
 *   2. dispatcher wrapper installed
 *   3. example imported  -> its script hits scriptParsed, parent learns scriptId
 *   4. `debugger`        -> parent arms statement breakpoints on the example
 *   5. render + scenario -> every example statement now pauses the parent
 */
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';

const [, , compiledExamplePath] = process.argv;

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://hookviz.local/',
  pretendToBeVisual: true,
});

// Some of these (notably `navigator`) are getter-only globals in modern Node,
// so plain assignment throws — always go through defineProperty.
function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

for (const name of [
  'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event',
  'MouseEvent', 'CustomEvent', 'getComputedStyle', 'DocumentFragment', 'Text',
]) {
  defineGlobal(name, (dom.window as unknown as Record<string, unknown>)[name]);
}
defineGlobal('window', dom.window);
defineGlobal('navigator', dom.window.navigator);
defineGlobal('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
defineGlobal('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
defineGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const { install } = await import('./dispatcher.js');
const React = await import('react');
const { createRoot } = await import('react-dom/client');

const hookviz = install();

const exampleModule = await import(pathToFileURL(compiledExamplePath).href);
const Component = hookviz.wrapComponent(exampleModule.default);
const scenario = exampleModule.scenario as undefined | ((api: ScenarioApi) => Promise<void> | void);

interface ScenarioApi {
  click(selector: string): void;
  type(selector: string, value: string): void;
  tick(ms?: number): Promise<void>;
}

const container = document.getElementById('root')!;
const root = createRoot(container);
const act = (React as any).act as (cb: () => any) => Promise<void>;

const api: ScenarioApi = {
  click(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`scenario.click: no element matches ${selector}`);
    hookviz.setPhase('event');
    (el as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  },
  type(selector, value) {
    const el = document.querySelector(selector) as HTMLInputElement | null;
    if (!el) throw new Error(`scenario.type: no element matches ${selector}`);
    hookviz.setPhase('event');
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  },
  async tick(ms = 0) {
    await new Promise((r) => setTimeout(r, ms));
  },
};

// Parent arms breakpoints on the example script here, while we are stopped.
debugger;

await act(() => {
  root.render(React.createElement(Component));
});

if (scenario) {
  await act(async () => {
    await scenario({
      ...api,
      click: (s) => api.click(s),
    });
  });
}

await act(() => {
  root.unmount();
});

hookviz.setPhase('idle');
hookviz.done = true;
// Sentinel tells the parent execution finished so it can do a final drain.
process.stdout.write('\n__HOOKVIZ_DONE__\n');
