import { React } from '/ui/react';
import { cn } from '/ui/lib/cn';
import { colors, font, spacing } from '/ui/theme';

export type ExpandableItem = {
  id: string;
  header: React.ReactNode;
  content: React.ReactNode;
  actions?: React.ReactNode;
};

export type ExpandableListProps = {
  items: ExpandableItem[];
  defaultExpandedIds?: string[];
  className?: string;
  itemClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (id: string, expanded: boolean) => void;
};

export function ExpandableList(props: ExpandableListProps): JSX.Element {
  const {
    items,
    defaultExpandedIds,
    className,
    itemClassName,
    headerClassName,
    contentClassName,
    onToggle,
  } = props;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const id of defaultExpandedIds ?? []) {
      initial[id] = true;
    }
    return initial;
  });

  return (
    <div className={cn(className)} style={styles.list}>
      {items.map((item) => {
        const isExpanded = Boolean(expanded[item.id]);
        return (
          <div key={item.id} className={cn(itemClassName)} style={styles.item}>
            <div style={styles.headerRow}>
              <button
                className={cn(headerClassName)}
                style={styles.headerButton}
                onClick={() => {
                  const next = !isExpanded;
                  setExpanded({ ...expanded, [item.id]: next });
                  onToggle?.(item.id, next);
                }}
              >
                <span style={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
                <div style={styles.headerContent}>{item.header}</div>
              </button>
              {item.actions ? <div style={styles.headerActions}>{item.actions}</div> : null}
            </div>
            {isExpanded && (
              <div className={cn(contentClassName)} style={styles.content}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  item: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '6px',
    background: colors.panelBg,
  },
  headerButton: {
    flex: 1,
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: colors.text,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 0,
    fontFamily: font.family,
    fontSize: font.size,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevron: {
    display: 'inline-flex',
    width: '14px',
    justifyContent: 'center',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  content: {
    padding: `${spacing.xs} ${spacing.lg}`,
    color: colors.textDim,
  },
};
