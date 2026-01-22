/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_ARRAYJUMPINGGAME: Record<
  string,
  CodingContractDescription
> = {
  'Array Jumping Game': {
    difficulty: 2.5,
    desc: (arr: number[]): string => {
      return [
        'You are given the following array of integers:\n\n',
        `${arr}\n\n`,
        'Each element in the array represents your MAXIMUM jump length',
        'at that position. This means that if you are at position i and your',
        'maximum jump length is n, you can jump to any position from',
        'i to i+n.',
        '\n\nAssuming you are initially positioned',
        'at the start of the array, determine whether you are',
        'able to reach the last index.\n\n',
        'Your answer should be submitted as 1 or 0, representing true and false respectively.',
      ].join(' ');
    },
    solver: (data, answer) => {
      const n: number = data.length;
      let i = 0;
      for (let reach = 0; i < n && i <= reach; ++i) {
        reach = Math.max(i + data[i], reach);
      }
      const solution: boolean = i === n;
      return (solution ? 1 : 0) === answer;
    },
  },
  'Array Jumping Game II': {
    difficulty: 3,
    desc: (arr: number[]): string => {
      return [
        'You are given the following array of integers:\n\n',
        `${arr}\n\n`,
        'Each element in the array represents your MAXIMUM jump length',
        'at that position. This means that if you are at position i and your',
        'maximum jump length is n, you can jump to any position from',
        'i to i+n.',
        '\n\nAssuming you are initially positioned',
        'at the start of the array, determine the minimum number of',
        'jumps to reach the end of the array.\n\n',
        "If it's impossible to reach the end, then the answer should be 0.",
      ].join(' ');
    },
    solver: (data, answer) => {
      const n: number = data.length;
      let reach = 0;
      let jumps = 0;
      let lastJump = -1;
      while (reach < n - 1) {
        let jumpedFrom = -1;
        for (let i = reach; i > lastJump; i--) {
          if (i + data[i] > reach) {
            reach = i + data[i];
            jumpedFrom = i;
          }
        }
        if (jumpedFrom === -1) {
          jumps = 0;
          break;
        }
        lastJump = jumpedFrom;
        jumps++;
      }
      return jumps === answer;
    },
  },
};
