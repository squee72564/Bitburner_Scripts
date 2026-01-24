import React from '/lib/react';

export enum TileState {
  HIDDEN,
  OPENED,
  FLAGGED,
}

export enum TileType {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  BOMB = 'B',
}

export type Tile = {
  state: TileState;
  type: TileType;
  x: number;
  y: number;
};

export function makeTile(x: number, y: number): Tile {
  return {
    state: TileState.HIDDEN,
    type: TileType.ZERO,
    x,
    y,
  };
}

export function TileUI({
  tile,
  x,
  y,
  onReveal,
  onToggleFlag,
}: {
  tile: Tile;
  x: number;
  y: number;
  onReveal: (x: number, y: number) => void;
  onToggleFlag: (x: number, y: number) => void;
}) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    if (e.button === 0) {
      onReveal(x, y);
    } else if (e.button === 2) {
      onToggleFlag(x, y);
    }
  };

  const numberColor = [
    'text-sky-700',
    'text-emerald-700',
    'text-rose-700',
    'text-indigo-700',
    'text-amber-700',
    'text-teal-700',
    'text-fuchsia-700',
    'text-slate-700',
  ];

  const isOpened = tile.state === TileState.OPENED;
  const isFlagged = tile.state === TileState.FLAGGED;
  const isBomb = tile.type === TileType.BOMB;

  let display = '';
  if (isFlagged) {
    display = 'F';
  } else if (isOpened) {
    if (isBomb) {
      display = 'B';
    } else if (tile.type !== TileType.ZERO) {
      display = tile.type.toString();
    }
  }

  let numberClass = '';
  if (isOpened && !isBomb && typeof tile.type === 'number' && tile.type > 0) {
    numberClass = numberColor[tile.type - 1] ?? 'text-slate-700';
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'flex items-center justify-center select-none font-semibold text-sm leading-none w-full h-full',
        isOpened
          ? 'bg-slate-500 border border-slate-600 shadow-inner text-slate-50'
          : 'bg-slate-300 border border-slate-500 shadow-[inset_1px_1px_0_#ffffff,inset_-1px_-1px_0_#9ca3af]',
        isBomb && isOpened ? 'bg-rose-200 text-rose-800' : '',
        isFlagged ? 'text-rose-700' : '',
        numberClass,
      ].join(' ')}
      style={{ width: '100%' }}
    >
      <span className="block text-center">{tile.state === TileState.HIDDEN ? '' : display}</span>
    </div>
  );
}
