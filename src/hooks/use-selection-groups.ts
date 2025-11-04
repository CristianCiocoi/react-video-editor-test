import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectionGroup, SelectionGroupListItem, SelectionData } from "@/lib/db-types";

const API_BASE = "/api/selection-groups";

// Fetch all selection groups (list view)
export function useSelectionGroups() {
  return useQuery<SelectionGroupListItem[]>({
    queryKey: ["selection-groups"],
    queryFn: async () => {
      const response = await fetch(API_BASE);
      if (!response.ok) {
        throw new Error("Failed to fetch selection groups");
      }
      return response.json();
    },
  });
}

// Fetch a specific selection group with full data
export function useSelectionGroup(id: number | null) {
  return useQuery<SelectionGroup>({
    queryKey: ["selection-group", id],
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");

      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch selection group");
      }
      return response.json();
    },
    enabled: id !== null,
  });
}

// Create a new selection group
export function useCreateSelectionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; data: SelectionData }) => {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create selection group");
      }

      return response.json() as Promise<SelectionGroup>;
    },
    onSuccess: () => {
      // Invalidate the list query to refetch
      queryClient.invalidateQueries({ queryKey: ["selection-groups"] });
    },
  });
}

// Update an existing selection group
export function useUpdateSelectionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, data }: { id: number; name?: string; data?: SelectionData }) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update selection group");
      }

      return response.json() as Promise<SelectionGroup>;
    },
    onSuccess: (data) => {
      // Invalidate both list and specific item queries
      queryClient.invalidateQueries({ queryKey: ["selection-groups"] });
      queryClient.invalidateQueries({ queryKey: ["selection-group", data.id] });
    },
  });
}

// Delete a selection group (optional)
export function useDeleteSelectionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete selection group");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the list query to refetch
      queryClient.invalidateQueries({ queryKey: ["selection-groups"] });
    },
  });
}
