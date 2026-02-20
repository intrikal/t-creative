import { describe, it, expect, beforeEach } from "vitest";
import { useStudioStore } from "@/stores/useStudioStore";

/**
 * Reset the Zustand store to its initial state before each test
 * by calling the internal setState with the original defaults.
 */
beforeEach(() => {
  useStudioStore.setState({
    mode: "landing",
    activeZone: null,
    targetZone: null,
    isTransitioning: false,
    hoveredZone: null,
  });
});

describe("useStudioStore", () => {
  it("has initial state of landing mode with no active zone", () => {
    const state = useStudioStore.getState();
    expect(state.mode).toBe("landing");
    expect(state.activeZone).toBeNull();
    expect(state.targetZone).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });

  it("enterStudio() transitions to entering mode", () => {
    useStudioStore.getState().enterStudio();
    const state = useStudioStore.getState();
    expect(state.mode).toBe("entering");
    expect(state.isTransitioning).toBe(true);
  });

  it("completeTransition() after entering transitions to exploring", () => {
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    const state = useStudioStore.getState();
    expect(state.mode).toBe("exploring");
    expect(state.isTransitioning).toBe(false);
  });

  it('focusZone("lash") sets targetZone and isTransitioning', () => {
    // Get into exploring mode first
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();

    useStudioStore.getState().focusZone("lash");
    const state = useStudioStore.getState();
    expect(state.targetZone).toBe("lash");
    expect(state.isTransitioning).toBe(true);
  });

  it("completeTransition() after focusZone sets focused mode with activeZone", () => {
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().focusZone("lash");
    useStudioStore.getState().completeTransition();

    const state = useStudioStore.getState();
    expect(state.mode).toBe("focused");
    expect(state.activeZone).toBe("lash");
    expect(state.targetZone).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });

  it("unfocusZone() returns to exploring mode", () => {
    // Enter → explore → focus → unfocus
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().focusZone("lash");
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().unfocusZone();
    useStudioStore.getState().completeTransition();

    const state = useStudioStore.getState();
    expect(state.mode).toBe("exploring");
    expect(state.activeZone).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });

  it("exitStudio() + completeTransition() returns to landing", () => {
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().exitStudio();

    expect(useStudioStore.getState().mode).toBe("exiting");
    expect(useStudioStore.getState().isTransitioning).toBe(true);

    useStudioStore.getState().completeTransition();
    const state = useStudioStore.getState();
    expect(state.mode).toBe("landing");
    expect(state.activeZone).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });

  it("focusZone is blocked when isTransitioning is true", () => {
    useStudioStore.getState().enterStudio();
    // isTransitioning is now true
    expect(useStudioStore.getState().isTransitioning).toBe(true);

    useStudioStore.getState().focusZone("jewelry");
    // targetZone should remain null because the action was blocked
    expect(useStudioStore.getState().targetZone).toBeNull();
  });

  it("nextZone() cycles forward through zones", () => {
    // Enter → explore → focus on lash
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().focusZone("lash");
    useStudioStore.getState().completeTransition();

    // Now activeZone is "lash" (index 0). nextZone → "jewelry" (index 1)
    useStudioStore.getState().nextZone();
    expect(useStudioStore.getState().targetZone).toBe("jewelry");

    useStudioStore.getState().completeTransition();
    expect(useStudioStore.getState().activeZone).toBe("jewelry");
  });

  it("prevZone() cycles backward through zones", () => {
    // Enter → explore → focus on lash (index 0)
    useStudioStore.getState().enterStudio();
    useStudioStore.getState().completeTransition();
    useStudioStore.getState().focusZone("lash");
    useStudioStore.getState().completeTransition();

    // prevZone from index 0 should wrap to last zone: "consulting" (index 3)
    useStudioStore.getState().prevZone();
    expect(useStudioStore.getState().targetZone).toBe("consulting");

    useStudioStore.getState().completeTransition();
    expect(useStudioStore.getState().activeZone).toBe("consulting");
  });
});
