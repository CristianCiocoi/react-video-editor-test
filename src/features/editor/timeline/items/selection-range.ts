import { Trimmable, TrimmableProps, unitsToTimeMs, timeMsToUnits, Control } from "@designcombo/timeline";
import { createResizeControls } from "../controls";

export interface SelectionRangeProps extends TrimmableProps {
  metadata?: {
    selectionName?: string;
    start?: number;
    end?: number;
    color?: string;
  };
}

class SelectionRange extends Trimmable {
  static type = "SelectionRange";
  declare id: string;
  public itemType = "selectionRange";
  public name: string;
  public selectionStart: number; // in seconds
  public selectionEnd: number; // in seconds
  public color: string;
  private playerRef: any = null;
  private originalPosition: number = 0;
  private isDragging: boolean = false;
  private _isMovingBlock: boolean = false;
  private _isScalingBlock: boolean = false;
  private prevSelectionEnd: number | null = null;
  private nextSelectionStart: number | null = null;
  private originalWidth: number = 0;

  static createControls(): { controls: Record<string, Control> } {
    const controls = createResizeControls();
    // Ensure proper cursor styling for resize handles
    if (controls.ml) {
      controls.ml.cursorStyle = "ew-resize";
    }
    if (controls.mr) {
      controls.mr.cursorStyle = "ew-resize";
    }
    return { controls };
  }

  constructor(props: any) {
    // Extract metadata from the props - timeline library passes it directly
    const metadata = props.metadata || {};
    const color = metadata.color || "#10b981";
    const name = metadata.selectionName || "Selection";

    // Pass fill and stroke in props to ensure they're set properly
    const enhancedProps = {
      ...props,
      fill: color,
      stroke: color,
      opacity: 0.6,
      strokeWidth: 2,
      rx: 4,
      ry: 4,
    };

    super(enhancedProps);

    this.id = props.id;
    this.name = name;
    this.selectionStart = metadata.start || 0;
    this.selectionEnd = metadata.end || 1;
    this.color = color;

    this.transparentCorners = false;
    this.hasBorders = false;
    this.borderOpacityWhenMoving = 1;

    // Enable both movement and resizing
    this.lockMovementY = true; // Lock vertical movement (only horizontal on timeline)
    this.lockMovementX = false; // Allow horizontal movement
    this.lockScalingX = false;
    this.lockScalingY = true;
    this.lockRotation = true;

    // Make it selectable and interactive
    this.selectable = true;
    this.evented = true;
    this.hoverCursor = "move";

    // Make controls visible and interactive
    this.hasControls = true;
    this.cornerSize = 10; // Size of control handles
    this.cornerStyle = "rect";
    this.cornerColor = "rgba(255, 255, 255, 0.9)";
    this.cornerStrokeColor = this.color;
    this.padding = 0;

    // Enable trimming (dragging edges)
    this.setControlsVisibility({
      mt: false, // middle top
      mb: false, // middle bottom
      ml: true, // middle left (start edge)
      mr: true, // middle right (end edge)
      bl: false,
      br: false,
      tl: false,
      tr: false,
      mtr: false, // rotation
    });

    // Bind event handlers
    this.on("moving", this.onMoving.bind(this));
    this.on("resizing", this.onScaling.bind(this)); // Changed from "scaling" to "resizing" to match the control's actionName
    this.on("modified", this.onModifyEnd.bind(this));
    this.on("mousedown", () => {
      this.isDragging = true;
      this.onModifyStart();
    });
  }

  // Set player reference for seeking during drag
  public setPlayerRef(ref: any) {
    this.playerRef = ref;
  }

  // Set boundaries based on adjacent selections
  public setBoundaries(prevEnd: number | null, nextStart: number | null) {
    this.prevSelectionEnd = prevEnd;
    this.nextSelectionStart = nextStart;
  }

  // Custom render method to draw the selection
  public _render(ctx: CanvasRenderingContext2D) {
    // Always ensure colors are set before rendering
    if (this.fill !== this.color || this.stroke !== this.color) {
      this.set({ fill: this.color, stroke: this.color });
    }

    super._render(ctx);

    // Draw selection name
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.font = "600 13px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Draw name with padding
    const padding = 8;
    const textY = this.height / 2;
    ctx.fillText(this.name, padding, textY);

    ctx.restore();
  }

  // Called when drag/resize starts
  public onModifyStart() {
    this.isDragging = true;
    this.originalWidth = this.width;
    // Store original position to restore if needed
    if (this.playerRef?.current && typeof this.playerRef.current.getCurrentFrame === "function") {
      this.originalPosition = this.playerRef.current.getCurrentFrame();
    }
  }

