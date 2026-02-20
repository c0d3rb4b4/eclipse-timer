import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

export type NotificationSettings = {
  eclipseAlerts: boolean;
  countdownAlerts: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  useTtsVoice: boolean;
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
  alarmLeadSecondsA1: number;
  alarmCountdownStartSecondsA2: number;
};

export type NotificationSettingToggleKey =
  | "eclipseAlerts"
  | "countdownAlerts"
  | "vibrationEnabled"
  | "soundEnabled"
  | "useTtsVoice"
  | "remindOneHourBefore"
  | "remindTenMinutesBefore";

export const MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN = 1;
export const MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX = 180;
export const MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN = 1;
export const MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX = 60;
export const ALARM_LEAD_SECONDS_A1_MIN = 2;
export const ALARM_LEAD_SECONDS_A1_MAX = 60;
export const ALARM_COUNTDOWN_START_SECONDS_A2_MIN = 1;
export const ALARM_COUNTDOWN_START_SECONDS_A2_MAX = 30;

export type NotificationMockTimeline = {
  enabled: boolean;
  firstContactOffsetMinutes: number;
  subsequentContactGapMinutes: number;
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

export type EclipseReminderAnchor = {
  id: string;
  eclipseId: string;
  eclipseDateYmd: string;
  eclipseLabel: string;
  firstEventIso: string;
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

export function eclipseReminderAnchorId(eclipseId: string) {
  return eclipseId.trim();
}

type AppState = {
  selectedLandingId: string | null;
  activeEclipseId: string | null;
  notificationSettings: NotificationSettings;
  notificationMockTimeline: NotificationMockTimeline;
  favoriteLocations: FavoriteLocation[];
  notificationEntries: NotificationEntry[];
  disabledEclipseAlarmIds: string[];
  eclipseReminderAnchors: EclipseReminderAnchor[];
};

type PersistedPreferences = Pick<
  AppState,
  | "notificationSettings"
  | "notificationMockTimeline"
  | "favoriteLocations"
  | "notificationEntries"
  | "disabledEclipseAlarmIds"
  | "eclipseReminderAnchors"
>;

type AppAction =
  | { type: "SELECT_LANDING"; id: string }
  | { type: "ACTIVATE_SELECTED" }
  | { type: "HYDRATE_PREFERENCES"; preferences: PersistedPreferences }
  | {
      type: "SET_NOTIFICATION_SETTING";
      key: NotificationSettingToggleKey;
      value: boolean;
    }
  | {
      type: "SET_ALARM_TIMING";
      alarmLeadSecondsA1: number;
      alarmCountdownStartSecondsA2: number;
    }
  | {
      type: "SET_ECLIPSE_ALARM_ENABLED";
      eclipseId: string;
      enabled: boolean;
    }
  | {
      type: "SET_NOTIFICATION_MOCK_TIMELINE_ENABLED";
      value: boolean;
    }
  | {
      type: "SET_NOTIFICATION_MOCK_TIMELINE_OFFSETS";
      firstContactOffsetMinutes: number;
      subsequentContactGapMinutes: number;
    }
  | { type: "ADD_FAVORITE_LOCATION"; location: FavoriteLocation }
  | { type: "REMOVE_FAVORITE_LOCATION"; id: string }
  | { type: "UPSERT_NOTIFICATION_ENTRY"; entry: NotificationEntry }
  | { type: "REMOVE_NOTIFICATION_ENTRY"; id: string }
  | { type: "UPSERT_ECLIPSE_REMINDER_ANCHOR"; anchor: EclipseReminderAnchor }
  | { type: "REMOVE_ECLIPSE_REMINDER_ANCHOR"; eclipseId: string };

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
    alarmLeadSecondsA1: 10,
    alarmCountdownStartSecondsA2: 5,
  },
  notificationMockTimeline: {
    enabled: false,
    firstContactOffsetMinutes: 5,
    subsequentContactGapMinutes: 1,
  },
  favoriteLocations: [],
  notificationEntries: [],
  disabledEclipseAlarmIds: [],
  eclipseReminderAnchors: [],
};

const APP_PREFERENCES_STORAGE_KEY = "eclipse_timer/preferences.v1";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampRounded(value: number, min: number, max: number) {
  return clamp(Math.round(value), min, max);
}

