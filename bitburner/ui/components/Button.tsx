import { React } from '/ui/react';
import { cn } from '/ui/lib/cn';
import { colors, font, spacing } from '/ui/theme';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  style?: React.CSSProperties;
};

export function Button(props: ButtonProps): JSX.Element {
  const {
    children,
    onClick,
    disabled = false,
    variant = 'default',
    size = 'md',
    className,
    style,
  } = props;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(className)}
      style={{ ...baseStyles, ...variantStyles[variant], ...sizeStyles[size], ...style }}
    >
      {children}
    </button>
  );
}

const baseStyles: React.CSSProperties = {
  color: colors.text,
  border: `1px solid ${colors.buttonBorder}`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: font.family,
  fontSize: font.size,
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: colors.buttonBg,
  },
  outline: {
    background: colors.buttonGhost,
  },
  ghost: {
    background: colors.buttonGhost,
    border: '1px solid transparent',
  },
  destructive: {
    background: colors.buttonDestructive,
    border: `1px solid ${colors.buttonDestructiveBorder}`,
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: `${spacing.xs} ${spacing.sm}`,
  },
  md: {
    padding: `${spacing.xs} ${spacing.md}`,
  },
};
