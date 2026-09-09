// Re-exports the unified agent panel (legacy overlay module path).
export {
  ensureAgentMounted,
  hideAgent,
  isAgentMounted,
  onAgentVisibility,
  presentWord,
  showAgentPanel,
  showToast,
  dismissAgent,
  isAgentActive,
  isOpen,
  reportLimitReached,
  showLimitSheet,
  dismissLimitSheet,
  type AgentPanelOptions,
  type CardOptions,
  type InteractionMode,
  type LimitKind,
} from "./agent-panel";

export { dismissAgent as dismissCopilot, isAgentActive as isCopilotActive } from "./agent-panel";
