export const CODING_CONTRACT_ANSWERS_ARRAYJUMPINGGAME = {
  'Array Jumping Game': (nums: number[]): 1 | 0 => {
    let maxReach = 0;
    for (let i = 0; i < nums.length; i++) {
      if (i > maxReach) return 0;
      maxReach = Math.max(maxReach, i + nums[i]);
    }
    return 1;
  },
  'Array Jumping Game II': (nums: number[]): number => {
    if (nums.length <= 1) return 0;
    let jumps = 0;
    let currentEnd = 0;
    let farthest = 0;
    for (let i = 0; i < nums.length - 1; i++) {
      farthest = Math.max(farthest, i + nums[i]);
      if (i === currentEnd) {
        if (farthest === currentEnd) {
          return 0;
        }
        jumps++;
        currentEnd = farthest;
        if (currentEnd >= nums.length - 1) break;
      }
    }
    return jumps;
  },
} as Record<string, (data: unknown) => unknown>;
