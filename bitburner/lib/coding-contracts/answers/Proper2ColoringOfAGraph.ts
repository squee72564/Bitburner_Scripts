export const CODING_CONTRACT_ANSWERS_PROPER2COLORINGOFAGRAPH = {
  'Proper 2-Coloring of a Graph': (data: [number, [number, number][]]): (0 | 1)[] => {
    const n = data[0];
    const edges = data[1];
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const [u, v] of edges) {
      adj[u].push(v);
      adj[v].push(u);
    }
    const color: number[] = Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (color[i] !== -1) continue;
      color[i] = 0;
      const queue = [i];
      while (queue.length) {
        const u = queue.shift() as number;
        for (const v of adj[u]) {
          if (color[v] === -1) {
            color[v] = 1 - color[u];
            queue.push(v);
          } else if (color[v] === color[u]) {
            return [] as (0 | 1)[];
          }
        }
      }
    }
    return color as (0 | 1)[];
  },
} as Record<string, (data: unknown) => unknown>;
