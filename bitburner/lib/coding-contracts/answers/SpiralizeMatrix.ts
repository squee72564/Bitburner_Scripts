export const CODING_CONTRACT_ANSWERS_SPIRALIZEMATRIX = {
  'Spiralize Matrix': (matrix: number[][]): number[] => {
    const res: number[] = [];
    let top = 0;
    let bottom = matrix.length - 1;
    let left = 0;
    let right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) res.push(matrix[top][c]);
      top++;
      for (let r = top; r <= bottom; r++) res.push(matrix[r][right]);
      right--;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) res.push(matrix[bottom][c]);
        bottom--;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) res.push(matrix[r][left]);
        left++;
      }
    }
    return res;
  },
} as Record<string, (data: unknown) => unknown>;
