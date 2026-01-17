import { React } from "/ui/react";
import { colors } from "/ui/theme";

type ModalProps = {
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal(props: ModalProps): JSX.Element {
  return (
    <div style={styles.overlay}>
      <div style={styles.backdrop} onClick={props.onClose} />
      <div style={styles.content}>{props.children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background: colors.backdrop,
  },
  content: {
    position: "relative",
    zIndex: 1,
  },
};
