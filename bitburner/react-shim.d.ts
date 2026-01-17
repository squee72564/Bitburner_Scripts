import type React from 'react';

declare global {
  namespace JSX {
    type Element = React.ReactElement<unknown, unknown>;
    interface IntrinsicElements {
      [elemName: string]: unknown;
    }
  }
}

export {};
