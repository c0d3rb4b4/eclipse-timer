import { Pressable, StyleSheet, View } from "react-native";

type BurgerButtonProps = {
  onPress: () => void;
};

export default function BurgerButton({ onPress }: BurgerButtonProps) {
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

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  line: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: "white",
  },
});
