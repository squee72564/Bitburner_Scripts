import { NS } from '@ns';
import { React, ReactDOM, cheatyDocument } from '/ui/react';
import { ServerDfs } from 'lib/dfs';
import { ResizablePanel } from '/ui/components/ResizablePanel';
import { FloatingPanel } from '/ui/components/FloatingPanel';
import { Button } from '/ui/components/Button';
import { colors, font, spacing } from '/ui/theme';

type ConnectControlProps = {
  ns: NS;
  onExit: () => void;
  adj: Map<string, Set<string>>;
};

export async function main(ns: NS): Promise<void> {
  ns.disableLog('asleep');

  const flags = ns.flags([
    ['help', false],
    ['h', false],
  ]);

  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const adj: Map<string, Set<string>> = new Map();

  const graphBuilder = new ServerDfs(ns, {
    onVisit: (ns: NS, host: string): void => {
      const neighbors = ns.scan(host);
      for (const neighbor of neighbors) {
        if (!adj.has(host)) adj.set(host, new Set());
        if (!adj.has(neighbor)) adj.set(neighbor, new Set());
        adj.get(host)!.add(neighbor);
        adj.get(neighbor)!.add(host);
      }
    },
  });

  graphBuilder.traverse();

  const existing = cheatyDocument.getElementById('cc-connect-control-overlay');
  if (existing) {
    existing.remove();
  }
  const overlay = cheatyDocument.createElement('div');
  overlay.id = 'cc-connect-control-overlay';
  cheatyDocument.body.appendChild(overlay);

  let shouldExit = false;
  ReactDOM.render(
    <React.StrictMode>
      <ConnectControl
        ns={ns}
        onExit={() => {
          shouldExit = true;
        }}
        adj={adj}
      />
    </React.StrictMode>,
    overlay,
  );

  while (!shouldExit) {
    await ns.asleep(250);
  }

  ReactDOM.unmountComponentAtNode(overlay);
  overlay.remove();
}

function ConnectControl(props: ConnectControlProps): JSX.Element {
  const { ns, onExit, adj } = props;
  const [pathStrings, setPathStrings] = React.useState<Array<string>>([]);
  const [currentTarget, setCurrentTarget] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<boolean>(false);
  const [hoveredServer, setHoveredServer] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentTarget) {
      setPathStrings([]);
      return;
    }
    const start = ns.getHostname();
    const path = findShortestPath(adj, start, currentTarget);
    const commands = path
      .slice(1)
      .map((server) => `connect ${server};`)
      .join(' ');
    setPathStrings(commands ? [commands] : []);
  }, [adj, currentTarget, ns]);

  return (
    <>
      <FloatingPanel>
        <ResizablePanel
          title="Server Traversal"
          onClose={onExit}
          defaultWidth={560}
          defaultHeight={460}
        >
          <div style={styles.sectionTitle}>Servers</div>
          <div style={styles.card}>
            <div style={styles.scrollArea}>
              {Array.from(adj.keys()).map((server) => (
                <div
                  key={server}
                  style={{
                    ...styles.rowWrap,
                    ...(hoveredServer === server ? styles.rowWrapHover : {}),
                  }}
                  onMouseEnter={() => setHoveredServer(server)}
                  onMouseLeave={() => setHoveredServer(null)}
                  onClick={() => setCurrentTarget(server)}
                >
                  <div
                    style={{
                      ...styles.row,
                      ...(hoveredServer === server ? styles.rowHover : {}),
                    }}
                  >
                    <p>{server}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={styles.sectionTitle}>Path</div>
          <div style={styles.card}>
            {pathStrings.length > 0 ? (
              <>
                <p style={styles.mono}>{pathStrings[0]}</p>
                <div style={styles.actions}>
                  <Button
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(pathStrings[0], ns, () => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      })
                    }
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </>
            ) : (
              <p>Select a server to get its traversal path.</p>
            )}
          </div>
        </ResizablePanel>
      </FloatingPanel>
    </>
  );
}

function copyToClipboard(text: string, ns: NS, onCopied?: () => void): void {
  const nav = navigator as Navigator | undefined;
  if (!nav?.clipboard?.writeText) {
    ns.tprint('WARN clipboard API not available.');
    return;
  }
  nav.clipboard
    .writeText(text)
    .then(() => {
      ns.tprint('INFO copied path to clipboard.');
      onCopied?.();
    })
    .catch(() => {
      ns.tprint('WARN failed to copy to clipboard.');
    });
}

function findShortestPath(adj: Map<string, Set<string>>, start: string, target: string): string[] {
  if (start === target) return [start];
  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adj.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      if (next === target) {
        const path = [target];
        while (path[0] !== start) {
          const prev = parent.get(path[0]);
          if (!prev) break;
          path.unshift(prev);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

function printHelp(ns: NS): void {
  ns.tprint('Usage: run agent/connect-control.js');
  ns.tprint('Examples:');
  ns.tprint('  run agent/server-control.js');
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: {
    fontSize: font.titleSize,
    fontWeight: 600,
    marginBottom: spacing.xs,
  },
  card: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '6px',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scrollArea: {
    maxHeight: '220px',
    overflowY: 'auto',
  },
  rowWrap: {
    width: '100%',
    padding: '2px 4px',
    borderRadius: '6px',
    minHeight: '22px',
  },
  rowWrapHover: {
    background: 'rgba(42, 50, 64, 0.45)',
    border: `1px solid ${colors.accentBorder}`,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
    width: '100%',
    cursor: 'pointer',
  },
  rowHover: {
    background: 'rgba(42, 50, 64, 0.35)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  mono: {
    fontFamily: font.family,
    fontSize: font.size,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};
