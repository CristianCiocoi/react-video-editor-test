import { useEffect, useRef } from "react";
import { useSelectionStore } from "../store/use-selection-store";
import useStore from "../store/use-store";
import { generateId } from "@designcombo/timeline";
import { dispatch } from "@designcombo/events";
import StateManager, { DESIGN_LOAD } from "@designcombo/state";

const SELECTION_TRACK_ID = "selection-track";

/**
 * Hook to sync selection store with timeline
 * Adds/removes SelectionRange items on the timeline when selections change
 */
export const useSelectionTimeline = (stateManager: StateManager) => {
  const { selections, selectionMode, currentGroupId } = useSelectionStore();
  const { timeline, playerRef } = useStore();
  const selectionItemsRef = useRef<Set<string>>(new Set());
  const trackCreatedRef = useRef(false);
  const isUpdatingFromTimelineRef = useRef(false);

  useEffect(() => {
    if (!timeline || !stateManager) return;

    const currentState = stateManager.getState();

    // When entering selection mode, create the selection track
    if (selectionMode && !trackCreatedRef.current) {
      // Add selection track
      const trackPayload = {
        id: SELECTION_TRACK_ID,
        type: "selectionTrack",
        name: "Selections",
        items: [],
        accepts: ["selectionRange"],
        magnetic: false,
        static: false,
      };

      // Update state with new track
      const updatedDesign = {
        ...currentState,
        tracks: [...currentState.tracks, trackPayload],
      };

      dispatch(DESIGN_LOAD, { payload: updatedDesign });

      trackCreatedRef.current = true;
    }

    // When exiting selection mode, remove the selection track
    if (!selectionMode && trackCreatedRef.current) {
      // Get current state
      const currentState = stateManager.getState();

      // Remove selection items from trackItemsMap and trackItemIds
      const newTrackItemsMap = { ...currentState.trackItemsMap };
      const newTrackItemIds = currentState.trackItemIds.filter((id) => {
        const shouldRemove = selectionItemsRef.current.has(id);
        if (shouldRemove) {
          delete newTrackItemsMap[id];
        }
        return !shouldRemove;
      });

      selectionItemsRef.current.clear();

      // Remove the track
      const newTracks = currentState.tracks.filter((track) => track.id !== SELECTION_TRACK_ID);

      // Update state
      const updatedDesign = {
        ...currentState,
        tracks: newTracks,
        trackItemIds: newTrackItemIds,
        trackItemsMap: newTrackItemsMap,
      };

      dispatch(DESIGN_LOAD, { payload: updatedDesign });

      trackCreatedRef.current = false;
      return;
    }

    // When in selection mode, sync selection items
    if (selectionMode && Object.keys(selections).length > 0) {
      // Get current state
      const currentState = stateManager.getState();

      // Get sorted selections
      const sortedSelections = Object.entries(selections)
        .map(([name, { start, end }]) => ({ name, start, end }))
        .sort((a, b) => a.start - b.start);

      // Check if we need to recreate items (selection names/count changed) or just update times
      const existingItems = Array.from(selectionItemsRef.current);
      const existingItemsMap = currentState.trackItemsMap;

      const needsRecreation =
        existingItems.length !== sortedSelections.length ||
        sortedSelections.some(({ name }, index) => {
          const existingItemId = existingItems[index];
          const existingItem = existingItemsMap[existingItemId];
          return !existingItem || existingItem.metadata?.selectionName !== name;
        });

      if (!needsRecreation) {
        // Just update existing items' times without recreation
        const isFromTimelineDrag = isUpdatingFromTimelineRef.current;
        if (isFromTimelineDrag) {
          isUpdatingFromTimelineRef.current = false;
        }

        const newTrackItemsMap = { ...currentState.trackItemsMap };
        let hasChanges = false;

        sortedSelections.forEach(({ name, start, end }, index) => {
          const itemId = existingItems[index];
          if (newTrackItemsMap[itemId]) {
            const oldStart = newTrackItemsMap[itemId].metadata?.start;
            const oldEnd = newTrackItemsMap[itemId].metadata?.end;

            // Only update if times actually changed
            if (oldStart !== start || oldEnd !== end) {
              newTrackItemsMap[itemId] = {
                ...newTrackItemsMap[itemId],
                display: {
                  from: start * 1000,
                  to: end * 1000,
                },
                metadata: {
                  ...newTrackItemsMap[itemId].metadata,
                  start,
                  end,
                },
              };
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          // Update the data without forcing timeline canvas recreation
          // The timeline items already have the correct visual position from the drag
          const updatedDesign = {
            ...currentState,
            trackItemsMap: newTrackItemsMap,
          };
          dispatch(DESIGN_LOAD, { payload: updatedDesign });
        }
        return;
      }

      // If we need recreation, reset the flag
      if (isUpdatingFromTimelineRef.current) {
        isUpdatingFromTimelineRef.current = false;
      }

      // Remove old selection items
      const newTrackItemsMap = { ...currentState.trackItemsMap };
      const newTrackItemIds = currentState.trackItemIds.filter((id) => {
        const shouldRemove = selectionItemsRef.current.has(id);
        if (shouldRemove) {
          delete newTrackItemsMap[id];
        }
        return !shouldRemove;
      });
      selectionItemsRef.current.clear();

      // Add new selection items
      const colors = [
        "#10b981", // green
        "#3b82f6", // blue
        "#f59e0b", // amber
        "#8b5cf6", // purple
        "#ec4899", // pink
        "#06b6d4", // cyan
      ];

      const newSelectionItems: string[] = [];

      sortedSelections.forEach(({ name, start, end }, index) => {
        const itemId = generateId();
        selectionItemsRef.current.add(itemId);
        newSelectionItems.push(itemId);

        const itemPayload = {
          id: itemId,
          type: "selectionRange",
          text: name, // Use 'text' field for the name (standard timeline prop)
          display: {
            from: start * 1000, // Convert seconds to milliseconds
            to: end * 1000,
          },
          metadata: {
            selectionName: name,
            start: start,
            end: end,
            color: colors[index % colors.length],
          },
        };

        // Add to trackItemsMap
        newTrackItemsMap[itemId] = itemPayload as any;
      });

      // Update selection track with new items
      const updatedTracks = currentState.tracks.map((track) => {
        if (track.id === SELECTION_TRACK_ID) {
          return {
            ...track,
            items: newSelectionItems,
          };
        }
        return track;
      });

      // Update state
      const updatedDesign = {
        ...currentState,
        tracks: updatedTracks,
        trackItemIds: [...newTrackItemIds, ...newSelectionItems],
        trackItemsMap: newTrackItemsMap,
      };

      dispatch(DESIGN_LOAD, { payload: updatedDesign });
    }
  }, [selections, selectionMode, currentGroupId, timeline, stateManager]);

  // Update boundaries and player ref on timeline items whenever selections change
  useEffect(() => {
    if (!timeline || !selectionMode) return;

    const sortedSelections = Object.entries(selections)
      .map(([name, { start, end }]) => ({ name, start, end }))
      .sort((a, b) => a.start - b.start);

    // Update boundaries and player ref for each selection item on the timeline
    const objects = timeline.getObjects();
    objects.forEach((obj: any) => {
      if (obj.itemType === "selectionRange" && obj.name) {
        const index = sortedSelections.findIndex((s) => s.name === obj.name);
        if (index !== -1) {
          const prevEnd = index > 0 ? sortedSelections[index - 1].end : null;
          const nextStart = index < sortedSelections.length - 1 ? sortedSelections[index + 1].start : null;

          if (typeof obj.setBoundaries === "function") {
            obj.setBoundaries(prevEnd, nextStart);
          }

          // Set player reference for preview during drag
          if (typeof obj.setPlayerRef === "function" && playerRef) {
            obj.setPlayerRef(playerRef);
          }
        }
      }
    });
  }, [selections, selectionMode, timeline, playerRef]);

  // Listen for selection-range-modified events from the timeline
  useEffect(() => {
    const handleSelectionModified = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { name, start, end } = customEvent.detail;

      // Update the selection store with the new position
      // Don't validate boundaries here - the SelectionRange class already handles
      // boundary enforcement during drag, so we just need to accept the final position
      const { updateSelection } = useSelectionStore.getState();

      // Set flag to prevent re-sync back to timeline
      isUpdatingFromTimelineRef.current = true;

      // Update the selection store
      updateSelection(name, start, end);
    };

    window.addEventListener("selection-range-modified", handleSelectionModified);

    return () => {
      window.removeEventListener("selection-range-modified", handleSelectionModified);
    };
  }, []);
};
