import { Tile, TileType, makeTile } from "games/minesweeper/tile";

export type Board = Tile[][];

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export function initializeBoard (width: number, height: number): Board {
  return [...Array(height)].map((_, r) =>
    [...Array(width)].map((_ ,c) => makeTile(c, r))
  );
};


export function randomizeBoard (board: Board, difficulty: number) {
    const width = board.length;
    const tiles = board.flat();
    const mineCount = Math.floor(tiles.length * difficulty);

    for (let i = 0; i < mineCount; i++) {
      tiles[i].type = TileType.BOMB;
    }
    
    shuffleArray(tiles);

    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < width; x++) {
        board[y][x] = tiles[y * width + x]
        board[y][x].x = x;
        board[y][x].y = y;
      }
    }
}
