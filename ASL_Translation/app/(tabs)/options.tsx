import { StyleSheet, ScrollView, Alert } from "react-native";
import { useState } from "react";
import {
  Text,
  Surface,
  Card,
  Button,
  List,
  Switch,
  useTheme,
  Divider,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, elevation } from "@/constants/paperTheme";

export default function OptionsScreen() {
  const [cameraQuality, setCameraQuality] = useState("High");
  const [translationMode, setTranslationMode] = useState("Real-time");
  const [notifications, setNotifications] = useState(true);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const handleCameraQualityChange = () => {
    const qualities = ["High", "Medium", "Low"];
    const currentIndex = qualities.indexOf(cameraQuality);
    const nextIndex = (currentIndex + 1) % qualities.length;
    setCameraQuality(qualities[nextIndex]);
  };

  const handleTranslationModeChange = () => {
    const modes = ["Real-time", "On-demand", "Batch"];
    const currentIndex = modes.indexOf(translationMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setTranslationMode(modes[nextIndex]);
  };

  const handleNotificationsToggle = () => {
    setNotifications(!notifications);
  };

  const handleAbout = () => {
    Alert.alert(
      "About ASL Translation",
      "AI-Based ASL Translation Application\nVersion 1.0.0\n\nThis app uses advanced AI to translate American Sign Language gestures in real-time.",
      [{ text: "OK" }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      "Help & Support",
      "For help and support:\n\n• Point camera at ASL gestures\n• Ensure good lighting\n• Keep hands visible in frame\n• Check camera permissions\n\nContact: support@asltranslation.com",
      [{ text: "OK" }]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all settings to default?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setCameraQuality("High");
            setTranslationMode("Real-time");
            setNotifications(true);
            Alert.alert(
              "Settings Reset",
              "All settings have been reset to default values."
            );
          },
        },
      ]
    );
  };

  return (
    <Surface
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.colors.background },
      ]}
    >
      {/* Header */}
      <Surface
        style={[styles.header, { backgroundColor: theme.colors.surface }]}
        elevation={elevation.level1}
      >
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          Options
        </Text>
      </Surface>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
      >
        {/* Camera Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Camera Settings
            </Text>

            <List.Item
              title="Camera Quality"
              description={`Current: ${cameraQuality}`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleCameraQualityChange}
                  style={{ borderRadius: borderRadius.md }}
                >
                  {cameraQuality}
                </Button>
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Translation Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Translation Settings
            </Text>

            <List.Item
              title="Translation Mode"
              description={`Current: ${translationMode}`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleTranslationModeChange}
                  style={{ borderRadius: borderRadius.md }}
                >
                  {translationMode}
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Notifications"
              description="Receive translation alerts"
              right={() => (
                <Switch
                  value={notifications}
                  onValueChange={handleNotificationsToggle}
                  thumbColor={
                    notifications ? theme.colors.primary : theme.colors.outline
                  }
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                />
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Support & Information */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Support & Information
            </Text>

            <List.Item
              title="Help & Support"
              description="Get help with using the app"
              left={(props: any) => (
                <List.Icon
                  {...props}
                  icon="help-circle"
                  color={theme.colors.primary}
                />
              )}
              onPress={handleHelp}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="About"
              description="App information and version"
              left={(props: any) => (
                <List.Icon
                  {...props}
                  icon="information"
                  color={theme.colors.primary}
                />
              )}
              onPress={handleAbout}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Reset Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Reset
            </Text>

            <Button
              mode="outlined"
              onPress={handleResetSettings}
              icon="restore"
              style={[
                styles.resetButton,
                {
                  borderColor: theme.colors.error,
                  borderRadius: borderRadius.lg,
                },
              ]}
              textColor={theme.colors.error}
            >
              Reset All Settings
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  title: {
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  section: {
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  listItem: {
    paddingVertical: 4,
  },
  resetButton: {
    marginTop: 8,
  },
});