export function normalizeAlarmTiming(
  alarmLeadSecondsA1: number,
  alarmCountdownStartSecondsA2: number,
) {
  const nextA1 = clampRounded(
    alarmLeadSecondsA1,
    ALARM_LEAD_SECONDS_A1_MIN,
    ALARM_LEAD_SECONDS_A1_MAX,
  );
  let nextA2 = clampRounded(
    alarmCountdownStartSecondsA2,
    ALARM_COUNTDOWN_START_SECONDS_A2_MIN,
    ALARM_COUNTDOWN_START_SECONDS_A2_MAX,
  );

  if (nextA2 >= nextA1) {
    nextA2 = clamp(
      nextA1 - 1,
      ALARM_COUNTDOWN_START_SECONDS_A2_MIN,
      ALARM_COUNTDOWN_START_SECONDS_A2_MAX,
    );
  }

  return {
    alarmLeadSecondsA1: nextA1,
    alarmCountdownStartSecondsA2: nextA2,
  };
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
  const rawA1 =
    typeof raw.alarmLeadSecondsA1 === "number"
      ? raw.alarmLeadSecondsA1
      : initialState.notificationSettings.alarmLeadSecondsA1;
  const rawA2 =
    typeof raw.alarmCountdownStartSecondsA2 === "number"
      ? raw.alarmCountdownStartSecondsA2
      : initialState.notificationSettings.alarmCountdownStartSecondsA2;
  const { alarmLeadSecondsA1, alarmCountdownStartSecondsA2 } = normalizeAlarmTiming(rawA1, rawA2);

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
    alarmLeadSecondsA1,
    alarmCountdownStartSecondsA2,
  };
}

function parseNotificationMockTimeline(raw: unknown): NotificationMockTimeline {
  if (!isRecord(raw)) return initialState.notificationMockTimeline;

  const firstContactOffsetMinutesRaw =
    typeof raw.firstContactOffsetMinutes === "number"
      ? raw.firstContactOffsetMinutes
      : initialState.notificationMockTimeline.firstContactOffsetMinutes;
  const subsequentContactGapMinutesRaw =
    typeof raw.subsequentContactGapMinutes === "number"
      ? raw.subsequentContactGapMinutes
      : initialState.notificationMockTimeline.subsequentContactGapMinutes;

  return {
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : initialState.notificationMockTimeline.enabled,
    firstContactOffsetMinutes: clampRounded(
      firstContactOffsetMinutesRaw,
      MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN,
      MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX,
    ),
    subsequentContactGapMinutes: clampRounded(
      subsequentContactGapMinutesRaw,
      MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN,
      MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX,
    ),
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
  const id =
    typeof raw.id === "string" ? raw.id.trim() : notificationEntryId(eclipseId, contactKey);
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

function parseDisabledEclipseAlarmIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const nextIds: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    if (nextIds.includes(normalized)) continue;
    nextIds.push(normalized);
  }
  return nextIds;
}

function parseEclipseReminderAnchor(raw: unknown): EclipseReminderAnchor | null {
  if (!isRecord(raw)) return null;

  const eclipseId = typeof raw.eclipseId === "string" ? raw.eclipseId.trim() : "";
  const eclipseDateYmd = typeof raw.eclipseDateYmd === "string" ? raw.eclipseDateYmd.trim() : "";
  const eclipseLabel = typeof raw.eclipseLabel === "string" ? raw.eclipseLabel.trim() : eclipseId;
  const firstEventIso = typeof raw.firstEventIso === "string" ? raw.firstEventIso.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : eclipseReminderAnchorId(eclipseId);

  if (!id || !eclipseId || !eclipseDateYmd || !firstEventIso) return null;
  const timestamp = Date.parse(firstEventIso);
  if (!Number.isFinite(timestamp)) return null;

  return {
    id,
    eclipseId,
    eclipseDateYmd,
    eclipseLabel: eclipseLabel || eclipseId,
    firstEventIso,
  };
}

function parseEclipseReminderAnchors(raw: unknown): EclipseReminderAnchor[] {
  if (!Array.isArray(raw)) return [];

  const nextAnchors: EclipseReminderAnchor[] = [];
  for (const item of raw) {
    const parsed = parseEclipseReminderAnchor(item);
    if (!parsed) continue;
    if (nextAnchors.some((entry) => entry.id === parsed.id)) continue;
    nextAnchors.push(parsed);
  }
  return nextAnchors;
}

