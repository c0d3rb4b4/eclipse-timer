import React, { createContext, useContext, useMemo, useReducer } from "react";

type AppScreen = "landing" | "timer";

type AppState = {
  screen: AppScreen;
  selectedLandingId: string | null;
  activeEclipseId: string | null;
};

type AppAction =
  | { type: "SELECT_LANDING"; id: string }
  | { type: "GO_TO_TIMER" }
  | { type: "GO_TO_LANDING" };

const initialState: AppState = {
  screen: "landing",
  selectedLandingId: null,
  activeEclipseId: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SELECT_LANDING":
      return { ...state, selectedLandingId: action.id };
    case "GO_TO_TIMER":
      if (!state.selectedLandingId) return state;
      return {
        ...state,
        screen: "timer",
        activeEclipseId: state.selectedLandingId,
      };
    case "GO_TO_LANDING":
      return { ...state, screen: "landing" };
    default:
      return state;
  }
}

type AppStateContextValue = {
  state: AppState;
  actions: {
    selectLanding: (id: string) => void;
    goToTimer: () => void;
    goToLanding: () => void;
  };
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions = useMemo(
    () => ({
      selectLanding: (id: string) => dispatch({ type: "SELECT_LANDING", id }),
      goToTimer: () => dispatch({ type: "GO_TO_TIMER" }),
      goToLanding: () => dispatch({ type: "GO_TO_LANDING" }),
    }),
    []
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
