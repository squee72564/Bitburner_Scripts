import { React } from "/ui/react";
import { cn } from "/ui/lib/cn";
import { colors, font, spacing } from "/ui/theme";

type InputProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: "text" | "number" | "password";
};

export function Input(props: InputProps): JSX.Element {
  const { value, onChange, placeholder, disabled, className, style, type = "text" } = props;
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
      style={{ ...baseStyles, ...style }}
    />
  );
}

const baseStyles: React.CSSProperties = {
  background: colors.selectBg,
  color: colors.text,
  border: `1px solid ${colors.accentBorder}`,
  borderRadius: "4px",
  padding: `${spacing.xs} ${spacing.sm}`,
  fontFamily: font.family,
  fontSize: font.size,
  width: "100%",
};
