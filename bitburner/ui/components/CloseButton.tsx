import { React } from "/ui/react";
import { colors, spacing } from "/ui/theme";

type CloseButtonProps = {
  onClick: () => void;
};

export function CloseButton(props: CloseButtonProps): JSX.Element {
  return (
    <button style={styles.button} onClick={props.onClick}>
      ×
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    background: "transparent",
    color: colors.text,
    border: `1px solid ${colors.accentBorder}`,
    borderRadius: "4px",
    width: "22px",
    height: "22px",
    lineHeight: "18px",
    cursor: "pointer",
    padding: spacing.xs,
  },
};
