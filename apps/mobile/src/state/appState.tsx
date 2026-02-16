import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";

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

type AppAction =
  | { type: "SELECT_LANDING"; id: string }
  | { type: "ACTIVATE_SELECTED" }
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
