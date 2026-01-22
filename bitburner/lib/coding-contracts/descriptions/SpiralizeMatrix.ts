/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_SPIRALIZEMATRIX: Record<
  string,
  CodingContractDescription
> = {
  'Spiralize Matrix': {
    difficulty: 2,
    desc: (n: number[][]): string => {
      let d: string = [
        'Given the following array of arrays of numbers representing a 2D matrix,',
        'return the elements of the matrix as an array in spiral order:\n\n',
      ].join(' ');
      // for (const line of n) {
      //   d += `${line.toString()},\n`;
      // }
      d += '&nbsp;&nbsp;&nbsp;&nbsp;[\n';
      d += n
        .map(
          (line: number[]) =>
            '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[' +
            line.map((x: number) => `${x}`.padStart(2, ' ')).join(',') +
            ']',
        )
        .join('\n');
      d += '\n&nbsp;&nbsp;&nbsp;&nbsp;]\n';
      d += [
        '\nHere is an example of what spiral order should be:\n\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;[\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[1, 2, 3]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[4, 5, 6]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[7, 8, 9]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;]\n\n',
        'Answer: [1, 2, 3, 6, 9, 8 ,7, 4, 5]\n\n',
        'Note that the matrix will not always be square:\n\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;[\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[1,&nbsp;&nbsp;2,&nbsp;&nbsp;3,&nbsp;&nbsp;4]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[5,&nbsp;&nbsp;6,&nbsp;&nbsp;7,&nbsp;&nbsp;8]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[9,&nbsp;10,&nbsp;11,&nbsp;12]\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;]\n\n',
        'Answer: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]',
      ].join(' ');

      return d;
    },
    solver: (data, answer) => {
      const spiral: number[] = [];
      const m: number = data.length;
      const n: number = data[0].length;
      let u = 0;
      let d: number = m - 1;
      let l = 0;
      let r: number = n - 1;
      let k = 0;
      let done = false;
      while (!done) {
        // Up
        for (let col: number = l; col <= r; col++) {
          spiral[k] = data[u][col];
          ++k;
        }
        if (++u > d) {
          done = true;
          continue;
        }

        // Right
        for (let row: number = u; row <= d; row++) {
          spiral[k] = data[row][r];
          ++k;
        }
        if (--r < l) {
          done = true;
          continue;
        }

        // Down
        for (let col: number = r; col >= l; col--) {
          spiral[k] = data[d][col];
          ++k;
        }
        if (--d < u) {
          done = true;
          continue;
        }

        // Left
        for (let row: number = d; row >= u; row--) {
          spiral[k] = data[row][l];
          ++k;
        }
        if (++l > r) {
          done = true;
          continue;
        }
      }

      return spiral.length === answer.length && spiral.every((n, i) => n === answer[i]);
    },
  },
};
