import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Issue #132: the copilot is a full-height strip on the right, so its composer
// and judgment row sat on top of Netflix's subtitle / speed / next-episode /
// fullscreen cluster, and its blur painted over whatever still took clicks.
//
// agent-panel.ts is a DOM module that reaches for document at import time, so
// this reads the source the way listening-billing.test.ts does. The values that
// can be asserted directly are asserted directly.
const panel = readFileSync(
  fileURLToPath(new URL("../src/lib/agent-panel.ts", import.meta.url)),
  "utf8"
);
const storage = readFileSync(
  fileURLToPath(new URL("../src/lib/storage.ts", import.meta.url)),
  "utf8"
);

function constValue(name: string): string {
  const m = panel.match(new RegExp(`const ${name} = ([^;]+);`));
  if (!m) throw new Error(`no const ${name}`);
  return m[1].trim();
}

/** Body of a top-level `function <name>(...) { ... }`, brace-matched. */
function functionBody(source: string, name: string): string {
  const start = source.search(new RegExp(`function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`no function ${name}`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("the panel clears the host control strip", () => {
  it("leaves a clearance sized for the tallest supported control bar", () => {
    expect(constValue("PANEL_BOTTOM_CLEARANCE")).toBe('"clamp(140px, 15vh, 190px)"');
  });

  it("stops the whole sidebar above it, not just the click targets", () => {
    // bottom on the sidebar itself means the tint and the 20px blur stop there
    // too. Anchoring only the inner panel would still paint over the controls.
    const rule = panel.slice(panel.indexOf(".avc-agent-sidebar {"));
    // Cut at the rule's own closing brace, not at a ${...} interpolation.
    const body = rule.slice(0, rule.indexOf("\n  }"));
    expect(body).toMatch(/bottom: var\(--avc-panel-bottom\)/);
    expect(body).not.toMatch(/bottom: 0/);
  });

  it("stops the ambient wash there too, not just the sidebar", () => {
    // The wash is a separate full-viewport layer. Clearing the sidebar while it
    // kept painting to the bottom edge left the tint over the very controls
    // this issue is about, so the clearance is owned by the layer both read.
    const layer = panel.slice(panel.indexOf(".avc-agent-layer {"));
    expect(layer.slice(0, layer.indexOf("\n  }"))).toMatch(
      /--avc-panel-bottom: \$\{PANEL_BOTTOM_CLEARANCE\}/
    );
    const amb = panel.slice(panel.indexOf(".avc-agent-ambient {"));
    expect(amb.slice(0, amb.indexOf("\n  }"))).toMatch(/bottom: var\(--avc-panel-bottom\)/);
  });
});

describe("collapse keeps the card", () => {
  const body = functionBody(panel, "setCollapsed");

  it("toggles the rail without unmounting or resolving anything", () => {
    expect(body).toMatch(/classList\.toggle\("avc-collapsed"/);
    expect(body).not.toMatch(/hideAgent/);
    expect(body).not.toMatch(/finishWord/);
    expect(body).not.toMatch(/dismiss/);
  });

  it("persists the choice, and does not write back the one it just restored", () => {
    expect(body).toMatch(/setAgentPanelCollapsed\(next\)/);
    expect(body).toMatch(/if \(persist\)/);
    expect(panel).toMatch(/setCollapsed\(true, false\)/);
  });

  it("is offered separately from close, and says what it does", () => {
    expect(panel).toMatch(/aria-label", "Collapse copilot to a rail, keeping the current word"/);
    expect(panel).toMatch(/aria-label", "Close copilot"/);
    // The two live next to each other in the head; distinct labels are what
    // stops a learner losing a card by aiming at the wrong 26px button.
    expect(panel).toMatch(/headActions\.appendChild\(collapseBtn\)/);
    expect(panel).toMatch(/headActions\.appendChild\(closeBtn\)/);
  });

  it("hides the panel body and the resize grip while railed", () => {
    expect(panel).toMatch(/\.avc-agent-sidebar\.avc-collapsed \{/);
    expect(panel).toMatch(
      /\.avc-agent-sidebar\.avc-collapsed \.avc-agent-panel,\s*\n\s*\.avc-agent-sidebar\.avc-collapsed \.avc-agent-resize \{\s*\n\s*display: none;/
    );
  });

  it("keeps the rail narrower than any resized panel", () => {
    const rail = Number(constValue("PANEL_RAIL_W"));
    const min = Number(constValue("PANEL_MIN_W"));
    expect(rail).toBeGreaterThan(0);
    expect(rail).toBeLessThan(min);
  });

  it("marks the rail when a word is waiting behind it", () => {
    expect(panel).toMatch(/classList\.add\("avc-has-card"\)/);
    expect(panel).toMatch(/classList\.remove\("avc-has-card"\)/);
    expect(panel).toMatch(/\.avc-collapsed\.avc-has-card \.avc-agent-rail-mark/);
  });

  it("hands the wash back to the player too, not just the clicks", () => {
    // The gradient is drawn from --avc-panel-w on the layer, which the
    // sidebar's own class cannot reach; leaving it at the expanded width kept a
    // 340px darkened band over a player that was supposedly given back.
    const body = functionBody(panel, "setCollapsed");
    expect(body).toMatch(/parentElement\?\.style\.setProperty\(\s*\n?\s*"--avc-panel-w"/);
    expect(body).toMatch(/PANEL_RAIL_W : expandedWidth/);
  });

  it("does not stop the video for a card the rail cannot show", () => {
    // Focus mode pauses. Collapsed there is no readable card to pause for, so
    // the learner would get an unexplained stop every time a word came up.
    const present = functionBody(panel, "presentWord");
    expect(present).toMatch(
      /options\.interaction === "focus" && wasPlaying && video && !collapsed/
    );
  });

  it("takes Space without scrolling the page underneath", () => {
    expect(panel).toMatch(/e\.preventDefault\(\); \/\/ Space on a role="button"/);
  });

  it("applies the stored choice on mount, alongside the width", () => {
    const mount = functionBody(panel, "ensureAgentMounted");
    expect(mount).toMatch(/getAgentPanelCollapsed\(\)/);
    expect(mount).toMatch(/getAgentPanelWidth\(\)/);
  });
});

describe("collapse state storage", () => {
  it("reads anything unparseable as expanded", () => {
    // A panel that shows when it should not is recoverable; one that will not
    // come back is not.
    const body = functionBody(storage, "getAgentPanelCollapsed");
    expect(body).toMatch(/agentPanelCollapsed === true/);
  });
});
