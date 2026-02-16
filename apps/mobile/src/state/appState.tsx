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
  soundEnabled: boolean;
  useTtsVoice: boolean;
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
};

export type NotificationEntry = {
  id: string;
  eclipseId: string;
  eclipseDateYmd: string;
  eclipseLabel: string;
  contactKey: string;
  contactLabel: string;
  iso: string;
};

export type FavoriteLocation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export function notificationEntryId(eclipseId: string, contactKey: string) {
  return `${eclipseId.trim()}:${contactKey.trim().toLowerCase()}`;
}

type AppState = {
  selectedLandingId: string | null;
  activeEclipseId: string | null;
  notificationSettings: NotificationSettings;
  favoriteLocations: FavoriteLocation[];
  notificationEntries: NotificationEntry[];
};

type PersistedPreferences = Pick<
  AppState,
  "notificationSettings" | "favoriteLocations" | "notificationEntries"
>;

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
  | { type: "REMOVE_FAVORITE_LOCATION"; id: string }
  | { type: "UPSERT_NOTIFICATION_ENTRY"; entry: NotificationEntry }
  | { type: "REMOVE_NOTIFICATION_ENTRY"; id: string };

const initialState: AppState = {
  selectedLandingId: null,
  activeEclipseId: null,
  notificationSettings: {
    eclipseAlerts: true,
    countdownAlerts: true,
    vibrationEnabled: true,
    soundEnabled: true,
    useTtsVoice: false,
    remindOneHourBefore: true,
    remindTenMinutesBefore: true,
  },
  favoriteLocations: [],
  notificationEntries: [],
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

  const soundEnabled =
    typeof raw.soundEnabled === "boolean"
      ? raw.soundEnabled
      : initialState.notificationSettings.soundEnabled;
  const useTtsVoice =
    typeof raw.useTtsVoice === "boolean"
      ? raw.useTtsVoice
      : initialState.notificationSettings.useTtsVoice;

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
    soundEnabled: useTtsVoice ? false : soundEnabled,
    useTtsVoice,
    remindOneHourBefore:
      typeof raw.remindOneHourBefore === "boolean"
        ? raw.remindOneHourBefore
        : initialState.notificationSettings.remindOneHourBefore,
    remindTenMinutesBefore:
      typeof raw.remindTenMinutesBefore === "boolean"
        ? raw.remindTenMinutesBefore
        : initialState.notificationSettings.remindTenMinutesBefore,
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

function parseNotificationEntry(raw: unknown): NotificationEntry | null {
  if (!isRecord(raw)) return null;

  const eclipseId = typeof raw.eclipseId === "string" ? raw.eclipseId.trim() : "";
  const contactKey = typeof raw.contactKey === "string" ? raw.contactKey.trim().toLowerCase() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : notificationEntryId(eclipseId, contactKey);
  const eclipseDateYmd = typeof raw.eclipseDateYmd === "string" ? raw.eclipseDateYmd.trim() : "";
  const eclipseLabel = typeof raw.eclipseLabel === "string" ? raw.eclipseLabel.trim() : eclipseId;
  const contactLabel = typeof raw.contactLabel === "string" ? raw.contactLabel.trim() : "";
  const iso = typeof raw.iso === "string" ? raw.iso.trim() : "";

  if (!id || !eclipseId || !contactKey || !eclipseDateYmd || !contactLabel || !iso) return null;

  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;

  return {
    id,
    eclipseId,
    eclipseDateYmd,
    eclipseLabel: eclipseLabel || eclipseId,
    contactKey,
    contactLabel,
    iso,
  };
}

function parseNotificationEntries(raw: unknown): NotificationEntry[] {
  if (!Array.isArray(raw)) return [];

  const nextEntries: NotificationEntry[] = [];
  for (const item of raw) {
    const parsed = parseNotificationEntry(item);
    if (!parsed) continue;
    if (nextEntries.some((entry) => entry.id === parsed.id)) continue;
    nextEntries.push(parsed);
  }
  return nextEntries;
}

function parsePersistedPreferences(raw: string): PersistedPreferences | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      notificationSettings: parseNotificationSettings(parsed.notificationSettings),
      favoriteLocations: parseFavoriteLocations(parsed.favoriteLocations),
      notificationEntries: parseNotificationEntries(parsed.notificationEntries),
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
        notificationEntries: action.preferences.notificationEntries,
      };
    case "SET_NOTIFICATION_SETTING":
      {
        const nextSettings: NotificationSettings = {
          ...state.notificationSettings,
          [action.key]: action.value,
        };

        if (action.key === "useTtsVoice" && action.value) {
          nextSettings.soundEnabled = false;
        }
        if (action.key === "soundEnabled" && action.value) {
          nextSettings.useTtsVoice = false;
        }

        return {
          ...state,
          notificationSettings: nextSettings,
        };
      }
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
    case "UPSERT_NOTIFICATION_ENTRY": {
      const existingIndex = state.notificationEntries.findIndex((entry) => entry.id === action.entry.id);
      if (existingIndex < 0) {
        return {
          ...state,
          notificationEntries: [...state.notificationEntries, action.entry],
        };
      }

      const existing = state.notificationEntries[existingIndex];
      if (!existing) return state;
      if (
        existing.eclipseId === action.entry.eclipseId &&
        existing.eclipseDateYmd === action.entry.eclipseDateYmd &&
        existing.eclipseLabel === action.entry.eclipseLabel &&
        existing.contactKey === action.entry.contactKey &&
        existing.contactLabel === action.entry.contactLabel &&
        existing.iso === action.entry.iso
      ) {
        return state;
      }

      const nextEntries = [...state.notificationEntries];
      nextEntries[existingIndex] = action.entry;
      return {
        ...state,
        notificationEntries: nextEntries,
      };
    }
    case "REMOVE_NOTIFICATION_ENTRY":
      return {
        ...state,
        notificationEntries: state.notificationEntries.filter((entry) => entry.id !== action.id),
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
    upsertNotificationEntry: (entry: NotificationEntry) => void;
    removeNotificationEntry: (id: string) => void;
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
      notificationEntries: state.notificationEntries,
    };

    void AsyncStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(payload)).catch(
      (err: unknown) => {
        console.warn("Failed to save app preferences:", err);
      },
    );
  }, [hasHydratedPreferences, state.favoriteLocations, state.notificationEntries, state.notificationSettings]);

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
      upsertNotificationEntry: (entry: NotificationEntry) =>
        dispatch({
          type: "UPSERT_NOTIFICATION_ENTRY",
          entry: {
            ...entry,
            id: entry.id.trim() || notificationEntryId(entry.eclipseId, entry.contactKey),
            eclipseId: entry.eclipseId.trim(),
            eclipseDateYmd: entry.eclipseDateYmd.trim(),
            eclipseLabel: entry.eclipseLabel.trim() || entry.eclipseId.trim(),
            contactKey: entry.contactKey.trim().toLowerCase(),
            contactLabel: entry.contactLabel.trim(),
            iso: entry.iso.trim(),
          },
        }),
      removeNotificationEntry: (id: string) =>
        dispatch({ type: "REMOVE_NOTIFICATION_ENTRY", id: id.trim() }),
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
