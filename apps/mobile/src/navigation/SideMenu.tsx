import { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LOGO } from "../assets/branding";
import { useAppTheme } from "../theme/useAppTheme";

export type MenuRouteName = "Landing" | "Timer" | "Settings";

type SideMenuProps = {
  visible: boolean;
  activeRoute: MenuRouteName | null;
  onClose: () => void;
  onNavigate: (route: MenuRouteName) => void;
};

const MENU_WIDTH = 280;

type MenuItemProps = {
  label: string;
  route: MenuRouteName;
  activeRoute: MenuRouteName | null;
  onNavigate: (route: MenuRouteName) => void;
};

function MenuItem({ label, route, activeRoute, onNavigate }: MenuItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isActive = activeRoute === route;
  return (
    <Pressable
      style={[styles.menuItem, isActive ? styles.menuItemActive : null]}
      onPress={() => onNavigate(route)}
    >
      <Text style={[styles.menuItemText, isActive ? styles.menuItemTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SideMenu({ visible, activeRoute, onClose, onNavigate }: SideMenuProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -MENU_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateX, visible]);

  const backdropOpacity = translateX.interpolate({
    inputRange: [-MENU_WIDTH, 0],
    outputRange: [0, 1],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.menuPanel, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.menuSafe} edges={["top", "left", "bottom"]}>
          <View style={styles.menuHeader}>
            <View style={styles.menuBrandRow}>
              <Image source={APP_LOGO} style={styles.menuLogo} resizeMode="contain" />
              <Text style={styles.menuTitle}>Eclipse Timer</Text>
            </View>
            <Text style={styles.menuSubtitle}>Navigate and manage settings</Text>
          </View>

          <MenuItem
            label="Eclipse List"
            route="Landing"
            activeRoute={activeRoute}
            onNavigate={onNavigate}
          />
          <MenuItem label="Timer" route="Timer" activeRoute={activeRoute} onNavigate={onNavigate} />

          <MenuItem
            label="Settings"
            route="Settings"
            activeRoute={activeRoute}
            onNavigate={onNavigate}
          />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    menuPanel: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: MENU_WIDTH,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    menuSafe: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    menuHeader: {
      marginBottom: 10,
      paddingVertical: 6,
      gap: 4,
    },
    menuBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    menuLogo: {
      width: 22,
      height: 22,
    },
    menuTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
    },
    menuSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    menuItem: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    menuItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    menuItemText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    menuItemTextActive: {
      color: colors.textPrimary,
    },
  });
}
