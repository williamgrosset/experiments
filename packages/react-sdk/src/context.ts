import { createContext } from "react";
import type { ExperimentsContextValue } from "./types.js";

const defaultValue: ExperimentsContextValue = {
  isReady: false,
  isLoading: true,
  error: null,
  assignments: new Map(),
  configVersion: null,
};

export const ExperimentsContext =
  createContext<ExperimentsContextValue>(defaultValue);
