export const CODING_CONTRACT_ANSWERS_FINDLARGESTPRIMEFACTOR = {
  'Find Largest Prime Factor': (n: number): number => {
    let x = n;
    let factor = 2;
    while (factor * factor <= x) {
      if (x % factor === 0) {
        x = Math.floor(x / factor);
      } else {
        factor += factor === 2 ? 1 : 2;
      }
    }
    return x;
  },
} as Record<string, (data: unknown) => unknown>;
