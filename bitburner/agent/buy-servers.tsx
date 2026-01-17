import { NS } from "@ns";
import { React, ReactDOM, cheatyDocument } from "/ui/react";
import { ResizablePanel } from "/ui/components/ResizablePanel";
import { Button } from "/ui/components/Button";
import { Select } from "/ui/components/Select";
import { colors, font, spacing } from "/ui/theme";
import { FloatingPanel } from "/ui/components/FloatingPanel";

type BuyMenuProps = {
  ns: NS;
  onExit: () => void;
};

export async function main(ns: NS): Promise<void> {
  ns.disableLog("asleep");
  const flags = ns.flags([
    ["prefix", "pserv"],
    ["help", false],
    ["h", false],
  ]);

  if (flags.help || flags.h) {
    printHelp(ns);
    return;
  }

  const overlay = cheatyDocument.createElement("div");
  overlay.id = "bb-buy-servers-overlay";
  cheatyDocument.body.appendChild(overlay);

  let shouldExit = false;
  ReactDOM.render(
    <React.StrictMode>
      <BuyMenu ns={ns} onExit={() => { shouldExit = true; }} prefix={String(flags.prefix)} />
    </React.StrictMode>,
    overlay
  );

  while (!shouldExit) {
    await ns.asleep(250);
  }
  ReactDOM.unmountComponentAtNode(overlay);
  overlay.remove();
}

function BuyMenu(props: BuyMenuProps & { prefix: string }): JSX.Element {
  const { ns, onExit, prefix } = props;
  const [selectedRam, setSelectedRam] = React.useState<number>(2);
  const [money, setMoney] = React.useState<number>(ns.getServerMoneyAvailable("home"));
  const [purchased, setPurchased] = React.useState<number>(ns.getPurchasedServers().length);
  const limit = ns.getPurchasedServerLimit();
  const maxRam = ns.getPurchasedServerMaxRam();

  React.useEffect(() => {
    const id = setInterval(() => {
      setMoney(ns.getServerMoneyAvailable("home"));
      setPurchased(ns.getPurchasedServers().length);
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
      ns.tprint("WARN not enough money to purchase this server.");
      return;
    }
    const hostname = ns.purchaseServer(prefix, selectedRam);
    if (hostname) {
      ns.tprint(`SUCCESS purchased ${hostname} (${ns.formatRam(selectedRam)})`);
    } else {
      ns.tprint("WARN purchase failed (insufficient funds or limit reached).");
    }
  };

  return (
    <FloatingPanel>
      <ResizablePanel title="Purchase Server" onClose={onExit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px"}}>
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
          <div style={styles.actions}>
            <Button onClick={onBuy} disabled={!canAfford || !canBuyMore}>
              Buy
            </Button>
          </div>
        </div>
      </ResizablePanel>
    </FloatingPanel>
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
  ns.tprint("Usage: run agent/buy-servers.js [--prefix name]");
  ns.tprint("Examples:");
  ns.tprint("  run agent/buy-servers.js");
  ns.tprint("  run agent/buy-servers.js --prefix pserv");
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  label: {
    opacity: 0.8,
  },
  value: {
    textAlign: "right",
  },
  select: {
    background: colors.selectBg,
    color: colors.text,
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: "4px",
    padding: "2px 6px",
    width: "100%",
  },
  actions: {
    display: "flex",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  text: {
    fontFamily: font.family,
    fontSize: font.size,
  },
};
