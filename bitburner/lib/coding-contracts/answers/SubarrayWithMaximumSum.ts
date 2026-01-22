export const CODING_CONTRACT_ANSWERS_SUBARRAYWITHMAXIMUMSUM = {
  'Subarray with Maximum Sum': (data: number[]): number => {
    let maxCur = data[0];
    let maxSoFar = data[0];
    for (let i = 1; i < data.length; i++) {
      maxCur = Math.max(data[i], maxCur + data[i]);
      maxSoFar = Math.max(maxSoFar, maxCur);
    }
    return maxSoFar;
  },
} as Record<string, (data: unknown) => unknown>;
