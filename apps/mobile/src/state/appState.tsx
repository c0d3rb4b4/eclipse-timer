import React, { createContext, useContext, useMemo, useReducer } from "react";

type AppState = {
  selectedLandingId: string | null;
  activeEclipseId: string | null;
};

type AppAction =
  | { type: "SELECT_LANDING"; id: string }
  | { type: "ACTIVATE_SELECTED" };

const initialState: AppState = {
  selectedLandingId: null,
  activeEclipseId: null,
};

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
    default:
      return state;
  }
}

type AppStateContextValue = {
  state: AppState;
  actions: {
    selectLanding: (id: string) => void;
    activateSelected: () => void;
  };
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions = useMemo(
    () => ({
      selectLanding: (id: string) => dispatch({ type: "SELECT_LANDING", id }),
      activateSelected: () => dispatch({ type: "ACTIVATE_SELECTED" }),
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
