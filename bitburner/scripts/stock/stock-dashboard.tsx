import { AutocompleteData, NS } from '@ns';
import { React, ReactDOM, cheatyDocument } from '/ui/react';
import { FloatingPanel } from '/ui/components/FloatingPanel';
import { ResizablePanel } from '/ui/components/ResizablePanel';
import { Input } from '/ui/components/Input';
import { Button } from '/ui/components/Button';
import { colors, font, spacing } from '/ui/theme';
import { TelemetrySnapshot } from 'lib/stock/index.js';
import { cleanup, createOverlay } from '/ui/lib/utils';

type StockDashboardProps = {
  ns: NS;
  onExit: () => void;
  telemetryFile: string;
  refreshMs: number;
};

type PositionRow = TelemetrySnapshot['positions'][number] & {
  pnl: number;
};

const FLAG_SCHEMA: [string, string | number | boolean][] = [
  ['telemetry-file', 'data/stock-telemetry.json'],
  ['refresh-ms', 500],
  ['help', false],
  ['h', false],
];

export async function main(ns: NS): Promise<void> {
  ns.disableLog('asleep');

  const flags = ns.flags(FLAG_SCHEMA);
  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const telemetryFile = String(flags['telemetry-file'] || 'data/stock-telemetry.json');
  const refreshMs = Math.max(200, Number(flags['refresh-ms']) || 500);

  const overlay = createOverlay('bb-stock-dashboard-overlay');

  let shouldExit = false;
  ns.atExit(() => cleanup(overlay));

  ReactDOM.render(
    <React.StrictMode>
      <StockDashboard
        ns={ns}
        onExit={() => {
          shouldExit = true;
        }}
        telemetryFile={telemetryFile}
        refreshMs={refreshMs}
      />
    </React.StrictMode>,
    overlay,
  );

  while (!shouldExit) {
    await ns.asleep(250);
  }
  cleanup(overlay);
}

export function autocomplete(data: AutocompleteData): string[] {
  data.flags(FLAG_SCHEMA);
  return [];
}

