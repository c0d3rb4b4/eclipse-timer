import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

export type NotificationSettings = {
  eclipseAlerts: boolean;
  countdownAlerts: boolean;
  vibrationEnabled: boolean;
};

export type FavoriteLocation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

type AppState = {
  selectedLandingId: string | null;
  activeEclipseId: string | null;
  notificationSettings: NotificationSettings;
  favoriteLocations: FavoriteLocation[];
};

type PersistedPreferences = Pick<AppState, "notificationSettings" | "favoriteLocations">;

type AppAction =
  | { type: "SELECT_LANDING"; id: string }
  | { type: "ACTIVATE_SELECTED" }
  | { type: "HYDRATE_PREFERENCES"; preferences: PersistedPreferences }
  | {
      type: "SET_NOTIFICATION_SETTING";
      key: keyof NotificationSettings;
      value: boolean;
    }
  | { type: "ADD_FAVORITE_LOCATION"; location: FavoriteLocation }
  | { type: "REMOVE_FAVORITE_LOCATION"; id: string };

const initialState: AppState = {
  selectedLandingId: null,
  activeEclipseId: null,
  notificationSettings: {
    eclipseAlerts: true,
    countdownAlerts: true,
    vibrationEnabled: true,
  },
  favoriteLocations: [],
};

const APP_PREFERENCES_STORAGE_KEY = "eclipse_timer/preferences.v1";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createFavoriteLocationId(name: string, lat: number, lon: number) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timeSuffix = Date.now().toString(36);
  return `${slug || "location"}-${Math.round(lat * 1000)}-${Math.round(lon * 1000)}-${timeSuffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNotificationSettings(raw: unknown): NotificationSettings {
  if (!isRecord(raw)) return initialState.notificationSettings;

  return {
    eclipseAlerts:
      typeof raw.eclipseAlerts === "boolean"
        ? raw.eclipseAlerts
        : initialState.notificationSettings.eclipseAlerts,
    countdownAlerts:
      typeof raw.countdownAlerts === "boolean"
        ? raw.countdownAlerts
        : initialState.notificationSettings.countdownAlerts,
    vibrationEnabled:
      typeof raw.vibrationEnabled === "boolean"
        ? raw.vibrationEnabled
        : initialState.notificationSettings.vibrationEnabled,
  };
}

function parseFavoriteLocation(raw: unknown): FavoriteLocation | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const lat =
    typeof raw.lat === "number" && Number.isFinite(raw.lat) ? clamp(raw.lat, -90, 90) : null;
  const lon =
    typeof raw.lon === "number" && Number.isFinite(raw.lon) ? clamp(raw.lon, -180, 180) : null;

  if (!id || !name || lat === null || lon === null) return null;

  return {
    id,
    name,
    lat,
    lon,
  };
}

function parseFavoriteLocations(raw: unknown): FavoriteLocation[] {
  if (!Array.isArray(raw)) return [];

  const nextLocations: FavoriteLocation[] = [];
  for (const item of raw) {
    const parsed = parseFavoriteLocation(item);
    if (!parsed) continue;
    if (nextLocations.some((location) => location.id === parsed.id)) continue;
    nextLocations.push(parsed);
  }
  return nextLocations;
}

function parsePersistedPreferences(raw: string): PersistedPreferences | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      notificationSettings: parseNotificationSettings(parsed.notificationSettings),
      favoriteLocations: parseFavoriteLocations(parsed.favoriteLocations),
    };
  } catch {
    return null;
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SELECT_LANDING":
      return { ...state, selectedLandingId: action.id };
    case "ACTIVATE_SELECTED":
      if (!state.selectedLandingId) return state;
      return {
        ...state,
        activeEclipseId: state.selectedLandingId,
      };
    case "HYDRATE_PREFERENCES":
      return {
        ...state,
        notificationSettings: action.preferences.notificationSettings,
        favoriteLocations: action.preferences.favoriteLocations,
      };
    case "SET_NOTIFICATION_SETTING":
      return {
        ...state,
        notificationSettings: {
          ...state.notificationSettings,
          [action.key]: action.value,
        },
      };
    case "ADD_FAVORITE_LOCATION":
      if (state.favoriteLocations.some((location) => location.id === action.location.id)) return state;
      return {
        ...state,
        favoriteLocations: [...state.favoriteLocations, action.location],
      };
    case "REMOVE_FAVORITE_LOCATION":
      return {
        ...state,
        favoriteLocations: state.favoriteLocations.filter((location) => location.id !== action.id),
      };
    default:
      return state;
  }
}

type AppStateContextValue = {
  state: AppState;
  actions: {
    selectLanding: (id: string) => void;
    activateSelected: () => void;
    setNotificationSetting: (key: keyof NotificationSettings, value: boolean) => void;
    addFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => void;
    removeFavoriteLocation: (id: string) => void;
  };
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [hasHydratedPreferences, setHasHydratedPreferences] = useState(false);

  useEffect(() => {
    let didCancel = false;

    const hydrate = async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
        if (didCancel || !raw) return;
        const parsed = parsePersistedPreferences(raw);
        if (!parsed) return;
        dispatch({ type: "HYDRATE_PREFERENCES", preferences: parsed });
      } catch (err: unknown) {
        console.warn("Failed to load app preferences:", err);
      } finally {
        if (!didCancel) setHasHydratedPreferences(true);
      }
    };

    void hydrate();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedPreferences) return;

    const payload: PersistedPreferences = {
      notificationSettings: state.notificationSettings,
      favoriteLocations: state.favoriteLocations,
    };

    void AsyncStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(payload)).catch(
      (err: unknown) => {
        console.warn("Failed to save app preferences:", err);
      },
    );
  }, [hasHydratedPreferences, state.favoriteLocations, state.notificationSettings]);

  const actions = useMemo(
    () => ({
      selectLanding: (id: string) => dispatch({ type: "SELECT_LANDING", id }),
      activateSelected: () => dispatch({ type: "ACTIVATE_SELECTED" }),
      setNotificationSetting: (key: keyof NotificationSettings, value: boolean) =>
        dispatch({
          type: "SET_NOTIFICATION_SETTING",
          key,
          value,
        }),
      addFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => {
        const trimmedName = location.name.trim();
        const name = trimmedName || "Favorite location";
        const lat = clamp(location.lat, -90, 90);
        const lon = clamp(location.lon, -180, 180);
        dispatch({
          type: "ADD_FAVORITE_LOCATION",
          location: {
            id: createFavoriteLocationId(name, lat, lon),
            name,
            lat,
            lon,
          },
        });
      },
      removeFavoriteLocation: (id: string) => dispatch({ type: "REMOVE_FAVORITE_LOCATION", id }),
    }),
    [],
  );

  return <AppStateContext.Provider value={{ state, actions }}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
