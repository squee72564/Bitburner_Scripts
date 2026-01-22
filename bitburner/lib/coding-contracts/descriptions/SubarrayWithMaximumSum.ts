/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_SUBARRAYWITHMAXIMUMSUM: Record<
  string,
  CodingContractDescription
> = {
  'Subarray with Maximum Sum': {
    difficulty: 1,
    desc: (n: number[]): string => {
      return [
        'Given the following integer array, find the contiguous subarray',
        '(containing at least one number) which has the largest sum and return that sum.',
        "'Sum' refers to the sum of all the numbers in the subarray.\n",
        `${n.toString()}`,
      ].join(' ');
    },
    solver: (data, answer) => {
      const nums: number[] = data.slice();
      for (let i = 1; i < nums.length; i++) {
        nums[i] = Math.max(nums[i], nums[i] + nums[i - 1]);
      }

      return Math.max(...nums) === answer;
    },
  },
};
