import { colors, radius } from "@/theme";
import { Component, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. A thrown error during render used to leave a blank
 * (black) screen or crash the process in release builds; this catches it and
 * shows a recoverable screen with a "Try again" reset instead. Keep it at the
 * very root (above navigation) so no screen can take the whole app down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaces in `adb logcat` / crash reporting without killing the app.
    console.error("[ErrorBoundary]", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. You can try again - if it keeps happening, please let
            us know.
          </Text>
          {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 14 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted },
  detail: {
    fontSize: 13,
    color: colors.danger,
    fontFamily: "monospace",
    backgroundColor: colors.surface2,
    padding: 12,
    borderRadius: radius.md,
  },
  button: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  buttonText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
