import { React } from "/ui/react";

type FloatingPanelProps = {
  children: React.ReactNode;
};

export function FloatingPanel(props: FloatingPanelProps): JSX.Element {
  return <div style={styles.container}>{props.children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9999,
  },
};
