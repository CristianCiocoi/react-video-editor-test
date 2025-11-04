import { create } from "zustand";
import type { SelectionData, SelectionGroup } from "@/lib/db-types";

export interface Selection {
  name: string;
  start: number; // seconds
  end: number; // seconds
}

interface SelectionStore {
  // Current loaded selection group
  currentGroupId: number | null;
  currentGroupName: string | null;
  selections: SelectionData;

  // Selection mode flag (used to disable certain features)
  selectionMode: boolean;

  // Actions
  loadSelectionGroup: (group: SelectionGroup) => void;
  updateSelection: (name: string, start: number, end: number) => void;
  addSelection: (name: string, start: number, end: number) => void;
  removeSelection: (name: string) => void;
  clearSelections: () => void;

  // Helper getters
  getSelectionsList: () => Selection[];
  getSelectionByName: (name: string) => Selection | undefined;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  currentGroupId: null,
  currentGroupName: null,
  selections: {},
  selectionMode: false,

  loadSelectionGroup: (group: SelectionGroup) => {
    set({
      currentGroupId: group.id,
      currentGroupName: group.name,
      selections: group.data,
      selectionMode: true,
    });
  },

  updateSelection: (name: string, start: number, end: number) => {
    set((state) => ({
      selections: {
        ...state.selections,
        [name]: { start, end },
      },
    }));
  },

  addSelection: (name: string, start: number, end: number) => {
    set((state) => {
      // Check if selection with this name already exists
      if (state.selections[name]) {
        console.warn(`Selection "${name}" already exists`);
        return state;
      }

      return {
        selections: {
          ...state.selections,
          [name]: { start, end },
        },
      };
    });
  },

  removeSelection: (name: string) => {
    set((state) => {
      const newSelections = { ...state.selections };
      delete newSelections[name];
      return { selections: newSelections };
    });
  },

  clearSelections: () => {
    set({
      currentGroupId: null,
      currentGroupName: null,
      selections: {},
      selectionMode: false,
    });
  },

  getSelectionsList: () => {
    const { selections } = get();
    return Object.entries(selections)
      .map(([name, { start, end }]) => ({ name, start, end }))
      .sort((a, b) => a.start - b.start); // Sort by start time
  },

  getSelectionByName: (name: string) => {
    const { selections } = get();
    const selection = selections[name];
    if (!selection) return undefined;
    return { name, ...selection };
  },
}));

// Helper function to validate selection boundaries
export function validateSelectionBounds(
  selectionName: string,
  newStart: number,
  newEnd: number,
  allSelections: SelectionData
): { start: number; end: number } {
  // Get all selections sorted by start time
  const sortedSelections = Object.entries(allSelections).sort(([, a], [, b]) => a.start - b.start);

  const currentIndex = sortedSelections.findIndex(([name]) => name === selectionName);

  if (currentIndex === -1) {
    return { start: newStart, end: newEnd };
  }

  const prevSelection = sortedSelections[currentIndex - 1];
  const nextSelection = sortedSelections[currentIndex + 1];

  let validatedStart = newStart;
  let validatedEnd = newEnd;

  // Can't start before previous selection ends
  if (prevSelection && validatedStart < prevSelection[1].end) {
    validatedStart = prevSelection[1].end;
  }

  // Can't end after next selection starts
  if (nextSelection && validatedEnd > nextSelection[1].start) {
    validatedEnd = nextSelection[1].start;
  }

  // Ensure start is always before end
  if (validatedStart >= validatedEnd) {
    validatedEnd = validatedStart + 1; // Minimum 1 second duration
  }

  return { start: validatedStart, end: validatedEnd };
}

// Helper to check if a time is within any selection
export function isTimeInSelection(time: number, selections: SelectionData): boolean {
  return Object.values(selections).some(({ start, end }) => time >= start && time <= end);
}

// Helper to get the next selection after a given time
export function getNextSelection(time: number, selections: SelectionData): Selection | null {
  const sortedSelections = Object.entries(selections)
    .map(([name, { start, end }]) => ({ name, start, end }))
    .sort((a, b) => a.start - b.start);

  const next = sortedSelections.find(({ start }) => start > time);
  return next || null;
}

// Helper to get the current selection at a given time
export function getCurrentSelection(time: number, selections: SelectionData): Selection | null {
  const selection = Object.entries(selections).find(([, { start, end }]) => time >= start && time <= end);

  if (!selection) return null;

  return {
    name: selection[0],
    ...selection[1],
  };
}