function parsePersistedPreferences(raw: string): PersistedPreferences | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      notificationSettings: parseNotificationSettings(parsed.notificationSettings),
      notificationMockTimeline: parseNotificationMockTimeline(parsed.notificationMockTimeline),
      favoriteLocations: parseFavoriteLocations(parsed.favoriteLocations),
      notificationEntries: parseNotificationEntries(parsed.notificationEntries),
      disabledEclipseAlarmIds: parseDisabledEclipseAlarmIds(parsed.disabledEclipseAlarmIds),
      eclipseReminderAnchors: parseEclipseReminderAnchors(parsed.eclipseReminderAnchors),
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
        notificationMockTimeline: action.preferences.notificationMockTimeline,
        favoriteLocations: action.preferences.favoriteLocations,
        notificationEntries: action.preferences.notificationEntries,
        disabledEclipseAlarmIds: action.preferences.disabledEclipseAlarmIds,
        eclipseReminderAnchors: action.preferences.eclipseReminderAnchors,
      };
    case "SET_NOTIFICATION_SETTING": {
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
    case "SET_ALARM_TIMING": {
      const normalized = normalizeAlarmTiming(
        action.alarmLeadSecondsA1,
        action.alarmCountdownStartSecondsA2,
      );

      if (
        normalized.alarmLeadSecondsA1 === state.notificationSettings.alarmLeadSecondsA1 &&
        normalized.alarmCountdownStartSecondsA2 ===
          state.notificationSettings.alarmCountdownStartSecondsA2
      ) {
        return state;
      }

      return {
        ...state,
        notificationSettings: {
          ...state.notificationSettings,
          alarmLeadSecondsA1: normalized.alarmLeadSecondsA1,
          alarmCountdownStartSecondsA2: normalized.alarmCountdownStartSecondsA2,
        },
      };
    }
    case "SET_ECLIPSE_ALARM_ENABLED": {
      const eclipseId = action.eclipseId.trim();
      if (!eclipseId) return state;
      if (action.enabled) {
        if (!state.disabledEclipseAlarmIds.includes(eclipseId)) return state;
        return {
          ...state,
          disabledEclipseAlarmIds: state.disabledEclipseAlarmIds.filter((id) => id !== eclipseId),
        };
      }
      if (state.disabledEclipseAlarmIds.includes(eclipseId)) return state;
      return {
        ...state,
        disabledEclipseAlarmIds: [...state.disabledEclipseAlarmIds, eclipseId],
      };
    }
    case "SET_NOTIFICATION_MOCK_TIMELINE_ENABLED":
      return {
        ...state,
        notificationMockTimeline: {
          ...state.notificationMockTimeline,
          enabled: action.value,
        },
      };
    case "SET_NOTIFICATION_MOCK_TIMELINE_OFFSETS":
      return {
        ...state,
        notificationMockTimeline: {
          ...state.notificationMockTimeline,
          firstContactOffsetMinutes: clampRounded(
            action.firstContactOffsetMinutes,
            MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN,
            MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX,
          ),
          subsequentContactGapMinutes: clampRounded(
            action.subsequentContactGapMinutes,
            MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN,
            MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX,
          ),
        },
      };
    case "ADD_FAVORITE_LOCATION":
      if (state.favoriteLocations.some((location) => location.id === action.location.id))
        return state;
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
      const existingIndex = state.notificationEntries.findIndex(
        (entry) => entry.id === action.entry.id,
      );
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
    case "UPSERT_ECLIPSE_REMINDER_ANCHOR": {
      const existingIndex = state.eclipseReminderAnchors.findIndex(
        (anchor) => anchor.id === action.anchor.id,
      );
      if (existingIndex < 0) {
        return {
          ...state,
          eclipseReminderAnchors: [...state.eclipseReminderAnchors, action.anchor],
        };
      }

      const existing = state.eclipseReminderAnchors[existingIndex];
      if (!existing) return state;
      if (
        existing.eclipseId === action.anchor.eclipseId &&
        existing.eclipseDateYmd === action.anchor.eclipseDateYmd &&
        existing.eclipseLabel === action.anchor.eclipseLabel &&
        existing.firstEventIso === action.anchor.firstEventIso
      ) {
        return state;
      }

      const nextAnchors = [...state.eclipseReminderAnchors];
      nextAnchors[existingIndex] = action.anchor;
      return {
        ...state,
        eclipseReminderAnchors: nextAnchors,
      };
    }
    case "REMOVE_ECLIPSE_REMINDER_ANCHOR": {
      const eclipseId = action.eclipseId.trim();
      if (!eclipseId) return state;
      return {
        ...state,
        eclipseReminderAnchors: state.eclipseReminderAnchors.filter(
          (anchor) => anchor.eclipseId !== eclipseId,
        ),
      };
    }
    default:
      return state;
  }
}

