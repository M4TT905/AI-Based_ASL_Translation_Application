import React from "react";
import { StyleSheet, View, Switch, Pressable } from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";

interface Props {
  isTranslating: boolean;
  isConnecting?: boolean;
  onToggle: () => void;
}

const HIT_SLOP = { top: 16, bottom: 16, left: 32, right: 32 };

export const TranslationToggleButton: React.FC<Props> = ({
  isTranslating,
  isConnecting = false,
  onToggle,
}) => {
  const theme = useTheme();

  return (
    <Pressable
      onPress={isConnecting ? undefined : onToggle}
      hitSlop={HIT_SLOP}
      accessibilityRole="switch"
      accessibilityLabel={isTranslating ? "Stop translation" : "Start translation"}
      accessibilityState={{ checked: isTranslating, busy: isConnecting }}
    >
      <View style={styles.container}>
        <Text
          variant="labelLarge"
          style={[styles.label, { color: theme.colors.onPrimaryContainer }]}
        >
          {isConnecting ? "Connecting..." : isTranslating ? "Stop" : "Translate"}
        </Text>

        {/* Fixed-size slot — both elements always in DOM, toggled by opacity */}
        <View style={styles.controlSlot}>
          <Switch
            trackColor={{ false: theme.colors.surfaceVariant, true: theme.colors.primary }}
            thumbColor={isTranslating ? theme.colors.onPrimary : theme.colors.outline}
            ios_backgroundColor={theme.colors.surfaceVariant}
            value={isTranslating}
            onValueChange={isConnecting ? undefined : onToggle}
            style={[styles.switch, { opacity: isConnecting ? 0 : 1 }]}
            pointerEvents="none"
          />
          <ActivityIndicator
            size="small"
            color={theme.colors.onPrimaryContainer}
            style={[styles.connectingIndicator, { opacity: isConnecting ? 1 : 0 }]}
          />
        </View>
      </View>
    </Pressable>
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
  controlSlot: {
    width: 51,
    height: 31,
    justifyContent: "center",
    alignItems: "center",
  },
  switch: {
    transform: [{ scaleX: 1.4 }, { scaleY: 1.4 }],
  },
  connectingIndicator: {
    position: "absolute",
  },
});
