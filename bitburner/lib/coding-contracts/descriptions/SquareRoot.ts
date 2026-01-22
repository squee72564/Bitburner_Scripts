/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_SQUAREROOT: Record<string, CodingContractDescription> = {
  'Square Root': {
    difficulty: 5,
    desc(data: bigint): string {
      return `You are given a ~200 digit BigInt. Find the square root of this number, to the nearest integer.\n
    The input is a BigInt value. The answer must be the string representing the solution's BigInt value. The trailing "n" is not part of the string.\n
    Hint: If you are having trouble, you might consult https://en.wikipedia.org/wiki/Methods_of_computing_square_roots

    Input number:
    ${data}`;
    },
    solver: (state, answer) => {
      return state[0] === answer.toString();
    },
  },
};
