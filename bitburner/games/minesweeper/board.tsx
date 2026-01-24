import { Tile, TileState, TileType, makeTile } from 'games/minesweeper/tile';

export type Board = Tile[][];

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function initializeBoard(width: number, height: number): Board {
  return [...Array(height)].map((_, r) => [...Array(width)].map((_, c) => makeTile(c, r)));
}

export function randomizeBoard(board: Board, difficulty: number) {
  const width = board[0].length;
  const height = board.length;
  const tiles = board.flat();
  const mineCount = Math.floor(tiles.length * difficulty);

  for (const tile of tiles) {
    tile.state = TileState.HIDDEN;
    tile.type = TileType.ZERO;
  }

  for (let i = 0; i < mineCount; i++) {
    tiles[i].type = TileType.BOMB;
  }

  shuffleArray(tiles);

  const calcTileType = (x: number, y: number): TileType => {
    const deltas = [-1, 0, 1, 0, -1, 1, 1, -1, -1];
    let count = 0;
    for (let i = 0; i < 8; i++) {
      const dx = x + deltas[i];
      const dy = y + deltas[i + 1];
      if (dx < 0 || dx >= width || dy < 0 || dy >= height) continue;

      if (board[dy][dx].type === TileType.BOMB) {
        count++;
      }
    }

    switch (count) {
      case 0:
        return TileType.ZERO;
      case 1:
        return TileType.ONE;
      case 2:
        return TileType.TWO;
      case 3:
        return TileType.THREE;
      case 4:
        return TileType.FOUR;
      case 5:
        return TileType.FIVE;
      case 6:
        return TileType.SIX;
      case 7:
        return TileType.SEVEN;
      case 8:
        return TileType.EIGHT;
    }

    return TileType.ZERO;
  };

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < width; x++) {
      board[y][x] = tiles[y * width + x];
      board[y][x].x = x;
      board[y][x].y = y;
    }
  }

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < width; x++) {
      if (board[y][x].type !== TileType.BOMB) {
        board[y][x].type = calcTileType(x, y);
      }
    }
  }
}
