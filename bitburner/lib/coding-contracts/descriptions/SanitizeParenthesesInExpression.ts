/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_SANITIZEPARENTHESESINEXPRESSION: Record<
  string,
  CodingContractDescription
> = {
  'Sanitize Parentheses in Expression': {
    difficulty: 10,
    desc: (data: string): string => {
      return [
        'Given the following string:\n\n',
        `${data}\n\n`,
        'remove the minimum number of invalid parentheses in order to validate',
        'the string. If there are multiple minimal ways to validate the string,',
        'provide all of the possible results. The answer should be provided',
        'as an array of strings. If it is impossible to validate the string',
        'the result should be an array with only an empty string.\n\n',
        'IMPORTANT: The string may contain letters, not just parentheses.\n\n',
        `Examples:\n\n`,
        `"()())()" -> ["()()()", "(())()"]\n`,
        `"(a)())()" -> ["(a)()()", "(a())()"]\n`,
        `")(" -> [""]`,
      ].join(' ');
    },
    solver: (data, answer) => {
      let left = 0;
      let right = 0;
      const res: string[] = [];

      for (let i = 0; i < data.length; ++i) {
        if (data[i] === '(') {
          ++left;
        } else if (data[i] === ')') {
          left > 0 ? --left : ++right;
        }
      }

      function dfs(
        pair: number,
        index: number,
        left: number,
        right: number,
        s: string,
        solution: string,
        res: string[],
      ): void {
        if (s.length === index) {
          if (left === 0 && right === 0 && pair === 0) {
            for (let i = 0; i < res.length; i++) {
              if (res[i] === solution) {
                return;
              }
            }
            res.push(solution);
          }
          return;
        }

        if (s[index] === '(') {
          if (left > 0) {
            dfs(pair, index + 1, left - 1, right, s, solution, res);
          }
          dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
        } else if (s[index] === ')') {
          if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
          if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
        } else {
          dfs(pair, index + 1, left, right, s, solution + s[index], res);
        }
      }

      dfs(0, 0, left, right, data, '', res);

      if (res.length !== answer.length) return false;
      return res.every((sol) => answer.includes(sol));
    },
  },
};
