/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_UNIQUEPATHSINAGRID: Record<
  string,
  CodingContractDescription
> = {
  'Unique Paths in a Grid I': {
    difficulty: 3,
    desc: (data: number[]): string => {
      const numRows = data[0];
      const numColumns = data[1];
      return [
        'You are in a grid with',
        `${numRows} rows and ${numColumns} columns, and you are`,
        'positioned in the top-left corner of that grid. You are trying to',
        'reach the bottom-right corner of the grid, but you can only',
        'move down or right on each step. Determine how many',
        'unique paths there are from start to finish.\n\n',
        'NOTE: The data returned for this contract is an array',
        'with the number of rows and columns:\n\n',
        `[${numRows}, ${numColumns}]`,
      ].join(' ');
    },
    solver: (data, answer) => {
      const n: number = data[0]; // Number of rows
      const m: number = data[1]; // Number of columns
      const currentRow: number[] = [];
      currentRow.length = n;

      for (let i = 0; i < n; i++) {
        currentRow[i] = 1;
      }
      for (let row = 1; row < m; row++) {
        for (let i = 1; i < n; i++) {
          currentRow[i] += currentRow[i - 1];
        }
      }

      return currentRow[n - 1] === answer;
    },
  },
  'Unique Paths in a Grid II': {
    difficulty: 5,
    desc: (data: number[][]): string => {
      let gridString = '';
      for (const line of data) {
        gridString += `${line.toString()},\n`;
      }
      return [
        'You are located in the top-left corner of the following grid:\n\n',
        `${gridString}\n`,
        'You are trying reach the bottom-right corner of the grid, but you can only',
        'move down or right on each step. Furthermore, there are obstacles on the grid',
        "that you cannot move onto. These obstacles are denoted by '1', while empty",
        'spaces are denoted by 0.\n\n',
        'Determine how many unique paths there are from start to finish.\n\n',
        'NOTE: The data returned for this contract is an 2D array of numbers representing the grid.',
      ].join(' ');
    },
    solver: (data, answer) => {
      const obstacleGrid: number[][] = [];
      obstacleGrid.length = data.length;
      for (let i = 0; i < obstacleGrid.length; ++i) {
        obstacleGrid[i] = data[i].slice();
      }

      for (let i = 0; i < obstacleGrid.length; i++) {
        for (let j = 0; j < obstacleGrid[0].length; j++) {
          if (obstacleGrid[i][j] == 1) {
            obstacleGrid[i][j] = 0;
          } else if (i == 0 && j == 0) {
            obstacleGrid[0][0] = 1;
          } else {
            obstacleGrid[i][j] =
              (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0);
          }
        }
      }

      return obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1] === answer;
    },
  },
};
