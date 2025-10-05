import { type ViewProps } from "react-native";
import { Surface, useTheme } from "react-native-paper";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  children?: React.ReactNode;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  elevation = 0,
  children,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const backgroundColor = lightColor || darkColor || theme.colors.surface;

  return (
    <Surface
      style={[{ backgroundColor }, style]}
      elevation={elevation}
      {...otherProps}
    >
      {children}
    </Surface>
  );
}
