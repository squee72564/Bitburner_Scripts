import { React, cheatyDocument } from '/ui/react';
import { colors, font, spacing } from '/ui/theme';
import { CloseButton } from '/ui/components/CloseButton';
import { cn } from '../lib/cn';
import { optional } from 'zod';

type ResizablePanelProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  className?: string;
};

export function ResizablePanel(props: ResizablePanelProps): JSX.Element {
  const {
    title,
    onClose,
    children,
    minWidth = 260,
    minHeight = 200,
    defaultWidth = 320,
    defaultHeight = 230,
  } = props;

  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ w: defaultWidth, h: defaultHeight });
  const dragRef = React.useRef<{ x: number; y: number } | null>(null);
  const resizeRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onMouseDownDrag = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const onMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  };

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        setPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
      } else if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.x;
        const dy = e.clientY - resizeRef.current.y;
        setSize({
          w: Math.max(minWidth, resizeRef.current.w + dx),
          h: Math.max(minHeight, resizeRef.current.h + dy),
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    cheatyDocument.addEventListener('mousemove', onMove);
    cheatyDocument.addEventListener('mouseup', onUp);
    return () => {
      cheatyDocument.removeEventListener('mousemove', onMove);
      cheatyDocument.removeEventListener('mouseup', onUp);
    };
  }, [minWidth, minHeight, pos, size]);

  return (
    <div
      className={cn(
        'relative flex flex-col',
        'overflow-hidden',
        props.className,
      )}
      style={{
        ...styles.container,
        width: size.w,
        height: size.h,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
      }}
    >
      <div style={styles.titleBar} onMouseDown={onMouseDownDrag}>
        <div>{title}</div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={styles.body}>{children}</div>
      <div style={styles.resizeHandle} onMouseDown={onMouseDownResize} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    zIndex: 1,
    padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: '6px',
    background: colors.panelBg,
    color: colors.text,
    fontFamily: font.family,
    fontSize: font.size,
    boxShadow: colors.panelShadow,
    userSelect: 'none',
    pointerEvents: 'auto',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    cursor: 'move',
    fontSize: font.titleSize,
    fontWeight: 600,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  resizeHandle: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: '14px',
    height: '14px',
    cursor: 'nwse-resize',
    borderRight: `2px solid ${colors.resizeHandle}`,
    borderBottom: `2px solid ${colors.resizeHandle}`,
  },
};