function StockDashboard(props: StockDashboardProps): JSX.Element {
  const { ns, onExit, telemetryFile, refreshMs } = props;
  const [snapshot, setSnapshot] = React.useState<TelemetrySnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>('');
  const [filePath, setFilePath] = React.useState<string>(telemetryFile);

  React.useEffect(() => {
    const load = () => {
      const raw = ns.read(filePath);
      if (!raw) {
        setSnapshot(null);
        setError(`No telemetry found at ${filePath}.`);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as TelemetrySnapshot;
        setSnapshot(parsed);
        setError(null);
      } catch {
        setSnapshot(null);
        setError('Telemetry JSON is invalid.');
      }
    };

    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [ns, filePath, refreshMs]);

  const positions: PositionRow[] = React.useMemo(() => {
    if (!snapshot) return [];
    const normalized = filter.trim().toLowerCase();
    return snapshot.positions
      .map((pos) => ({
        ...pos,
        pnl:
          (pos.marketPrice - pos.avgLongPrice) * pos.sharesLong +
          (pos.avgShortPrice - pos.marketPrice) * pos.sharesShort,
      }))
      .filter((pos) => (!normalized ? true : pos.sym.toLowerCase().includes(normalized)))
      .sort((a, b) => a.sym.localeCompare(b.sym));
  }, [snapshot, filter]);

  const orders = React.useMemo(() => {
    if (!snapshot) return [];
    const normalized = filter.trim().toLowerCase();
    const rows: Array<{
      sym: string;
      type: string;
      position: string;
      shares: number;
      price: number;
    }> = [];
    for (const [sym, entries] of Object.entries(snapshot.openOrders)) {
      if (normalized && !sym.toLowerCase().includes(normalized)) continue;
      for (const entry of entries) {
        rows.push({
          sym,
          type: entry.type,
          position: entry.position,
          shares: entry.shares,
          price: entry.price,
        });
      }
    }
    return rows.sort((a, b) => a.sym.localeCompare(b.sym));
  }, [snapshot, filter]);

  const lastUpdated = snapshot?.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString() : '—';
  const tick = snapshot?.tick ?? 0;
  const cash = snapshot ? ns.formatNumber(snapshot.cash) : '—';
  const pnlRealized = snapshot ? ns.formatNumber(snapshot.pnl.realized) : '—';
  const pnlUnrealized = snapshot ? ns.formatNumber(snapshot.pnl.unrealized) : '—';

  return (
    <FloatingPanel>
      <ResizablePanel
        title="Stock Telemetry"
        onClose={onExit}
        defaultWidth={920}
        defaultHeight={640}
      >
        <div style={styles.panel}>
          <div style={styles.toolbar}>
            <div style={styles.inputWrap}>
              <Input value={filePath} onChange={setFilePath} placeholder="Telemetry file path" />
            </div>
            <div style={styles.inputWrap}>
              <Input value={filter} onChange={setFilter} placeholder="Filter symbol..." />
            </div>
            <Button variant="outline" onClick={onExit}>
              Close
            </Button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Tick</div>
              <div style={styles.statValue}>{tick}</div>
              <div style={styles.statSub}>
                Last update: {lastUpdated} · Mode: {snapshot?.mode ?? '—'}
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Cash</div>
              <div style={styles.statValue}>{cash}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>P&L</div>
              <div style={styles.statValue}>{pnlRealized}</div>
              <div style={styles.statSub}>Unrealized: {pnlUnrealized}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Access</div>
              <div style={styles.accessRow}>
                <span>WSE: {snapshot?.access.hasWSE ? 'Y' : 'N'}</span>
                <span>TIX: {snapshot?.access.hasTIX ? 'Y' : 'N'}</span>
                <span>4S: {snapshot?.access.has4SData ? 'Y' : 'N'}</span>
                <span>4S TIX: {snapshot?.access.has4STIX ? 'Y' : 'N'}</span>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Last Actions</div>
              <div style={styles.accessRow}>
                <span>Placed: {snapshot?.lastActions.placed ?? 0}</span>
                <span>Rejected: {snapshot?.lastActions.rejected ?? 0}</span>
                <span>Cancelled: {snapshot?.lastActions.cancelled ?? 0}</span>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Positions</div>
            <div style={styles.table}>
              <div style={{ ...styles.positionsRow, ...styles.headerRow }}>
                <div>Symbol</div>
                <div>Long</div>
                <div>Avg Long</div>
                <div>Short</div>
                <div>Avg Short</div>
                <div>Market</div>
                <div>P&L</div>
              </div>
              <div style={styles.tableBody}>
                {positions.length === 0 && <div style={styles.empty}>No positions to display.</div>}
                {positions.map((pos) => (
                  <div key={pos.sym} style={styles.positionsRow}>
                    <div style={styles.mono}>{pos.sym}</div>
                    <div>{ns.formatNumber(pos.sharesLong)}</div>
                    <div>{ns.formatNumber(pos.avgLongPrice)}</div>
                    <div>{ns.formatNumber(pos.sharesShort)}</div>
                    <div>{ns.formatNumber(pos.avgShortPrice)}</div>
                    <div>{ns.formatNumber(pos.marketPrice)}</div>
                    <div style={pos.pnl >= 0 ? styles.positive : styles.negative}>
                      {ns.formatNumber(pos.pnl)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Open Orders</div>
            <div style={styles.table}>
              <div style={{ ...styles.ordersRow, ...styles.headerRow }}>
                <div>Symbol</div>
                <div>Type</div>
                <div>Position</div>
                <div>Shares</div>
                <div>Price</div>
              </div>
              <div style={styles.tableBody}>
                {orders.length === 0 && <div style={styles.empty}>No open orders.</div>}
                {orders.map((order, index) => (
                  <div key={`${order.sym}-${order.type}-${index}`} style={styles.ordersRow}>
                    <div style={styles.mono}>{order.sym}</div>
                    <div>{order.type}</div>
                    <div>{order.position}</div>
                    <div>{ns.formatNumber(order.shares)}</div>
                    <div>{ns.formatNumber(order.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </FloatingPanel>
  );
}

function printHelp(ns: NS): void {
  ns.tprint(
    'Usage: run scripts/stock/stock-dashboard.js [--telemetry-file data/stock-telemetry.json] [--refresh-ms 500]',
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: spacing.md,
    minHeight: 0,
  },
  toolbar: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
  },
  error: {
    color: colors.textDim,
    fontSize: font.size,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: spacing.sm,
  },
  statCard: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '8px',
    padding: spacing.sm,
    background: 'rgba(12, 18, 30, 0.65)',
  },
  statLabel: {
    fontSize: font.size,
    color: colors.textDim,
  },
  statValue: {
    fontSize: font.titleSize,
    fontWeight: 600,
  },
  statSub: {
    marginTop: spacing.xs,
    fontSize: font.size,
    color: colors.textDim,
  },
  accessRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    fontSize: font.size,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  sectionTitle: {
    fontSize: font.titleSize,
    fontWeight: 600,
    marginBottom: spacing.xs,
  },
  table: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: 0,
  },
  tableBody: {
    maxHeight: '180px',
    overflowY: 'auto',
  },
  positionsRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.8fr 1fr 0.8fr 1fr 1fr 1fr',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderBottom: `1px solid ${colors.accentBorder}`,
    fontSize: font.size,
  },
  ordersRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 2fr 1fr 1fr 1fr',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderBottom: `1px solid ${colors.accentBorder}`,
    fontSize: font.size,
  },
  headerRow: {
    fontWeight: 600,
    background: 'rgba(18, 26, 40, 0.7)',
  },
  mono: {
    fontFamily: font.family,
    fontSize: font.size,
  },
  empty: {
    padding: spacing.sm,
    color: colors.textDim,
  },
  positive: {
    color: '#7fd88b',
  },
  negative: {
    color: '#f07d7d',
  },
};
