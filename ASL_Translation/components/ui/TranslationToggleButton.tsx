import React from "react";
import { StyleSheet, View, Switch } from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";

interface Props {
  isTranslating: boolean;
  isConnecting?: boolean;
  onToggle: () => void;
}

export const TranslationToggleButton: React.FC<Props> = ({
  isTranslating,
  isConnecting = false,
  onToggle,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text
        variant="labelLarge"
        style={[styles.label, { color: theme.colors.onPrimaryContainer }]}
      >
        {isConnecting ? "Connecting..." : isTranslating ? "Stop" : "Translate"}
      </Text>

      {isConnecting ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.onPrimaryContainer}
          style={styles.connectingIndicator}
        />
      ) : (
        <Switch
          trackColor={{ false: theme.colors.surfaceVariant, true: theme.colors.primary }}
          thumbColor={isTranslating ? theme.colors.onPrimary : theme.colors.outline}
          ios_backgroundColor={theme.colors.surfaceVariant}
          onValueChange={onToggle}
          value={isTranslating}
          style={styles.switch}
          accessibilityLabel={isTranslating ? "Stop translation" : "Start translation"}
          accessibilityRole="switch"
          accessibilityState={{ checked: isTranslating }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  label: {
    fontWeight: "600",
  },
  switch: {
    transform: [{ scaleX: 1.4 }, { scaleY: 1.4 }],
  },
  connectingIndicator: {
    width: 51,
    height: 31,
    justifyContent: "center",
  },
});
