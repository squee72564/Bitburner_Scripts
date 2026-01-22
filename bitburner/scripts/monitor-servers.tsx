import { NS } from '@ns';
import { isHome } from '/lib/core/host';
import {
  growThreads,
  growTime,
  hackChance,
  hackPercent,
  hackTime,
  weakenTime,
} from '/lib/hgw/hacking-formulas';
import { React, ReactDOM, cheatyDocument } from '/ui/react';
import { ResizablePanel } from '/ui/components/ResizablePanel';
import { Button } from '/ui/components/Button';
import { Input } from '/ui/components/Input';
import { Select } from '/ui/components/Select';
import { FloatingPanel } from '/ui/components/FloatingPanel';
import { ExpandableList, ExpandableItem } from '/ui/components/ExpandableList';
import { colors, font, spacing } from '/ui/theme';
import { ServerDfs } from '/lib/core/dfs';

type ServerMonitorProps = {
  ns: NS;
  onExit: () => void;
};

type SortKey =
  | 'hostname'
  | 'moneyRatio'
  | 'securityDelta'
  | 'hackChance'
  | 'hackPercent'
  | 'weakenTime'
  | 'requiredSkill'
  | 'targetScore'
  | 'maxMoney';

type SortDirection = 'asc' | 'desc';

type PrepState = 'prepped' | 'near' | 'not';

type ServerRow = {
  hostname: string;
  isHome: boolean;
  isPurchased: boolean;
  hasRoot: boolean;
  hasBackdoor: boolean;
  requiredSkill: number;
  growth: number;
  moneyAvailable: number;
  moneyMax: number;
  moneyRatio: number;
  securityLevel: number;
  securityMin: number;
  securityDelta: number;
  openPorts: number;
  portsRequired: number;
  maxRam: number;
  usedRam: number;
  hackChance: number;
  hackPercent: number;
  hackTime: number;
  growTime: number;
  weakenTime: number;
  growThreadsToMax: number;
  prepState: PrepState;
  isPrepped: boolean;
  targetScore: number;
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

  const overlay = cheatyDocument.createElement('div');
  overlay.id = 'bb-monitor-servers-overlay';
  cheatyDocument.body.appendChild(overlay);

  let shouldExit = false;
  const cleanup = () => {
    if (!overlay.isConnected) return;
    ReactDOM.unmountComponentAtNode(overlay);
    overlay.remove();
  };
  ns.atExit(cleanup);

  ReactDOM.render(
    <React.StrictMode>
      <ServerMonitor
        ns={ns}
        onExit={() => {
          shouldExit = true;
        }}
      />
    </React.StrictMode>,
    overlay,
  );

  while (!shouldExit) {
    await ns.asleep(250);
  }
  cleanup();
}

