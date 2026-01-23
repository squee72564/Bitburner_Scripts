import React from "/lib/react";

export enum TileState {
  HIDDEN,
  OPENED,
  FLAGGED,
};

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
  BOMB = "B"
};

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
    y
  };
}


export function TileUI({
  tile,
  x,
  y,
  onReveal,
  onToggleFlag,
}: {
  tile: Tile,
  x: number,
  y: number,
  onReveal: (x: number, y: number) => void,
  onToggleFlag: (x: number, y: number) => void,
})  {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    if (e.button === 0) {
      onReveal(x,y);
    } else if (e.button === 2) {
      onToggleFlag(x,y);
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center justify-center border border-slate-500 select-none"
      style={{  width: '100%' }}
    >
      {tile.state === TileState.HIDDEN ? (
        ' '
      ) : tile.state === TileState.OPENED ? (
        tile.state
      ) : (
        'F'
      )}
    </div>
  );
}
