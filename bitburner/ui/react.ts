const cheatyWindow = eval('window') as Window & typeof globalThis;
const cheatyDocument = eval('document') as Document & typeof globalThis;
const React = cheatyWindow.React;
type ReactDomCompat = {
  render: (...args: unknown[]) => unknown;
  unmountComponentAtNode: (...args: unknown[]) => unknown;
  createRoot?: (...args: unknown[]) => unknown;
};

const ReactDOM = cheatyWindow.ReactDOM as unknown as ReactDomCompat;

export { React, ReactDOM, cheatyDocument };