  // Handle moving the entire block (not resizing)
  public onMoving() {
    this._isMovingBlock = true;
    this._isScalingBlock = false;

    if (!this.canvas || !this.isDragging) return;

    let newStart = unitsToTimeMs(this.left, this.tScale) / 1000;
    let newEnd = unitsToTimeMs(this.left + this.width, this.tScale) / 1000;
    const duration = newEnd - newStart;

    let needsCorrection = false;
    let correctedStart = newStart;

    // When moving, maintain width and just constrain position
    // Can't start before time 0
    if (newStart < 0) {
      correctedStart = 0;
      needsCorrection = true;
    }

    // Can't start before previous selection ends
    if (this.prevSelectionEnd !== null && newStart < this.prevSelectionEnd) {
      correctedStart = this.prevSelectionEnd;
      needsCorrection = true;
    }

    // Can't end after next selection starts
    if (this.nextSelectionStart !== null && newEnd > this.nextSelectionStart) {
      correctedStart = this.nextSelectionStart - duration;
      needsCorrection = true;
    }

    if (needsCorrection) {
      const correctedLeft = timeMsToUnits(correctedStart * 1000, this.tScale);
      this.set({ left: correctedLeft });
      this.setCoords();
      this.canvas.requestRenderAll();

      newStart = correctedStart;
      newEnd = correctedStart + duration;
    }

    // Update selection boundaries
    this.selectionStart = newStart;
    this.selectionEnd = newEnd;

    // Player preview
    this.updatePlayerPreview(newStart);
  }

  // Handle resizing edges
  public onScaling() {
    this._isScalingBlock = true;
    this._isMovingBlock = false;

    if (!this.canvas || !this.isDragging) return;

    const oldStart = this.selectionStart;
    const oldEnd = this.selectionEnd;

    let newStart = unitsToTimeMs(this.left, this.tScale) / 1000;
    let newEnd = unitsToTimeMs(this.left + this.width, this.tScale) / 1000;

    let needsCorrection = false;

    // Can't start before time 0
    if (newStart < 0) {
      newStart = 0;
      needsCorrection = true;
    }

    // Can't start before previous selection ends
    if (this.prevSelectionEnd !== null && newStart < this.prevSelectionEnd) {
      newStart = this.prevSelectionEnd;
      needsCorrection = true;
    }

    // Can't end after next selection starts
    if (this.nextSelectionStart !== null && newEnd > this.nextSelectionStart) {
      newEnd = this.nextSelectionStart;
      needsCorrection = true;
    }

    // Ensure minimum duration (0.1 seconds)
    const currentDuration = newEnd - newStart;
    if (currentDuration < 0.1) {
      // When resizing, maintain minimum duration
      // If we're at a boundary and can't expand, keep the current size
      if (this.nextSelectionStart !== null && newEnd >= this.nextSelectionStart) {
        // At right boundary, can't expand right, so expand left instead
        newStart = Math.max(this.prevSelectionEnd !== null ? this.prevSelectionEnd : 0, newEnd - 0.1);
      } else if (this.prevSelectionEnd !== null && newStart <= this.prevSelectionEnd) {
        // At left boundary, can't expand left, so expand right instead
        newEnd = Math.min(this.nextSelectionStart !== null ? this.nextSelectionStart : newStart + 0.1, newStart + 0.1);
      } else {
        // Not at a boundary, can expand in either direction
        newEnd = newStart + 0.1;
      }
      needsCorrection = true;
    }

    if (needsCorrection) {
      const correctedLeft = timeMsToUnits(newStart * 1000, this.tScale);
      const correctedWidth = timeMsToUnits((newEnd - newStart) * 1000, this.tScale);

      this.set({
        left: correctedLeft,
        width: correctedWidth,
      });
      this.setCoords();
      this.canvas.requestRenderAll();
    }

    // Update selection boundaries
    this.selectionStart = newStart;
    this.selectionEnd = newEnd;

    // Determine which edge is being dragged and update preview accordingly
    // If start position changed more than end position, user is dragging left edge
    // If end position changed more than start position, user is dragging right edge
    const startDiff = Math.abs(newStart - oldStart);
    const endDiff = Math.abs(newEnd - oldEnd);

    if (startDiff > endDiff) {
      // Dragging left edge - show preview at start position
      this.updatePlayerPreview(newStart);
    } else {
      // Dragging right edge - show preview at end position
      this.updatePlayerPreview(newEnd);
    }
  }

  // Helper to update player preview
  private updatePlayerPreview(time: number) {
    if (!this.playerRef) {
      console.log("⚠️ No playerRef set");
      return;
    }

    if (!this.playerRef.current) {
      console.log("⚠️ playerRef.current is null");
      return;
    }

    if (typeof this.playerRef.current.seekTo !== "function") {
      console.log("⚠️ seekTo is not a function", this.playerRef.current);
      return;
    }

    // Use hardcoded 30 FPS to match the player configuration
    const fps = 30;
    const frame = Math.floor(time * fps);
    console.log("🎬 Seeking to frame:", frame, "time:", time);
    this.playerRef.current.seekTo(frame);
  }

  // Called when drag/resize ends
  public onModifyEnd() {
    this.isDragging = false;
    this._isMovingBlock = false;
    this._isScalingBlock = false;

    if (this.canvas) {
      const newStart = unitsToTimeMs(this.left, this.tScale) / 1000;
      const newEnd = unitsToTimeMs(this.left + this.width, this.tScale) / 1000;

      // Update the internal properties
      this.selectionStart = newStart;
      this.selectionEnd = newEnd;

      // Emit custom event to update selection store
      const event = new CustomEvent("selection-range-modified", {
        detail: {
          id: this.id,
          name: this.name,
          start: newStart,
          end: newEnd,
          // Include current visual properties to maintain state
          left: this.left,
          width: this.width,
        },
      });
      window.dispatchEvent(event);

      // Request canvas render to show the updated state
      this.canvas.requestRenderAll();
    }
  }
}

export default SelectionRange;
