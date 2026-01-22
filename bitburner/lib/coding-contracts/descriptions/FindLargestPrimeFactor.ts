/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_FINDLARGESTPRIMEFACTOR: Record<
  string,
  CodingContractDescription
> = {
  'Find Largest Prime Factor': {
    difficulty: 1,
    desc: (n: number): string => {
      return [
        'A prime factor is a factor that is a prime number.',
        `What is the largest prime factor of ${n}?`,
      ].join(' ');
    },
    solver: (data, answer) => {
      let fac = 2;
      let n: number = data;
      while (n > (fac - 1) * (fac - 1)) {
        while (n % fac === 0) {
          n = Math.round(n / fac);
        }
        ++fac;
      }

      return (n === 1 ? fac - 1 : n) === answer;
    },
  },
};