function ServerMonitor(props: ServerMonitorProps): JSX.Element {
  const { ns, onExit } = props;
  const [rows, setRows] = React.useState<ServerRow[]>([]);
  const [sortKey, setSortKey] = React.useState<SortKey>('targetScore');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const [onlyRooted, setOnlyRooted] = React.useState<boolean>(false);
  const [onlyPrepped, setOnlyPrepped] = React.useState<boolean>(false);
  const [onlyHackable, setOnlyHackable] = React.useState<boolean>(false);
  const [showHome, setShowHome] = React.useState<boolean>(true);
  const [showPurchased, setShowPurchased] = React.useState<boolean>(true);
  const [minMaxMoney, setMinMaxMoney] = React.useState<number>(0);
  const [prepMoneyRatio, setPrepMoneyRatio] = React.useState<number>(0.95);
  const [prepSecurityDelta, setPrepSecurityDelta] = React.useState<number>(1);

  React.useEffect(() => {
    const id = setInterval(() => {
      setRows(
        buildServerRows(ns, {
          minMaxMoney,
          prepMoneyRatio,
          prepSecurityDelta,
          showHome,
          showPurchased,
          onlyRooted,
          onlyPrepped,
          onlyHackable,
        }),
      );
    }, 500);
    return () => clearInterval(id);
  }, [
    ns,
    minMaxMoney,
    prepMoneyRatio,
    prepSecurityDelta,
    showHome,
    showPurchased,
    onlyRooted,
    onlyPrepped,
    onlyHackable,
  ]);

  const sorted = sortRows(rows, sortKey, sortDirection);
  const items: ExpandableItem[] = sorted.map((row) => {
    const prepColor = getPrepColor(row.prepState);
    const moneyColor = getMoneyColor(row.moneyRatio);
    const securityColor = getSecurityColor(row.securityDelta);
    const tags = getTags(row);
    return {
      id: row.hostname,
      header: (
        <div style={styles.headerGrid}>
          <div style={styles.headerIdentity}>
            <div style={styles.name}>{row.hostname}</div>
            <div style={styles.tagRow}>
              {tags.map((tag) => (
                <span key={`${row.hostname}-${tag.label}`} style={tag.style}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
          <div style={styles.headerMetric}>
            <div style={styles.metricLabel}>Money</div>
            <div style={styles.metricValue}>{ns.formatPercent(row.moneyRatio)}</div>
            <div style={styles.bar}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${Math.round(row.moneyRatio * 100)}%`,
                  background: moneyColor,
                }}
              />
            </div>
          </div>
          <div style={styles.headerMetric}>
            <div style={styles.metricLabel}>Security</div>
            <div style={{ ...styles.metricValue, color: securityColor }}>
              {formatFloat(row.securityLevel)} / {formatFloat(row.securityMin)}
            </div>
            <div style={{ ...styles.metricSubValue, color: securityColor }}>
              Δ {formatFloat(row.securityDelta)}
            </div>
          </div>
          <div style={styles.headerMetric}>
            <div style={styles.metricLabel}>Hack</div>
            <div style={styles.metricValue}>Req {row.requiredSkill}</div>
            <div style={styles.metricSubValue}>Chance {ns.formatPercent(row.hackChance)}</div>
          </div>
          <div style={styles.headerMetric}>
            <div style={styles.metricLabel}>Prep</div>
            <div style={{ ...styles.pill, borderColor: prepColor, color: prepColor }}>
              {row.prepState === 'prepped' ? 'Prepped' : row.prepState === 'near' ? 'Near' : 'Not'}
            </div>
          </div>
        </div>
      ),
      content: (
        <div style={styles.detailGrid}>
          <DetailItem label="Money Available" value={`$${ns.formatNumber(row.moneyAvailable)}`} />
          <DetailItem label="Money Max" value={`$${ns.formatNumber(row.moneyMax)}`} />
          <DetailItem label="Money Ratio" value={ns.formatPercent(row.moneyRatio)} />
          <DetailItem label="Security Level" value={formatFloat(row.securityLevel)} />
          <DetailItem label="Security Min" value={formatFloat(row.securityMin)} />
          <DetailItem label="Security Δ" value={formatFloat(row.securityDelta)} />
          <DetailItem label="Hack Chance" value={ns.formatPercent(row.hackChance)} />
          <DetailItem label="Hack %/thread" value={ns.formatPercent(row.hackPercent)} />
          <DetailItem label="Hack Time" value={ns.tFormat(row.hackTime)} />
          <DetailItem label="Grow Time" value={ns.tFormat(row.growTime)} />
          <DetailItem label="Weaken Time" value={ns.tFormat(row.weakenTime)} />
          <DetailItem
            label="Grow Threads to Max"
            value={
              Number.isFinite(row.growThreadsToMax) ? `${Math.ceil(row.growThreadsToMax)}` : '—'
            }
          />
          <DetailItem label="Growth" value={`${row.growth}`} />
          <DetailItem label="Ports (open/req)" value={`${row.openPorts}/${row.portsRequired}`} />
          <DetailItem label="Root Access" value={row.hasRoot ? 'Yes' : 'No'} />
          <DetailItem label="Backdoor" value={row.hasBackdoor ? 'Yes' : 'No'} />
          <DetailItem
            label="RAM Used"
            value={
              row.maxRam > 0 ? `${ns.formatRam(row.usedRam)} / ${ns.formatRam(row.maxRam)}` : '—'
            }
          />
          <DetailItem label="Purchased" value={row.isPurchased ? 'Yes' : 'No'} />
          <DetailItem label="Home" value={row.isHome ? 'Yes' : 'No'} />
          <DetailItem label="Target Score" value={formatFloat(row.targetScore)} />
        </div>
      ),
    };
  });

  return (
    <FloatingPanel>
      <ResizablePanel
        title="Server Monitor"
        onClose={onExit}
        defaultWidth={760}
        defaultHeight={560}
      >
        <div style={styles.sectionTitle}>Controls</div>
        <div style={styles.card}>
          <div style={styles.controlsRow}>
            <div style={styles.controlGroup}>
              <div style={styles.label}>Sort</div>
              <Select
                value={sortKey}
                onChange={(value) => setSortKey(value as SortKey)}
                options={getSortOptions()}
              />
            </div>
            <div style={styles.controlGroup}>
              <div style={styles.label}>Direction</div>
              <Button
                variant="outline"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </div>
            <div style={styles.controlGroup}>
              <div style={styles.label}>Min Max $</div>
              <Input
                type="number"
                value={String(minMaxMoney)}
                onChange={(value) => {
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setMinMaxMoney(Math.max(0, parsed));
                }}
              />
            </div>
          </div>
          <div style={styles.controlsRow}>
            <div style={styles.controlGroup}>
              <div style={styles.label}>Prep $ Ratio</div>
              <Input
                type="number"
                value={String(prepMoneyRatio)}
                onChange={(value) => {
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setPrepMoneyRatio(clamp(parsed, 0, 1));
                }}
              />
            </div>
            <div style={styles.controlGroup}>
              <div style={styles.label}>Prep Sec Δ</div>
              <Input
                type="number"
                value={String(prepSecurityDelta)}
                onChange={(value) => {
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setPrepSecurityDelta(Math.max(0, parsed));
                }}
              />
            </div>
          </div>
          <div style={styles.controlsRow}>
            <ToggleButton label="Only Rooted" active={onlyRooted} onClick={setOnlyRooted} />
            <ToggleButton label="Only Prepped" active={onlyPrepped} onClick={setOnlyPrepped} />
            <ToggleButton label="Only Hackable" active={onlyHackable} onClick={setOnlyHackable} />
            <ToggleButton label="Show Home" active={showHome} onClick={setShowHome} />
            <ToggleButton
              label="Show Purchased"
              active={showPurchased}
              onClick={setShowPurchased}
            />
          </div>
        </div>

        <div style={styles.sectionTitle}>Servers</div>
        <div style={styles.list}>
          {items.length === 0 && <div style={styles.muted}>No servers match filters.</div>}
          {items.length > 0 && <ExpandableList items={items} />}
        </div>
        <div style={styles.footer}>
          <div style={styles.muted}>Servers: {items.length}</div>
          <div style={styles.muted}>Avg money: {formatAverageMoney(ns, rows)}</div>
          <div style={styles.muted}>Avg sec Δ: {formatAverageSecurity(rows)}</div>
        </div>
      </ResizablePanel>
    </FloatingPanel>
  );
}

function ToggleButton(props: {
  label: string;
  active: boolean;
  onClick: React.Dispatch<React.SetStateAction<boolean>>;
}): JSX.Element {
  return (
    <Button
      variant={props.active ? 'default' : 'outline'}
      size="sm"
      onClick={() => props.onClick((prev) => !prev)}
    >
      {props.label}
    </Button>
  );
}

function DetailItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>{props.label}</div>
      <div style={styles.detailValue}>{props.value}</div>
    </div>
  );
}

function buildServerRows(
  ns: NS,
  filters: {
    minMaxMoney: number;
    prepMoneyRatio: number;
    prepSecurityDelta: number;
    showHome: boolean;
    showPurchased: boolean;
    onlyRooted: boolean;
    onlyPrepped: boolean;
    onlyHackable: boolean;
  },
): ServerRow[] {
  const player = ns.getPlayer();
  const servers = collectServers(ns);
  const rows: ServerRow[] = [];
  for (const host of servers) {
    const server = ns.getServer(host);
    const isHomeHost = isHome(host);
    const isPurchased = Boolean(server.purchasedByPlayer);
    if (!filters.showHome && isHomeHost) continue;
    if (!filters.showPurchased && isPurchased) continue;

    const moneyMax = server.moneyMax ?? 0;
    if (moneyMax < filters.minMaxMoney) continue;

    const moneyAvailable = server.moneyAvailable ?? 0;
    const moneyRatio = moneyMax > 0 ? moneyAvailable / moneyMax : 0;
    const securityMin = server.minDifficulty ?? 0;
    const securityLevel = server.hackDifficulty ?? 0;
    const securityDelta = securityLevel - securityMin;
    const requiredSkill = server.requiredHackingSkill ?? 0;
    const hasRoot = Boolean(server.hasAdminRights);

    if (filters.onlyRooted && !hasRoot) continue;
    if (filters.onlyHackable && requiredSkill > player.skills.hacking) continue;

    const hackChanceValue = hackChance(ns, server, player);
    const hackPercentValue = hackPercent(ns, server, player);
    const hackTimeValue = hackTime(ns, server, player);
    const growTimeValue = growTime(ns, server, player);
    const weakenTimeValue = weakenTime(ns, server, player);
    const growThreadsValue = growThreads(ns, server, player, moneyMax);

    const { prepState, isPrepped } = getPrepState(
      moneyRatio,
      securityDelta,
      filters.prepMoneyRatio,
      filters.prepSecurityDelta,
    );

    if (filters.onlyPrepped && !isPrepped) continue;

    const targetScore = getTargetScore(moneyRatio, hackChanceValue, weakenTimeValue);

    rows.push({
      hostname: host,
      isHome: isHomeHost,
      isPurchased,
      hasRoot,
      hasBackdoor: Boolean(server.backdoorInstalled),
      requiredSkill,
      growth: server.serverGrowth ?? 0,
      moneyAvailable,
      moneyMax,
      moneyRatio,
      securityLevel,
      securityMin,
      securityDelta,
      openPorts: server.openPortCount ?? 0,
      portsRequired: server.numOpenPortsRequired ?? 0,
      maxRam: server.maxRam ?? 0,
      usedRam: server.ramUsed ?? 0,
      hackChance: hackChanceValue,
      hackPercent: hackPercentValue,
      hackTime: hackTimeValue,
      growTime: growTimeValue,
      weakenTime: weakenTimeValue,
      growThreadsToMax: growThreadsValue,
      prepState,
      isPrepped,
      targetScore,
    });
  }
  return rows;
}

function collectServers(ns: NS): string[] {
  const servers: string[] = [];
  const dfs = new ServerDfs(ns, {
    onVisit: (_ns, host) => {
      servers.push(host);
    },
  });
  dfs.traverse('home');
  return servers;
}

function sortRows(rows: ServerRow[], key: SortKey, direction: SortDirection): ServerRow[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'hostname') {
      return a.hostname.localeCompare(b.hostname) * multiplier;
    }
    const aValue = getSortValue(a, key);
    const bValue = getSortValue(b, key);
    if (aValue === bValue) {
      return a.hostname.localeCompare(b.hostname);
    }
    return (aValue - bValue) * multiplier;
  });
}

function getSortValue(row: ServerRow, key: SortKey): number {
  switch (key) {
    case 'moneyRatio':
      return safeNumber(row.moneyRatio);
    case 'securityDelta':
      return safeNumber(row.securityDelta);
    case 'hackChance':
      return safeNumber(row.hackChance);
    case 'hackPercent':
      return safeNumber(row.hackPercent);
    case 'weakenTime':
      return safeNumber(row.weakenTime);
    case 'requiredSkill':
      return safeNumber(row.requiredSkill);
    case 'targetScore':
      return safeNumber(row.targetScore);
    case 'maxMoney':
      return safeNumber(row.moneyMax);
    default:
      return 0;
  }
}

function getSortOptions(): { value: SortKey; label: string }[] {
  return [
    { value: 'hostname', label: 'Hostname' },
    { value: 'targetScore', label: 'Target score' },
    { value: 'moneyRatio', label: 'Money ratio' },
    { value: 'maxMoney', label: 'Max money' },
    { value: 'securityDelta', label: 'Security Δ' },
    { value: 'hackChance', label: 'Hack chance' },
    { value: 'hackPercent', label: 'Hack %/thread' },
    { value: 'weakenTime', label: 'Weaken time' },
    { value: 'requiredSkill', label: 'Required level' },
  ];
}

function getTargetScore(moneyRatio: number, chance: number, weakenTimeValue: number): number {
  const time = Math.max(weakenTimeValue, 1);
  return (moneyRatio * chance) / (time / 1000);
}

function getPrepState(
  moneyRatio: number,
  securityDelta: number,
  moneyThreshold: number,
  securityThreshold: number,
): { prepState: PrepState; isPrepped: boolean } {
  const isPrepped = moneyRatio >= moneyThreshold && securityDelta <= securityThreshold;
  if (isPrepped) {
    return { prepState: 'prepped', isPrepped: true };
  }

  const nearMoney = moneyRatio >= Math.max(0, moneyThreshold - 0.1);
  const nearSecurity = securityDelta <= securityThreshold + 5;
  if (nearMoney && nearSecurity) {
    return { prepState: 'near', isPrepped: false };
  }

  return { prepState: 'not', isPrepped: false };
}

function getTags(row: ServerRow): { label: string; style: React.CSSProperties }[] {
  const tags: { label: string; style: React.CSSProperties }[] = [];
  if (row.isHome) {
    tags.push({ label: 'home', style: styles.tagHome });
  }
  if (row.isPurchased) {
    tags.push({ label: 'pserv', style: styles.tagPurchased });
  }
  if (row.hasRoot) {
    tags.push({ label: 'rooted', style: styles.tagRoot });
  }
  if (row.hasBackdoor) {
    tags.push({ label: 'backdoor', style: styles.tagBackdoor });
  }
  return tags;
}

function getMoneyColor(ratio: number): string {
  if (ratio >= 0.9) return '#3fbf7f';
  if (ratio >= 0.7) return '#d9a441';
  return '#d94c4c';
}

function getSecurityColor(delta: number): string {
  if (delta <= 1) return '#3fbf7f';
  if (delta <= 5) return '#d9a441';
  return '#d94c4c';
}

function getPrepColor(state: PrepState): string {
  if (state === 'prepped') return '#3fbf7f';
  if (state === 'near') return '#d9a441';
  return '#d94c4c';
}

function formatFloat(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatAverageMoney(ns: NS, rows: ServerRow[]): string {
  const eligible = rows.filter((row) => row.moneyMax > 0);
  if (eligible.length === 0) return '—';
  const avg = eligible.reduce((sum, row) => sum + row.moneyRatio, 0) / eligible.length;
  return ns.formatPercent(avg);
}

function formatAverageSecurity(rows: ServerRow[]): string {
  if (rows.length === 0) return '—';
  const avg = rows.reduce((sum, row) => sum + row.securityDelta, 0) / rows.length;
  return formatFloat(avg);
}

function printHelp(ns: NS): void {
  ns.tprint(`Usage: run ${ns.getScriptName()}`);
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
  controlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    minWidth: '140px',
    flex: '1 1 160px',
  },
  headerGrid: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  headerIdentity: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    flex: '1 1 220px',
    minWidth: '180px',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagHome: {
    border: '1px solid #4a7dff',
    color: '#4a7dff',
    borderRadius: '999px',
    fontSize: '10px',
    padding: '2px 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tagPurchased: {
    border: '1px solid #8c7cff',
    color: '#8c7cff',
    borderRadius: '999px',
    fontSize: '10px',
    padding: '2px 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tagRoot: {
    border: '1px solid #3fbf7f',
    color: '#3fbf7f',
    borderRadius: '999px',
    fontSize: '10px',
    padding: '2px 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tagBackdoor: {
    border: '1px solid #f5b562',
    color: '#f5b562',
    borderRadius: '999px',
    fontSize: '10px',
    padding: '2px 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  headerMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: '1 1 140px',
    minWidth: '110px',
  },
  metricLabel: {
    fontSize: '10px',
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontWeight: 600,
  },
  metricSubValue: {
    fontSize: '10px',
    opacity: 0.8,
  },
  bar: {
    width: '100%',
    height: '6px',
    background: '#131922',
    borderRadius: '999px',
    overflow: 'hidden',
    border: `1px solid ${colors.accentBorder}`,
  },
  barFill: {
    height: '100%',
  },
  pill: {
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: '999px',
    padding: '2px 8px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    width: 'fit-content',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: spacing.sm,
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  detailLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  detailValue: {
    fontWeight: 500,
  },
};
