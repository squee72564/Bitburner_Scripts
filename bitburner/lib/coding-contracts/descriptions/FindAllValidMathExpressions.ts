/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_FINDALLVALIDMATHEXPRESSIONS: Record<
  string,
  CodingContractDescription
> = {
  'Find All Valid Math Expressions': {
    difficulty: 10,
    desc: (data: [string, number]): string => {
      const digits: string = data[0];
      const target: number = data[1];

      return [
        'You are given the following string which contains only digits between 0 and 9:\n\n',
        `${digits}\n\n`,
        `You are also given a target number of ${target}. Return all possible ways`,
        'you can add the +(add), -(subtract), and *(multiply) operators to the string such',
        'that it evaluates to the target number. (Normal order of operations applies.)\n\n',
        'The provided answer should be an array of strings containing the valid expressions.',
        'The data provided by this problem is an array with two elements. The first element',
        'is the string of digits, while the second element is the target number:\n\n',
        `["${digits}", ${target}]\n\n`,
        'NOTE: The order of evaluation expects script operator precedence.\n',
        "NOTE: Numbers in the expression cannot have leading 0's. In other words,",
        `"1+01" is not a valid expression.\n\n`,
        'Examples:\n\n',
        `Input: digits = "123", target = 6\n`,
        `Output: ["1+2+3", "1*2*3"]\n\n`,
        `Input: digits = "105", target = 5\n`,
        `Output: ["1*0+5", "10-5"]`,
      ].join(' ');
    },
    solver: (data, answer) => {
      const num = data[0];
      const target = data[1];

      function helper(
        res: string[],
        path: string,
        num: string,
        target: number,
        pos: number,
        evaluated: number,
        multed: number,
      ): void {
        if (pos === num.length) {
          if (target === evaluated) {
            res.push(path);
          }
          return;
        }

        for (let i = pos; i < num.length; ++i) {
          if (i != pos && num[pos] == '0') {
            break;
          }
          const cur = parseInt(num.substring(pos, i + 1));

          if (pos === 0) {
            helper(res, path + cur, num, target, i + 1, cur, cur);
          } else {
            helper(res, path + '+' + cur, num, target, i + 1, evaluated + cur, cur);
            helper(res, path + '-' + cur, num, target, i + 1, evaluated - cur, -cur);
            helper(
              res,
              path + '*' + cur,
              num,
              target,
              i + 1,
              evaluated - multed + multed * cur,
              multed * cur,
            );
          }
        }
      }

      const result: string[] = [];
      helper(result, '', num, target, 0, 0, 0);

      if (result.length !== answer.length) return false;

      const solutions = new Set(answer);
      return result.every((sol) => solutions.has(sol));
    },
  },
};
