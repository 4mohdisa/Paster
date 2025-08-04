import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
	hasTakenSurvey: boolean;
	setHasTakenSurvey: (value: boolean) => void;
}

export const useAppStateStore = create<AppState>()(
	persist(
		(set) => ({
			hasTakenSurvey: false,
			setHasTakenSurvey: (value) => set({ hasTakenSurvey: value }),
		}),
		{
			name: "app-state",
		},
	),
);
