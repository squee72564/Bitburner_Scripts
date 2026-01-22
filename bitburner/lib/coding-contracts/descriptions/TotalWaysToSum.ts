/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_TOTALWAYSTOSUM: Record<
  string,
  CodingContractDescription
> = {
  'Total Ways to Sum': {
    difficulty: 1.5,
    desc: (n: number): string => {
      return [
        'It is possible write four as a sum in exactly four different ways:\n\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;3 + 1\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;2 + 2\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;2 + 1 + 1\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;1 + 1 + 1 + 1\n\n',
        `How many different distinct ways can the number ${n} be written as a sum of at least`,
        'two positive integers?',
      ].join(' ');
    },
    solver: (data, answer) => {
      if (typeof data !== 'number') throw new Error('solver expected number');
      const ways: number[] = [1];
      ways.length = data + 1;
      ways.fill(0, 1);
      for (let i = 1; i < data; ++i) {
        for (let j: number = i; j <= data; ++j) {
          ways[j] += ways[j - i];
        }
      }

      return ways[data] === answer;
    },
  },
  'Total Ways to Sum II': {
    difficulty: 2,
    desc: (data: [number, number[]]): string => {
      const n: number = data[0];
      const s: number[] = data[1];
      return [
        `How many different distinct ways can the number ${n} be written`,
        'as a sum of integers contained in the set:\n\n',
        `[${s}]?\n\n`,
        'You may use each integer in the set zero or more times.',
      ].join(' ');
    },
    solver: (data, answer) => {
      // https://www.geeksforgeeks.org/coin-change-dp-7/?ref=lbp
      const n = data[0];
      const s = data[1];
      const ways: number[] = [1];
      ways.length = n + 1;
      ways.fill(0, 1);
      for (let i = 0; i < s.length; i++) {
        for (let j = s[i]; j <= n; j++) {
          ways[j] += ways[j - s[i]];
        }
      }
      return ways[n] === answer;
    },
  },
};
