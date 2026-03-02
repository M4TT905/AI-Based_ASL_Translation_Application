import { StyleSheet, type TextProps } from "react-native";
import { Text, useTheme } from "react-native-paper";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  children,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const color = lightColor || darkColor || theme.colors.onSurface;

  // Map to Paper variants
  const getVariant = () => {
    switch (type) {
      case "title":
        return "headlineMedium";
      case "subtitle":
        return "titleMedium";
      case "defaultSemiBold":
        return "bodyMedium";
      case "link":
        return "bodyMedium";
      default:
        return "bodyMedium";
    }
  };

  return (
    <Text
      variant={getVariant()}
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link"
          ? [styles.link, { color: theme.colors.primary }]
          : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: "#0a7ea4",
  },
});