type AppStateContextValue = {
  state: AppState;
  actions: {
    selectLanding: (id: string) => void;
    activateSelected: () => void;
    setNotificationSetting: (key: NotificationSettingToggleKey, value: boolean) => void;
    setAlarmTiming: (alarmLeadSecondsA1: number, alarmCountdownStartSecondsA2: number) => void;
    setEclipseAlarmEnabled: (eclipseId: string, enabled: boolean) => void;
    setNotificationMockTimelineEnabled: (enabled: boolean) => void;
    setNotificationMockTimelineOffsets: (
      firstContactOffsetMinutes: number,
      subsequentContactGapMinutes: number,
    ) => void;
    addFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => void;
    removeFavoriteLocation: (id: string) => void;
    upsertNotificationEntry: (entry: NotificationEntry) => void;
    removeNotificationEntry: (id: string) => void;
    upsertEclipseReminderAnchor: (anchor: EclipseReminderAnchor) => void;
    removeEclipseReminderAnchor: (eclipseId: string) => void;
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
      notificationMockTimeline: state.notificationMockTimeline,
      favoriteLocations: state.favoriteLocations,
      notificationEntries: state.notificationEntries,
      disabledEclipseAlarmIds: state.disabledEclipseAlarmIds,
      eclipseReminderAnchors: state.eclipseReminderAnchors,
    };

    void AsyncStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(payload)).catch(
      (err: unknown) => {
        console.warn("Failed to save app preferences:", err);
      },
    );
  }, [
    hasHydratedPreferences,
    state.disabledEclipseAlarmIds,
    state.eclipseReminderAnchors,
    state.favoriteLocations,
    state.notificationEntries,
    state.notificationMockTimeline,
    state.notificationSettings,
  ]);

  const actions = useMemo(
    () => ({
      selectLanding: (id: string) => dispatch({ type: "SELECT_LANDING", id }),
      activateSelected: () => dispatch({ type: "ACTIVATE_SELECTED" }),
      setNotificationSetting: (key: NotificationSettingToggleKey, value: boolean) =>
        dispatch({
          type: "SET_NOTIFICATION_SETTING",
          key,
          value,
        }),
      setAlarmTiming: (alarmLeadSecondsA1: number, alarmCountdownStartSecondsA2: number) =>
        dispatch({
          type: "SET_ALARM_TIMING",
          alarmLeadSecondsA1,
          alarmCountdownStartSecondsA2,
        }),
      setEclipseAlarmEnabled: (eclipseId: string, enabled: boolean) =>
        dispatch({
          type: "SET_ECLIPSE_ALARM_ENABLED",
          eclipseId,
          enabled,
        }),
      setNotificationMockTimelineEnabled: (enabled: boolean) =>
        dispatch({
          type: "SET_NOTIFICATION_MOCK_TIMELINE_ENABLED",
          value: enabled,
        }),
      setNotificationMockTimelineOffsets: (
        firstContactOffsetMinutes: number,
        subsequentContactGapMinutes: number,
      ) =>
        dispatch({
          type: "SET_NOTIFICATION_MOCK_TIMELINE_OFFSETS",
          firstContactOffsetMinutes,
          subsequentContactGapMinutes,
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
      upsertEclipseReminderAnchor: (anchor: EclipseReminderAnchor) =>
        dispatch({
          type: "UPSERT_ECLIPSE_REMINDER_ANCHOR",
          anchor: {
            ...anchor,
            id: anchor.id.trim() || eclipseReminderAnchorId(anchor.eclipseId),
            eclipseId: anchor.eclipseId.trim(),
            eclipseDateYmd: anchor.eclipseDateYmd.trim(),
            eclipseLabel: anchor.eclipseLabel.trim() || anchor.eclipseId.trim(),
            firstEventIso: anchor.firstEventIso.trim(),
          },
        }),
      removeEclipseReminderAnchor: (eclipseId: string) =>
        dispatch({ type: "REMOVE_ECLIPSE_REMINDER_ANCHOR", eclipseId: eclipseId.trim() }),
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
