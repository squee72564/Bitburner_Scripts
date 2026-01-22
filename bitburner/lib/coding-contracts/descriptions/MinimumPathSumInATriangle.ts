/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_MINIMUMPATHSUMINATRIANGLE: Record<
  string,
  CodingContractDescription
> = {
  'Minimum Path Sum in a Triangle': {
    difficulty: 5,
    desc: (data: number[][]): string => {
      function createTriangleRecurse(data: number[][], level = 0): string {
        const numLevels: number = data.length;
        if (level >= numLevels) {
          return '';
        }
        const numSpaces = numLevels - level + 1;

        let str: string = ['&nbsp;'.repeat(numSpaces), '[', data[level].toString(), ']'].join('');
        if (level < numLevels - 1) {
          str += ',';
        }

        return str + '\n' + createTriangleRecurse(data, level + 1);
      }

      function createTriangle(data: number[][]): string {
        return ['[\n', createTriangleRecurse(data), ']'].join('');
      }

      const triangle = createTriangle(data);

      return [
        'Given a triangle, find the minimum path sum from top to bottom. In each step',
        'of the path, you may only move to adjacent numbers in the row below.',
        'The triangle is represented as a 2D array of numbers:\n\n',
        `${triangle}\n\n`,
        'Example: If you are given the following triangle:\n\n[\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[2],\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;[3,4],\n',
        '&nbsp;&nbsp;&nbsp;[6,5,7],\n',
        '&nbsp;&nbsp;[4,1,8,3]\n',
        ']\n\n',
        'The minimum path sum is 11 (2 -> 3 -> 5 -> 1).',
      ].join(' ');
    },
    solver: (data, answer) => {
      const n: number = data.length;
      const dp: number[] = data[n - 1].slice();
      for (let i = n - 2; i > -1; --i) {
        for (let j = 0; j < data[i].length; ++j) {
          dp[j] = Math.min(dp[j], dp[j + 1]) + data[i][j];
        }
      }

      return dp[0] === answer;
    },
  },
};
