export type PermissionMode = "permissions" | "balanced" | "full";

export interface ElementMark {
  id: number;
  tag: string;
  role: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  selector: string;
}

export interface AXNode {
  id: number;
  role: string;
  name: string;
  value?: string;
  rect: { x: number; y: number; w: number; h: number };
  children?: AXNode[];
}

export type ActionType =
  | "click"
  | "type"
  | "scroll"
  | "navigate"
  | "screenshot"
  | "get_elements"
  | "get_axtree"
  | "set_mode"
  | "get_status";

export interface ActionPayloads {
  click: {
    markId?: number;
    x?: number;
    y?: number;
    doubleClick?: boolean;
    button?: "left" | "right" | "middle";
  };
  type: {
    markId?: number;
    text: string;
    clearFirst?: boolean;
    pressEnter?: boolean;
  };
  scroll: {
    direction: "up" | "down" | "top" | "bottom";
    distance?: number;
  };
  navigate: {
    url: string;
  };
  screenshot: {
    annotateMarks?: boolean;
    format?: "png" | "jpeg";
  };
  get_elements: {
    interactiveOnly?: boolean;
  };
  get_axtree: Record<string, never>;
  set_mode: {
    mode: PermissionMode;
  };
  get_status: Record<string, never>;
}

export interface CommandMessage<T extends ActionType = ActionType> {
  id: string;
  action: T;
  payload: ActionPayloads[T];
  origin?: string;
  timestamp: number;
}

export interface CommandResult {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  blockedByPermission?: boolean;
  timestamp: number;
}

export interface KinematicTrajectoryPoint {
  x: number;
  y: number;
  timeMs: number;
}

export interface ApprovalRequest {
  commandId: string;
  action: ActionType;
  summary: string;
  target?: string;
  mode: PermissionMode;
  created: number;
}
