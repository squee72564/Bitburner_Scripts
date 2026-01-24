import { NS, AutocompleteData } from '@ns';
import { cleanup, createOverlay, injectTailwindStyles } from '/ui/lib/utils';
import { ReactDOM, React } from '/ui/react';
import { FloatingPanel } from '/ui/components/FloatingPanel';
import { ResizablePanel } from '/ui/components/ResizablePanel';
import { Board, initializeBoard, randomizeBoard } from 'games/minesweeper/board';
import { TileState, TileType, TileUI } from './tile';

type MinesweeperProps = {
  ns: NS;
  onExit: () => void;
  width: number;
  height: number;
  difficulty: number;
};

interface MinesweeperOptions {
  width: number;
  height: number;
  difficulty: number;
}

const DEFAULT_FLAGS: [string, string | number | boolean | string[]][] = [
  ['help', false],
  ['h', false],
  ['width', 8],
  ['height', 8],
  ['difficulty', 0.1],
] as const;

export function autocomplete(data: AutocompleteData) {
  data.flags(DEFAULT_FLAGS);
  return [];
}

function printHelp(ns: NS) {
  ns.tprint(
    `Usage: ${ns.getScriptName()} ${DEFAULT_FLAGS.map((flag) => '[--' + flag[0] + ']').join(' ')}`,
  );
}

function parseArguments(ns: NS): MinesweeperOptions | null {
  const flags = ns.flags(DEFAULT_FLAGS);

  if (flags.help || flags.h) {
    printHelp(ns);
    return null;
  }

  const width = Math.max(0, Number(flags.width));
  const height = Math.max(0, Number(flags.height));
  const difficulty = Math.min(1, Math.max(0, Number(flags.difficulty)));

  if (![width, height, difficulty].every(Number.isFinite)) {
    ns.tprint('Invalid arguments!');
    printHelp(ns);
    return null;
  }

  return {
    width,
    height,
    difficulty,
  };
}

export async function main(ns: NS): Promise<void> {
  const opts = parseArguments(ns);

  if (!opts) {
    return;
  }

  const overlay = createOverlay('bb-minesweeper-overlay');
  injectTailwindStyles(ns);
  ns.atExit(() => cleanup(overlay));
  let shouldExit = false;

  ReactDOM.render(
    <React.StrictMode>
      <Minesweeper
        ns={ns}
        onExit={() => {
          shouldExit = true;
        }}
        width={opts.width}
        height={opts.height}
        difficulty={opts.difficulty}
      ></Minesweeper>
    </React.StrictMode>,
    overlay,
  );

  while (!shouldExit) {
    await ns.asleep(250);
  }

  cleanup(overlay);
}

function Minesweeper(props: MinesweeperProps): JSX.Element {
  const [board, setBoard] = React.useState<Board>(() => {
    const board = initializeBoard(props.width, props.height);
    randomizeBoard(board, props.difficulty);
    return board;
  });

  React.useEffect(() => {
    const b = initializeBoard(props.width, props.height);
    randomizeBoard(b, props.difficulty);
    setBoard(b);
  }, [props.width, props.height, props.difficulty]);

  const deltas = [-1, 0, 1, 0, -1, 1, 1, -1, -1];

  const revealFrom = (board: Board, x: number, y: number) => {
    const width = board[0].length;
    const height = board.length;
    const stack: Array<[number, number]> = [[x, y]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (cx < 0 || cx >= width || cy < 0 || cy >= height) {
        continue;
      }

      const tile = board[cy][cx];
      if (tile.state === TileState.FLAGGED || tile.type === TileType.BOMB) {
        continue;
      }

      tile.state = TileState.OPENED;

      if (tile.type !== TileType.ZERO) {
        continue;
      }

      for (let i = 0; i < 8; i++) {
        const nx = cx + deltas[i];
        const ny = cy + deltas[i + 1];
        stack.push([nx, ny]);
      }
    }
  };

  const revealTiles = (board: Board, x: number, y: number): Board => {
    const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));
    revealFrom(newBoard, x, y);
    return newBoard;
  };

  const handleReveal = (x: number, y: number) => {
    const tile = board[y][x];

    if (tile.state === TileState.OPENED && typeof tile.type === 'number' && tile.type > 0) {
      const width = board[0].length;
      const height = board.length;
      let flagCount = 0;

      for (let i = 0; i < 8; i++) {
        const nx = x + deltas[i];
        const ny = y + deltas[i + 1];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (board[ny][nx].state === TileState.FLAGGED) {
          flagCount++;
        }
      }

      if (flagCount === tile.type) {
        const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));
        for (let i = 0; i < 8; i++) {
          const nx = x + deltas[i];
          const ny = y + deltas[i + 1];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (newBoard[ny][nx].state === TileState.FLAGGED) continue;
          revealFrom(newBoard, nx, ny);
        }
        setBoard(newBoard);
      }
      return;
    }

    if (tile.state === TileState.FLAGGED) return;

    if (tile.type === TileType.BOMB) {
      // We die here
      return;
    }

    // dfs reveal from position and new board
    setBoard((prev) => revealTiles(prev, x, y));
  };

  const handleToggleFlag = (x: number, y: number) => {
    const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));
    const tile = newBoard[y][x];

    if (tile.state === TileState.OPENED) {
      return;
    }

    if (tile.state === TileState.FLAGGED) {
      tile.state = TileState.HIDDEN;
    } else {
      tile.state = TileState.FLAGGED;
    }

    setBoard(newBoard);
  };

  const mineCount = React.useMemo(
    () => board.flat().filter((tile) => tile.type === TileType.BOMB).length,
    [board],
  );
  const flagCount = React.useMemo(
    () => board.flat().filter((tile) => tile.state === TileState.FLAGGED).length,
    [board],
  );

  return (
    <FloatingPanel className="p-0">
      <ResizablePanel
        className="p-0 bg-slate-200"
        title="Minesweeper"
        onClose={props.onExit}
        defaultWidth={460}
        defaultHeight={360}
      >
        <div className="flex flex-col h-full w-full p-3 gap-3 bg-gradient-to-b from-slate-200 to-slate-300">
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-blue-100 border border-slate-400 shadow-inner text-slate-700 font-semibold text-sm">
            <div className="tracking-wide">MINES: {mineCount}</div>
            <div className="tracking-wide">FLAGS: {flagCount}</div>
            <div className="tracking-wide">
              SIZE: {props.width}×{props.height}
            </div>
          </div>
          <div
            className="grid gap-1 w-full h-full p-2 rounded-md bg-slate-400 border border-slate-600 shadow-[inset_2px_2px_0_#f1f5f9,inset_-2px_-2px_0_#64748b]"
            style={{
              gridTemplateColumns: `repeat(${props.width}, 1fr)`,
              gridTemplateRows: `repeat(${props.height}, 1fr)`,
            }}
          >
            {board.flat().map((tile) => (
              <TileUI
                key={`${tile.x}-${tile.y}`}
                tile={tile}
                x={tile.x}
                y={tile.y}
                onReveal={handleReveal}
                onToggleFlag={handleToggleFlag}
              />
            ))}
          </div>
        </div>
      </ResizablePanel>
    </FloatingPanel>
  );
}
