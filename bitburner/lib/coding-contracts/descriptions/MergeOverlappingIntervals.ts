/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_MERGEOVERLAPPINGINTERVALS: Record<
  string,
  CodingContractDescription
> = {
  'Merge Overlapping Intervals': {
    difficulty: 3,
    desc: (arr: number[][]): string => {
      return [
        'Given the following array of arrays of numbers representing a list of',
        'intervals, merge all overlapping intervals.\n\n',
        `[${convert2DArrayToString(arr)}]\n\n`,
        'Example:\n\n',
        '[[1, 3], [8, 10], [2, 6], [10, 16]]\n\n',
        'would merge into [[1, 6], [8, 16]].\n\n',
        'The intervals must be returned in ASCENDING order.',
        'You can assume that in an interval, the first number will always be',
        'smaller than the second.',
      ].join(' ');
    },
    solver: (data, answer) => {
      const intervals: [number, number][] = data.slice();
      intervals.sort((a: [number, number], b: [number, number]) => {
        return a[0] - b[0];
      });

      const result: [number, number][] = [];
      let start: number = intervals[0][0];
      let end: number = intervals[0][1];
      for (const interval of intervals) {
        if (interval[0] <= end) {
          end = Math.max(end, interval[1]);
        } else {
          result.push([start, end]);
          start = interval[0];
          end = interval[1];
        }
      }
      result.push([start, end]);

      return (
        result.length === answer.length &&
        result.every((a, i) => a[0] === answer[i][0] && a[1] === answer[i][1])
      );
    },
  },
};
