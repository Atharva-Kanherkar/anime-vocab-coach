// Re-exports the unified agent panel (legacy overlay module path).
export {
  showAgentPanel,
  dismissAgent,
  isAgentActive,
  isOpen,
  type AgentPanelOptions,
  type CardOptions,
  type InteractionMode,
} from "./agent-panel";

export { dismissAgent as dismissCopilot, isAgentActive as isCopilotActive } from "./agent-panel";
