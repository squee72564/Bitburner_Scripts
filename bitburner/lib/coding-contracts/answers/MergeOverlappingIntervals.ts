export const CODING_CONTRACT_ANSWERS_MERGEOVERLAPPINGINTERVALS = {
  'Merge Overlapping Intervals': (intervals: [number, number][]): [number, number][] => {
    if (intervals.length === 0) return [];
    const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
    const res: [number, number][] = [];
    let [start, end] = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const [s, e] = sorted[i];
      if (s <= end) {
        end = Math.max(end, e);
      } else {
        res.push([start, end]);
        start = s;
        end = e;
      }
    }
    res.push([start, end]);
    return res;
  },
} as Record<string, (data: unknown) => unknown>;
