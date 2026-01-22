export const CODING_CONTRACT_ANSWERS_SHORTESTPATHINAGRID = {
  'Shortest Path in a Grid': (grid: (0 | 1)[][]): string => {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const target = [rows - 1, cols - 1];
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const queue: Array<[number, number, string]> = [[0, 0, '']];
    visited[0][0] = true;
    const dirs: Array<[number, number, string]> = [
      [1, 0, 'D'],
      [-1, 0, 'U'],
      [0, 1, 'R'],
      [0, -1, 'L'],
    ];
    while (queue.length) {
      const [r, c, path] = queue.shift() as [number, number, string];
      if (r === target[0] && c === target[1]) return path;
      for (const [dr, dc, ch] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (visited[nr][nc]) continue;
        if (grid[nr][nc] === 1) continue;
        visited[nr][nc] = true;
        queue.push([nr, nc, path + ch]);
      }
    }
    return '';
  },
} as Record<string, (data: unknown) => unknown>;
