/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_SHORTESTPATHINAGRID: Record<
  string,
  CodingContractDescription
> = {
  'Shortest Path in a Grid': {
    difficulty: 7,
    desc: (data: number[][]): string => {
      return [
        'You are located in the top-left corner of the following grid:\n\n',
        `&nbsp;&nbsp;[${data.map((line) => `[${line}]`).join(',\n&nbsp;&nbsp;&nbsp;')}]\n\n`,
        'You are trying to find the shortest path to the bottom-right corner of the grid,',
        'but there are obstacles on the grid that you cannot move onto.',
        "These obstacles are denoted by '1', while empty spaces are denoted by 0.\n\n",
        'Determine the shortest path from start to finish, if one exists.',
        'The answer should be given as a string of UDLR characters, indicating the moves along the path\n\n',
        'NOTE: If there are multiple equally short paths, any of them is accepted as answer.',
        'If there is no path, the answer should be an empty string.\n',
        'NOTE: The data returned for this contract is an 2D array of numbers representing the grid.\n\n',
        'Examples:\n\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;[[0,1,0,0,0],\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[0,0,0,1,0]]\n',
        '\n',
        "Answer: 'DRRURRD'\n\n",
        '&nbsp;&nbsp;&nbsp;&nbsp;[[0,1],\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[1,0]]\n',
        '\n',
        "Answer: ''",
      ].join(' ');
    },
    solver: (data, answer) => {
      const width = data[0].length;
      const height = data.length;
      const dstY = height - 1;
      const dstX = width - 1;

      const distance: number[][] = new Array<number[]>(height);
      //const prev: [[number, number] | undefined][] = new Array(height);
      const queue: [number, number][] = [];

      for (let y = 0; y < height; y++) {
        distance[y] = new Array<number>(width).fill(Infinity);
        //prev[y] = new Array(width).fill(undefined) as [undefined];
      }

      function validPosition(y: number, x: number): boolean {
        return y >= 0 && y < height && x >= 0 && x < width && data[y][x] == 0;
      }

      // List in-bounds and passable neighbors
      function* neighbors(y: number, x: number): Generator<[number, number]> {
        if (validPosition(y - 1, x)) yield [y - 1, x]; // Up
        if (validPosition(y + 1, x)) yield [y + 1, x]; // Down
        if (validPosition(y, x - 1)) yield [y, x - 1]; // Left
        if (validPosition(y, x + 1)) yield [y, x + 1]; // Right
      }

      // Prepare starting point
      distance[0][0] = 0;
      queue.push([0, 0]);

      // Take next-nearest position and expand potential paths from there
      while (queue.length > 0) {
        const [y, x] = queue.shift() as [number, number];
        for (const [yN, xN] of neighbors(y, x)) {
          if (distance[yN][xN] == Infinity) {
            queue.push([yN, xN]);
            distance[yN][xN] = distance[y][x] + 1;
          }
        }
      }

      if (!Number.isFinite(distance[dstY][dstX])) return answer === '';
      if (answer.length > distance[dstY][dstX]) return false;

      let ansX = 0;
      let ansY = 0;
      for (const direction of answer.split('')) {
        switch (direction) {
          case 'U':
            ansY -= 1;
            break;
          case 'D':
            ansY += 1;
            break;
          case 'L':
            ansX -= 1;
            break;
          case 'R':
            ansX += 1;
            break;
          default:
            return false;
        }
      }

      return ansX === dstX && ansY === dstY;
    },
  },
};
