export const CODING_CONTRACT_ANSWERS_FINDALLVALIDMATHEXPRESSIONS = {
  'Find All Valid Math Expressions': (data: [string, number]): string[] => {
    const num = data[0];
    const target = data[1];
    const res: string[] = [];

    function dfs(index: number, expr: string, prev: number, cur: number, value: number): void {
      if (index === num.length) {
        if (value === target && cur === 0) res.push(expr);
        return;
      }
      cur = cur * 10 + Number(num[index]);
      const strCur = cur.toString();
      if (cur > 0) {
        dfs(index + 1, expr, prev, cur, value);
      }
      if (expr.length === 0) {
        dfs(index + 1, strCur, cur, 0, cur);
        return;
      }
      dfs(index + 1, expr + '+' + strCur, cur, 0, value + cur);
      dfs(index + 1, expr + '-' + strCur, -cur, 0, value - cur);
      dfs(index + 1, expr + '*' + strCur, prev * cur, 0, value - prev + prev * cur);
    }

    dfs(0, '', 0, 0, 0);
    return res;
  },
} as Record<string, (data: unknown) => unknown>;
