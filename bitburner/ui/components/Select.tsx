import { React } from "/ui/react";
import { cn } from "/ui/lib/cn";
import { colors, font, spacing } from "/ui/theme";

type SelectOption = {
  value: string | number;
  label: string;
};

type SelectProps = {
  value: string | number;
  onChange?: (value: string) => void;
  options: SelectOption[];
  className?: string;
  style?: React.CSSProperties;
};

export function Select(props: SelectProps): JSX.Element {
  const { value, onChange, options, className, style } = props;
  return (
    <select
      value={String(value)}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(className)}
      style={{ ...baseStyles, ...style }}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
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
