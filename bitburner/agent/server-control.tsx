import { NS } from '@ns';
import { React, ReactDOM, cheatyDocument } from '/ui/react';
import { ResizablePanel } from '/ui/components/ResizablePanel';
import { Button } from '/ui/components/Button';
import { Input } from '/ui/components/Input';
import { Select } from '/ui/components/Select';
import { FloatingPanel } from '/ui/components/FloatingPanel';
import { ConfirmModal } from '/ui/components/ConfirmModal';
import { colors, font, spacing } from '/ui/theme';

type ServerControlProps = {
  ns: NS;
  onExit: () => void;
  prefix: string;
};

type ServerRow = {
  name: string;
  maxRam: number;
  usedRam: number;
  scriptCount: number;
  scripts: ReturnType<NS['ps']>;
};

type ConfirmState =
  | { type: 'none' }
  | { type: 'buy'; ram: number; cost: number }
  | { type: 'kill'; host: string; count: number }
  | { type: 'sell'; host: string; ram: number };

export async function main(ns: NS): Promise<void> {
  ns.disableLog('asleep');
  const flags = ns.flags([
    ['prefix', 'pserv'],
    ['help', false],
    ['h', false],
  ]);

  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const overlay = cheatyDocument.createElement('div');
  overlay.id = 'bb-server-control-overlay';
  cheatyDocument.body.appendChild(overlay);

  let shouldExit = false;
  ReactDOM.render(
    <React.StrictMode>
      <ServerControl
        ns={ns}
        onExit={() => {
          shouldExit = true;
        }}
        prefix={String(flags.prefix)}
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

function ServerControl(props: ServerControlProps): JSX.Element {
  const { ns, onExit, prefix } = props;
  const [selectedRam, setSelectedRam] = React.useState<number>(2);
  const [money, setMoney] = React.useState<number>(ns.getServerMoneyAvailable('home'));
  const [purchased, setPurchased] = React.useState<number>(ns.getPurchasedServers().length);
  const [prefixValue, setPrefixValue] = React.useState<string>(prefix);
  const [rows, setRows] = React.useState<ServerRow[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = React.useState<ConfirmState>({ type: 'none' });

  const limit = ns.getPurchasedServerLimit();
  const maxRam = ns.getPurchasedServerMaxRam();

  React.useEffect(() => {
    const id = setInterval(() => {
      setMoney(ns.getServerMoneyAvailable('home'));
      setPurchased(ns.getPurchasedServers().length);
      setRows(getServerRows(ns));
    }, 500);
    return () => clearInterval(id);
  }, [ns]);

  const options = getRamOptions(maxRam);
  const cost = ns.getPurchasedServerCost(selectedRam);
  const canAfford = Number.isFinite(cost) && cost <= money;
  const canBuyMore = purchased < limit;

  const onBuy = () => {
    if (!canBuyMore) {
      ns.tprint(`WARN purchased server limit reached (${purchased}/${limit}).`);
      return;
    }
    if (!canAfford) {
      ns.tprint('WARN not enough money to purchase this server.');
      return;
    }
    setConfirm({ type: 'buy', ram: selectedRam, cost });
  };

  return (
    <>
      <FloatingPanel>
        <ResizablePanel
          title="Server Control"
          onClose={onExit}
          defaultWidth={560}
          defaultHeight={460}
        >
          <div style={styles.sectionTitle}>Purchase</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.label}>Prefix</div>
              <Input value={prefixValue} onChange={setPrefixValue} />
            </div>
            <div style={styles.row}>
              <div style={styles.label}>RAM</div>
              <Select
                value={selectedRam}
                onChange={(value) => setSelectedRam(Number(value))}
                options={options.map((ram) => ({ value: ram, label: ns.formatRam(ram) }))}
              />
            </div>
            <div style={styles.row}>
              <div style={styles.label}>Cost</div>
              <div style={styles.value}>${ns.formatNumber(cost)}</div>
            </div>
            <div style={styles.row}>
              <div style={styles.label}>Money</div>
              <div style={styles.value}>${ns.formatNumber(money)}</div>
            </div>
            <div style={styles.row}>
              <div style={styles.label}>Purchased</div>
              <div style={styles.value}>
                {purchased}/{limit}
              </div>
            </div>
            <div style={styles.actions}>
              <Button onClick={onBuy} disabled={!canAfford || !canBuyMore}>
                Buy
              </Button>
            </div>
          </div>

          <div style={styles.sectionTitle}>Owned Servers</div>
          <div style={styles.list}>
            {rows.length === 0 && <div style={styles.muted}>No purchased servers.</div>}
            {rows.map((row) => {
              const isExpanded = Boolean(expanded[row.name]);
              const canSell = row.scriptCount === 0;
              return (
                <div key={row.name} style={styles.listItem}>
                  <div style={styles.row}>
                    <button
                      style={styles.expand}
                      onClick={() => setExpanded({ ...expanded, [row.name]: !isExpanded })}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div style={styles.name}>{row.name}</div>
                    <div style={styles.value}>
                      {ns.formatRam(row.usedRam)} / {ns.formatRam(row.maxRam)}
                    </div>
                    <div style={styles.value}>{row.scriptCount} scripts</div>
                    <div style={styles.actionsInline}>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setConfirm({ type: 'kill', host: row.name, count: row.scriptCount })
                        }
                      >
                        Kill
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          setConfirm({ type: 'sell', host: row.name, ram: row.maxRam })
                        }
                        disabled={!canSell}
                      >
                        Sell
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={styles.expandPanel}>
                      {row.scripts.length === 0 && (
                        <div style={styles.muted}>No running scripts.</div>
                      )}
                      {row.scripts.map((proc) => (
                        <div key={`${row.name}-${proc.pid}`} style={styles.scriptRow}>
                          <div style={styles.scriptName}>{proc.filename}</div>
                          <div style={styles.scriptMeta}>t={proc.threads}</div>
                          <div style={styles.scriptMeta}>
                            args={proc.args.map((arg) => String(arg)).join(' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={styles.footer}>
            <div style={styles.muted}>
              Total purchased: {purchased}/{limit}
            </div>
            <div style={styles.muted}>
              Total RAM: {ns.formatRam(rows.reduce((sum, row) => sum + row.maxRam, 0))}
            </div>
          </div>
        </ResizablePanel>
      </FloatingPanel>
      {renderConfirmModal(ns, confirm, {
        prefix: prefixValue,
        onClose: () => setConfirm({ type: 'none' }),
      })}
    </>
  );
}

function getServerRows(ns: NS): ServerRow[] {
  const rows: ServerRow[] = [];
  for (const host of ns.getPurchasedServers()) {
    const scripts = ns.ps(host);
    rows.push({
      name: host,
      maxRam: ns.getServerMaxRam(host),
      usedRam: ns.getServerUsedRam(host),
      scriptCount: scripts.length,
      scripts,
    });
  }
  return rows;
}

function renderConfirmModal(
  ns: NS,
  confirm: ConfirmState,
  ctx: { prefix: string; onClose: () => void },
): JSX.Element | null {
  if (confirm.type === 'none') return null;

  if (confirm.type === 'buy') {
    return (
      <ConfirmModal
        title="Confirm purchase"
        message={`Buy ${ns.formatRam(confirm.ram)} for $${ns.formatNumber(confirm.cost)}?`}
        onCancel={ctx.onClose}
        onConfirm={() => {
          const hostname = ns.purchaseServer(ctx.prefix, confirm.ram);
          if (hostname) {
            ns.tprint(`SUCCESS purchased ${hostname} (${ns.formatRam(confirm.ram)})`);
          } else {
            ns.tprint('WARN purchase failed (insufficient funds or limit reached).');
          }
          ctx.onClose();
        }}
      />
    );
  }

  if (confirm.type === 'kill') {
    return (
      <ConfirmModal
        title="Confirm kill"
        message={`Kill ${confirm.count} scripts on ${confirm.host}?`}
        onCancel={ctx.onClose}
        onConfirm={() => {
          ns.killall(confirm.host);
          ns.tprint(`INFO killed scripts on ${confirm.host}`);
          ctx.onClose();
        }}
      />
    );
  }

  return (
    <ConfirmModal
      title="Confirm sell"
      message={`Sell ${confirm.host} (${ns.formatRam(confirm.ram)})?`}
      confirmVariant="destructive"
      onCancel={ctx.onClose}
      onConfirm={() => {
        const ok = ns.deleteServer(confirm.host);
        if (ok) {
          ns.tprint(`SUCCESS sold ${confirm.host}`);
        } else {
          ns.tprint(`WARN failed to sell ${confirm.host} (scripts running?)`);
        }
        ctx.onClose();
      }}
    />
  );
}

function getRamOptions(maxRam: number): number[] {
  const options: number[] = [];
  for (let ram = 2; ram <= maxRam; ram *= 2) {
    options.push(ram);
  }
  return options;
}

function printHelp(ns: NS): void {
  ns.tprint('Usage: run agent/server-control.js [--prefix name]');
  ns.tprint('Examples:');
  ns.tprint('  run agent/server-control.js');
  ns.tprint('  run agent/server-control.js --prefix pserv');
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listItem: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '6px',
    padding: spacing.sm,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  name: {
    minWidth: '140px',
    fontWeight: 600,
  },
  label: {
    opacity: 0.8,
  },
  value: {
    textAlign: 'right',
  },
  actions: {
    display: 'flex',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsInline: {
    display: 'flex',
    gap: spacing.xs,
  },
  expand: {
    background: 'transparent',
    color: colors.text,
    border: 'none',
    cursor: 'pointer',
    width: '20px',
  },
  expandPanel: {
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  scriptRow: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  scriptName: {
    minWidth: '140px',
  },
  scriptMeta: {
    opacity: 0.8,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  muted: {
    opacity: 0.7,
  },
  text: {
    fontFamily: font.family,
    fontSize: font.size,
  },
};
