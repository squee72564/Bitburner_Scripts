export const CODING_CONTRACT_ANSWERS_SANITIZEPARENTHESESINEXPRESSION = {
  'Sanitize Parentheses in Expression': (data: string): string[] => {
    let left = 0;
    let right = 0;
    const res: string[] = [];

    for (let i = 0; i < data.length; ++i) {
      if (data[i] === '(') {
        ++left;
      } else if (data[i] === ')') {
        if (left > 0) {
          --left;
        } else {
          ++right;
        }
      }
    }

    function dfs(
      pair: number,
      index: number,
      l: number,
      r: number,
      s: string,
      solution: string,
      out: string[],
    ): void {
      if (s.length === index) {
        if (l === 0 && r === 0 && pair === 0) {
          if (!out.includes(solution)) out.push(solution);
        }
        return;
      }

      if (s[index] === '(') {
        if (l > 0) dfs(pair, index + 1, l - 1, r, s, solution, out);
        dfs(pair + 1, index + 1, l, r, s, solution + s[index], out);
      } else if (s[index] === ')') {
        if (r > 0) dfs(pair, index + 1, l, r - 1, s, solution, out);
        if (pair > 0) dfs(pair - 1, index + 1, l, r, s, solution + s[index], out);
      } else {
        dfs(pair, index + 1, l, r, s, solution + s[index], out);
      }
    }

    dfs(0, 0, left, right, data, '', res);
    return res.length === 0 ? [''] : res;
  },
} as Record<string, (data: unknown) => unknown>;
