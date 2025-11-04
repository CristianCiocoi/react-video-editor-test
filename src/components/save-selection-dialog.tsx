"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSelectionStore } from "@/features/editor/store/use-selection-store";
import { useCreateSelectionGroup, useUpdateSelectionGroup } from "@/hooks/use-selection-groups";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SaveSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveSelectionDialog({ open, onOpenChange }: SaveSelectionDialogProps) {
  const { currentGroupId, currentGroupName, selections } = useSelectionStore();
  const [name, setName] = useState(currentGroupName || "");

  // Sync name with currentGroupName when dialog opens or group changes
  useEffect(() => {
    if (open) {
      setName(currentGroupName || "");
    }
  }, [open, currentGroupName]);

  const createMutation = useCreateSelectionGroup();
  const updateMutation = useUpdateSelectionGroup();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (Object.keys(selections).length === 0) {
      toast.error("No selections to save");
      return;
    }

    try {
      if (currentGroupId) {
        // Update existing group
        await updateMutation.mutateAsync({
          id: currentGroupId,
          name: name.trim(),
          data: selections,
        });
        toast.success("Selection group updated successfully!");
      } else {
        // Create new group
        await createMutation.mutateAsync({
          name: name.trim(),
          data: selections,
        });
        toast.success("Selection group created successfully!");
      }
      onOpenChange(false);
      // Name will be reset by useEffect when dialog reopens
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save selection group");
      }
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Name will be reset by useEffect when dialog reopens
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{currentGroupId ? "Update" : "Save"} Selection Group</DialogTitle>
          <DialogDescription>
            {currentGroupId
              ? "Update the name and selections for this group."
              : "Create a new selection group with a unique name."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              placeholder="e.g., Episodes 1-5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label>Selections</Label>
            <div className="text-sm text-muted-foreground">
              {Object.keys(selections).length === 0 ? (
                <p>No selections defined yet</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(selections).map(([name, { start, end }]) => (
                    <div key={name} className="flex justify-between">
                      <span className="font-medium">{name}:</span>
                      <span>
                        {start.toFixed(1)}s - {end.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim() || Object.keys(selections).length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentGroupId ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
