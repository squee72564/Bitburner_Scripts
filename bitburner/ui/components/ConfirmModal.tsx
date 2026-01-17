import { React } from '/ui/react';
import { Modal } from '/ui/components/Modal';
import { Button } from '/ui/components/Button';
import { colors, font, spacing } from '/ui/theme';

type ConfirmModalProps = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'destructive';
};

export function ConfirmModal(props: ConfirmModalProps): JSX.Element {
  const {
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'default',
  } = props;

  return (
    <Modal onClose={onCancel}>
      <div style={styles.container}>
        <div style={styles.title}>{title}</div>
        <div style={styles.message}>{message}</div>
        <div style={styles.actions}>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minWidth: '260px',
    padding: spacing.lg,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: '6px',
    background: colors.panelBg,
    color: colors.text,
    fontFamily: font.family,
    fontSize: font.size,
    boxShadow: colors.panelShadow,
  },
  title: {
    fontSize: font.titleSize,
    fontWeight: 600,
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.md,
    color: colors.textDim,
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
};
