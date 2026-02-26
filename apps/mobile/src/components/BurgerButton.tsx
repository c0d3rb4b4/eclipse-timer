import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

type BurgerButtonProps = {
  onPress: () => void;
};

export default function BurgerButton({ onPress }: BurgerButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    line: {
      width: 18,
      height: 2,
      borderRadius: 2,
      backgroundColor: colors.textPrimary,
    },
  });
}
