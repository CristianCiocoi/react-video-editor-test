import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";
import { dispatch } from "@designcombo/events";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  UploadIcon,
  ListVideo,
  AlertCircle,
  X,
} from "lucide-react";
import { generateId } from "@designcombo/timeline";
import { Button } from "@/components/ui/button";
import useUploadStore from "../store/use-upload-store";
import ModalUpload from "@/components/modal-upload";
import { useSelectionGroups } from "@/hooks/use-selection-groups";
import { useSelectionStore } from "../store/use-selection-store";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export const Uploads = () => {
  const { setShowUploadModal, uploads, pendingUploads, activeUploads, setUploads } = useUploadStore();
  const [isValidating, setIsValidating] = useState(true);
  const [invalidCount, setInvalidCount] = useState(0);

  // Selection groups
  const { data: selectionGroups, isLoading: isLoadingGroups, error: groupsError } = useSelectionGroups();
  const { loadSelectionGroup, currentGroupId } = useSelectionStore();

  // Validate uploads on mount - remove any that are no longer available
  useEffect(() => {
    const validateUploads = async () => {
      if (uploads.length === 0) {
        setIsValidating(false);
        return;
      }

      const validationPromises = uploads.map(async (upload) => {
        const url = upload.metadata?.uploadedUrl || upload.url;

        // Check if URL is available
        try {
          const response = await fetch(url, { method: "HEAD" });
          return response.ok ? upload : null;
        } catch (error) {
          // If fetch fails, the upload is invalid
          return null;
        }
      });

      const validationResults = await Promise.all(validationPromises);
      const validUploads = validationResults.filter((upload) => upload !== null);
      const removedCount = uploads.length - validUploads.length;

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} invalid upload(s)`);
        setInvalidCount(removedCount);
        setUploads(validUploads);
      }

      setIsValidating(false);
    };

    validateUploads();
  }, []); // Only run once on mount

  // Group completed uploads by type
  const videos = uploads.filter((upload) => upload.type?.startsWith("video/") || upload.type === "video");
  const images = uploads.filter((upload) => upload.type?.startsWith("image/") || upload.type === "image");
  const audios = uploads.filter((upload) => upload.type?.startsWith("audio/") || upload.type === "audio");

  const handleAddVideo = (video: any) => {
    const srcVideo = video.metadata?.uploadedUrl || video.url;

    dispatch(ADD_VIDEO, {
      payload: {
        id: generateId(),
        details: {
          src: srcVideo,
        },
        metadata: {
          previewUrl: "https://cdn.designcombo.dev/caption_previews/static_preset1.webp",
        },
      },
      options: {
        resourceId: "main",
        scaleMode: "fit",
      },
    });
  };

  const handleAddImage = (image: any) => {
    const srcImage = image.metadata?.uploadedUrl || image.url;

    dispatch(ADD_IMAGE, {
      payload: {
        id: generateId(),
        type: "image",
        display: {
          from: 0,
          to: 5000,
        },
        details: {
          src: srcImage,
        },
        metadata: {},
      },
      options: {},
    });
  };

  const handleAddAudio = (audio: any) => {
    const srcAudio = audio.metadata?.uploadedUrl || audio.url;
    dispatch(ADD_AUDIO, {
      payload: {
        id: generateId(),
        type: "audio",
        details: {
          src: srcAudio,
        },
        metadata: {},
      },
      options: {},
    });
  };

  const UploadPrompt = () => (
    <div className="flex items-center justify-center px-4">
      <Button className="w-full cursor-pointer" onClick={() => setShowUploadModal(true)}>
        <UploadIcon className="w-4 h-4" />
        <span className="ml-2">Upload</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">Your uploads</div>
      <ModalUpload />
      <UploadPrompt />

      {/* Validation Status */}
      {isValidating && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Validating uploads...</span>
          </div>
        </div>
      )}

      {/* Show notification if invalid uploads were removed */}
      {!isValidating && invalidCount > 0 && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              {invalidCount} upload{invalidCount > 1 ? "s" : ""} removed (no longer available after refresh)
            </span>
          </div>
        </div>
      )}

      {/* Uploads in Progress Section */}
      {(pendingUploads.length > 0 || activeUploads.length > 0) && (
        <div className="p-4">
          <div className="font-medium text-sm mb-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            Uploads in Progress
          </div>
          <div className="flex flex-col gap-2">
            {pendingUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-2">
                <span className="truncate text-xs flex-1">{upload.file?.name || upload.url || "Unknown"}</span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
            ))}
            {activeUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-2">
                <span className="truncate text-xs flex-1">{upload.file?.name || upload.url || "Unknown"}</span>
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs">{upload.progress ?? 0}%</span>
                  <span className="text-xs text-muted-foreground ml-2">{upload.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selection Groups Section */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <ListVideo className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Selection Groups</span>
        </div>

        {isLoadingGroups && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
          </div>
        )}

        {groupsError && (
          <div className="flex items-center gap-2 py-4 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Failed to load selection groups</span>
          </div>
        )}

        {!isLoadingGroups && !groupsError && selectionGroups && selectionGroups.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No selection groups yet</div>
        )}

        {!isLoadingGroups && !groupsError && selectionGroups && selectionGroups.length > 0 && (
          <ScrollArea className="max-h-48">
            <div className="flex flex-col gap-2">
              {selectionGroups.map((group) => (
                <Card
                  key={group.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                    currentGroupId === group.id ? "bg-accent border-primary" : ""
                  }`}
                  onClick={() => {
                    // Fetch full group data and load it
                    fetch(`/api/selection-groups/${group.id}`)
                      .then((res) => res.json())
                      .then((fullGroup) => {
                        loadSelectionGroup(fullGroup);
                      })
                      .catch((err) => {
                        console.error("Failed to load selection group:", err);
                      });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm truncate">{group.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(group.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {currentGroupId === group.id && (
                      <Badge variant="default" className="ml-2 text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex flex-col gap-10 p-4">
        {/* Videos Section */}
        {videos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <VideoIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Videos</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {videos.map((video, idx) => (
                  <div className="flex items-center gap-2 flex-col w-full" key={video.id || idx}>
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddVideo(video)}
                    >
                      <VideoIcon className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {video.file?.name || video.url || "Video"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Images Section */}
        {images.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Images</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {images.map((image, idx) => (
                  <div className="flex items-center gap-2 flex-col w-full" key={image.id || idx}>
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddImage(image)}
                    >
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {image.file?.name || image.url || "Image"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Audios Section */}
        {audios.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Audios</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {audios.map((audio, idx) => (
                  <div className="flex items-center gap-2 flex-col w-full" key={audio.id || idx}>
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddAudio(audio)}
                    >
                      <Music className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {audio.file?.name || audio.url || "Audio"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};
