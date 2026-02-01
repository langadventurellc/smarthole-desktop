/**
 * Tests for the Direct Routing service.
 * Covers pattern matching for explicit routing syntax and edge cases.
 */

import { describe, it, expect } from "vitest";
import { tryDirectRoute } from "./direct-routing";

describe("tryDirectRoute", () => {
  const availableClients = ["notebook", "home-assistant", "My_App", "agent123"];

  describe("colon pattern matching", () => {
    it("matches basic colon pattern", () => {
      const result = tryDirectRoute("notebook: Buy milk", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "Buy milk",
        directRouted: true,
      });
    });

    it("matches colon with no space after", () => {
      const result = tryDirectRoute("notebook:Buy milk", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "Buy milk",
        directRouted: true,
      });
    });

    it("matches colon with multiple spaces after", () => {
      const result = tryDirectRoute("notebook:   Buy milk", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "Buy milk",
        directRouted: true,
      });
    });

    it("matches colon with tab after", () => {
      const result = tryDirectRoute("notebook:\tBuy milk", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "Buy milk",
        directRouted: true,
      });
    });
  });

  describe("comma pattern matching", () => {
    it("matches basic comma pattern", () => {
      const result = tryDirectRoute("home-assistant, turn on lights", availableClients);

      expect(result).toEqual({
        clientName: "home-assistant",
        message: "turn on lights",
        directRouted: true,
      });
    });

    it("matches comma with no space after", () => {
      const result = tryDirectRoute("notebook,remember this", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "remember this",
        directRouted: true,
      });
    });

    it("matches comma with multiple spaces after", () => {
      const result = tryDirectRoute("notebook,    do something", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "do something",
        directRouted: true,
      });
    });
  });

  describe("case insensitive client matching", () => {
    it("matches uppercase client name to lowercase registry", () => {
      const result = tryDirectRoute("NOTEBOOK: TEST", availableClients);

      expect(result).toEqual({
        clientName: "notebook", // Registry casing preserved
        message: "TEST",
        directRouted: true,
      });
    });

    it("matches mixed case client name", () => {
      const result = tryDirectRoute("NotEbOoK: test message", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "test message",
        directRouted: true,
      });
    });

    it("matches uppercase to mixed case registry client", () => {
      const result = tryDirectRoute("MY_APP: do thing", availableClients);

      expect(result).toEqual({
        clientName: "My_App", // Registry casing preserved
        message: "do thing",
        directRouted: true,
      });
    });

    it("matches lowercase to mixed case registry client", () => {
      const result = tryDirectRoute("my_app: do thing", availableClients);

      expect(result).toEqual({
        clientName: "My_App",
        message: "do thing",
        directRouted: true,
      });
    });
  });

  describe("client name with special characters", () => {
    it("matches client name with hyphen", () => {
      const result = tryDirectRoute("home-assistant: turn on lights", availableClients);

      expect(result).toEqual({
        clientName: "home-assistant",
        message: "turn on lights",
        directRouted: true,
      });
    });

    it("matches client name with underscore", () => {
      const result = tryDirectRoute("My_App: launch", availableClients);

      expect(result).toEqual({
        clientName: "My_App",
        message: "launch",
        directRouted: true,
      });
    });

    it("matches client name with numbers (not at start)", () => {
      const result = tryDirectRoute("agent123: do task", availableClients);

      expect(result).toEqual({
        clientName: "agent123",
        message: "do task",
        directRouted: true,
      });
    });
  });

  describe("message trimming", () => {
    it("trims leading whitespace from message", () => {
      const result = tryDirectRoute("notebook:    lots of space   ", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "lots of space",
        directRouted: true,
      });
    });

    it("trims trailing whitespace from message", () => {
      const result = tryDirectRoute("notebook: message with trailing   ", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "message with trailing",
        directRouted: true,
      });
    });

    it("trims both leading and trailing whitespace", () => {
      const result = tryDirectRoute("notebook:   trimmed message   ", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "trimmed message",
        directRouted: true,
      });
    });
  });

  describe("multiline messages", () => {
    it("handles multiline message content", () => {
      const multilineMessage = `notebook: First line
Second line
Third line`;

      const result = tryDirectRoute(multilineMessage, availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: `First line
Second line
Third line`,
        directRouted: true,
      });
    });

    it("handles message with only newlines after content", () => {
      const result = tryDirectRoute("notebook: content\n\n\n", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "content",
        directRouted: true,
      });
    });
  });

  describe("no match cases", () => {
    it("returns null when pattern matches but client not registered", () => {
      const result = tryDirectRoute("please note: something", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when no separator present", () => {
      const result = tryDirectRoute("notebook buy milk", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when colon in middle of text", () => {
      const result = tryDirectRoute("please remind me: buy milk", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when message starts with colon (no client name)", () => {
      const result = tryDirectRoute(": message", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when client name starts with number", () => {
      const result = tryDirectRoute("123app: test", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when client name starts with underscore", () => {
      const result = tryDirectRoute("_private: test", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when client name starts with hyphen", () => {
      const result = tryDirectRoute("-client: test", availableClients);

      expect(result).toBeNull();
    });

    it("returns null for empty message", () => {
      const result = tryDirectRoute("", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when only client name with colon and no message", () => {
      const result = tryDirectRoute("notebook:", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when only spaces after colon", () => {
      const result = tryDirectRoute("notebook:   ", availableClients);

      expect(result).toBeNull();
    });

    it("returns null when availableClients is empty", () => {
      const result = tryDirectRoute("notebook: test", []);

      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles single character client name", () => {
      const result = tryDirectRoute("a: test", ["a"]);

      expect(result).toEqual({
        clientName: "a",
        message: "test",
        directRouted: true,
      });
    });

    it("handles single character message", () => {
      const result = tryDirectRoute("notebook: x", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "x",
        directRouted: true,
      });
    });

    it("does not match when colon is in the middle of a longer word", () => {
      const result = tryDirectRoute("time: 3:30pm meeting", ["time"]);

      expect(result).toEqual({
        clientName: "time",
        message: "3:30pm meeting",
        directRouted: true,
      });
    });

    it("only matches first colon/comma as separator", () => {
      const result = tryDirectRoute("notebook: first: second: third", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "first: second: third",
        directRouted: true,
      });
    });

    it("handles client name at word boundary correctly", () => {
      // "notebook" is a registered client, but "notebookpro" is not
      const result = tryDirectRoute("notebookpro: test", availableClients);

      expect(result).toBeNull();
    });

    it("handles message containing the client name", () => {
      const result = tryDirectRoute("notebook: remember notebook password", availableClients);

      expect(result).toEqual({
        clientName: "notebook",
        message: "remember notebook password",
        directRouted: true,
      });
    });

    it("handles very long client names", () => {
      const longClientName = "a" + "b".repeat(100);
      const result = tryDirectRoute(`${longClientName}: test`, [longClientName]);

      expect(result).toEqual({
        clientName: longClientName,
        message: "test",
        directRouted: true,
      });
    });

    it("prefers first matching client when duplicates exist (case variants)", () => {
      // This shouldn't happen in practice but tests the find() behavior
      const clientsWithDupes = ["Notebook", "notebook", "NOTEBOOK"];
      const result = tryDirectRoute("notebook: test", clientsWithDupes);

      // find() returns first match
      expect(result).toEqual({
        clientName: "Notebook",
        message: "test",
        directRouted: true,
      });
    });
  });
});
