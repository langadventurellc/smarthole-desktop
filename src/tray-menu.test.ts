/**
 * Tests for the tray menu template building logic.
 * Tests menu structure and item states based on input state.
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildTrayMenuTemplate,
  TrayMenuState,
  TrayMenuActions,
  MenuItemOptions,
} from "./tray-menu";
import { InputState } from "./types";

/**
 * Creates default test state with sensible defaults.
 */
function createDefaultState(overrides?: Partial<TrayMenuState>): TrayMenuState {
  return {
    clientCount: 0,
    connectedClients: [],
    currentInputState: InputState.IDLE,
    isRecording: false,
    ...overrides,
  };
}

/**
 * Creates mock actions for testing.
 */
function createMockActions(): TrayMenuActions {
  return {
    onOpenTextInput: vi.fn(),
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onSettings: vi.fn(),
    onAbout: vi.fn(),
    onQuit: vi.fn(),
  };
}

/**
 * Helper to find a menu item by label.
 */
function findMenuItem(template: MenuItemOptions[], label: string): MenuItemOptions | undefined {
  return template.find((item) => item.label === label);
}

describe("buildTrayMenuTemplate", () => {
  describe("client status display", () => {
    it("shows '0 clients connected' when no clients", () => {
      const state = createDefaultState({ clientCount: 0 });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const clientLabel = template[0];
      expect(clientLabel.label).toBe("0 clients connected");
      expect(clientLabel.enabled).toBe(false);
    });

    it("shows '1 client connected' for singular", () => {
      const state = createDefaultState({
        clientCount: 1,
        connectedClients: [{ name: "Test Client" }],
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      expect(template[0].label).toBe("1 client connected");
    });

    it("shows '3 clients connected' for plural", () => {
      const state = createDefaultState({
        clientCount: 3,
        connectedClients: [{ name: "Client 1" }, { name: "Client 2" }, { name: "Client 3" }],
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      expect(template[0].label).toBe("3 clients connected");
    });

    it("includes Connected Clients submenu when clients present", () => {
      const state = createDefaultState({
        clientCount: 2,
        connectedClients: [
          { name: "Client A", description: "Description A" },
          { name: "Client B" },
        ],
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const clientsMenu = findMenuItem(template, "Connected Clients");
      expect(clientsMenu).toBeDefined();
      expect(clientsMenu?.submenu).toHaveLength(2);
    });

    it("omits Connected Clients submenu when no clients", () => {
      const state = createDefaultState({ clientCount: 0 });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const clientsMenu = findMenuItem(template, "Connected Clients");
      expect(clientsMenu).toBeUndefined();
    });
  });

  describe("Open Text Input menu item", () => {
    it("is enabled in IDLE state", () => {
      const state = createDefaultState({ currentInputState: InputState.IDLE });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const openTextItem = findMenuItem(template, "Open Text Input");
      expect(openTextItem?.enabled).toBe(true);
    });

    it("is enabled in RECORDING state", () => {
      const state = createDefaultState({
        currentInputState: InputState.RECORDING,
        isRecording: true,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const openTextItem = findMenuItem(template, "Open Text Input");
      expect(openTextItem?.enabled).toBe(true);
    });

    it("is disabled in PROCESSING state", () => {
      const state = createDefaultState({ currentInputState: InputState.PROCESSING });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const openTextItem = findMenuItem(template, "Open Text Input");
      expect(openTextItem?.enabled).toBe(false);
    });

    it("calls onOpenTextInput action when clicked", () => {
      const state = createDefaultState();
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const openTextItem = findMenuItem(template, "Open Text Input");
      expect(openTextItem?.click).toBe(actions.onOpenTextInput);
    });
  });

  describe("recording toggle menu item", () => {
    it("shows 'Start Recording' when not recording", () => {
      const state = createDefaultState({ isRecording: false });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      const stopItem = findMenuItem(template, "Stop Recording");
      expect(startItem).toBeDefined();
      expect(stopItem).toBeUndefined();
    });

    it("shows 'Stop Recording' when recording", () => {
      const state = createDefaultState({
        isRecording: true,
        currentInputState: InputState.RECORDING,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      const stopItem = findMenuItem(template, "Stop Recording");
      expect(startItem).toBeUndefined();
      expect(stopItem).toBeDefined();
    });

    it("'Start Recording' is enabled in IDLE state", () => {
      const state = createDefaultState({
        currentInputState: InputState.IDLE,
        isRecording: false,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      expect(startItem?.enabled).toBe(true);
    });

    it("'Start Recording' is disabled in RECORDING state", () => {
      const state = createDefaultState({
        currentInputState: InputState.RECORDING,
        isRecording: false, // Edge case: state says recording but flag says no
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      expect(startItem?.enabled).toBe(false);
    });

    it("'Start Recording' is disabled in PROCESSING state", () => {
      const state = createDefaultState({
        currentInputState: InputState.PROCESSING,
        isRecording: false,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      expect(startItem?.enabled).toBe(false);
    });

    it("'Stop Recording' is enabled in RECORDING state", () => {
      const state = createDefaultState({
        currentInputState: InputState.RECORDING,
        isRecording: true,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const stopItem = findMenuItem(template, "Stop Recording");
      expect(stopItem?.enabled).toBe(true);
    });

    it("'Stop Recording' is disabled in PROCESSING state", () => {
      const state = createDefaultState({
        currentInputState: InputState.PROCESSING,
        isRecording: true, // Edge case: flag says recording but state is processing
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const stopItem = findMenuItem(template, "Stop Recording");
      expect(stopItem?.enabled).toBe(false);
    });

    it("calls onStartRecording action when Start Recording clicked", () => {
      const state = createDefaultState({ isRecording: false });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const startItem = findMenuItem(template, "Start Recording");
      expect(startItem?.click).toBe(actions.onStartRecording);
    });

    it("calls onStopRecording action when Stop Recording clicked", () => {
      const state = createDefaultState({
        isRecording: true,
        currentInputState: InputState.RECORDING,
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const stopItem = findMenuItem(template, "Stop Recording");
      expect(stopItem?.click).toBe(actions.onStopRecording);
    });
  });

  describe("standard menu items", () => {
    it("includes Settings item", () => {
      const state = createDefaultState();
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const settingsItem = findMenuItem(template, "Settings...");
      expect(settingsItem).toBeDefined();
      expect(settingsItem?.click).toBe(actions.onSettings);
    });

    it("includes About SmartHole item", () => {
      const state = createDefaultState();
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const aboutItem = findMenuItem(template, "About SmartHole");
      expect(aboutItem).toBeDefined();
      expect(aboutItem?.click).toBe(actions.onAbout);
    });

    it("includes Quit item", () => {
      const state = createDefaultState();
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      const quitItem = findMenuItem(template, "Quit");
      expect(quitItem).toBeDefined();
      expect(quitItem?.click).toBe(actions.onQuit);
    });
  });

  describe("menu structure", () => {
    it("has correct item order with no clients", () => {
      const state = createDefaultState();
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      // Expected order: client count, separator, Open Text Input, Start Recording, separator, Settings, About, separator, Quit
      expect(template[0].label).toBe("0 clients connected");
      expect(template[1].type).toBe("separator");
      expect(template[2].label).toBe("Open Text Input");
      expect(template[3].label).toBe("Start Recording");
      expect(template[4].type).toBe("separator");
      expect(template[5].label).toBe("Settings...");
      expect(template[6].label).toBe("About SmartHole");
      expect(template[7].type).toBe("separator");
      expect(template[8].label).toBe("Quit");
    });

    it("has correct item order with clients", () => {
      const state = createDefaultState({
        clientCount: 1,
        connectedClients: [{ name: "Test" }],
      });
      const actions = createMockActions();

      const template = buildTrayMenuTemplate(state, actions);

      // Expected order: client count, Connected Clients, separator, Open Text Input, Start Recording, separator, Settings, About, separator, Quit
      expect(template[0].label).toBe("1 client connected");
      expect(template[1].label).toBe("Connected Clients");
      expect(template[2].type).toBe("separator");
      expect(template[3].label).toBe("Open Text Input");
      expect(template[4].label).toBe("Start Recording");
      expect(template[5].type).toBe("separator");
      expect(template[6].label).toBe("Settings...");
      expect(template[7].label).toBe("About SmartHole");
      expect(template[8].type).toBe("separator");
      expect(template[9].label).toBe("Quit");
    });
  });
});
