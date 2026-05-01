import { describe, it, expect } from "vitest";
import { ApiError } from "@makanmakan/utils";
import { WaitingStatus } from "@makanmakan/shared-types";
import {
  WAITING_TRANSITIONS,
  assertWaitingTransition,
  isValidWaitingTransition,
} from "../state-machine";

describe("ticket-primitives/state-machine", () => {
  describe("WAITING_TRANSITIONS table", () => {
    it("covers all 7 WaitingStatus values as keys", () => {
      const keys = Object.keys(WAITING_TRANSITIONS).sort();
      expect(keys).toEqual([
        "called",
        "cancelled",
        "confirmed",
        "expired",
        "no_show",
        "seated",
        "waiting",
      ]);
    });

    it("treats seated, cancelled, expired, no_show as terminal", () => {
      expect(WAITING_TRANSITIONS[WaitingStatus.SEATED]).toEqual([]);
      expect(WAITING_TRANSITIONS[WaitingStatus.CANCELLED]).toEqual([]);
      expect(WAITING_TRANSITIONS[WaitingStatus.EXPIRED]).toEqual([]);
      expect(WAITING_TRANSITIONS[WaitingStatus.NO_SHOW]).toEqual([]);
    });
  });

  describe("isValidWaitingTransition", () => {
    it("allows the canonical happy path waiting → called → confirmed → seated", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.WAITING, WaitingStatus.CALLED),
      ).toBe(true);
      expect(
        isValidWaitingTransition(WaitingStatus.CALLED, WaitingStatus.CONFIRMED),
      ).toBe(true);
      expect(
        isValidWaitingTransition(WaitingStatus.CONFIRMED, WaitingStatus.SEATED),
      ).toBe(true);
    });

    it("allows called → seated (skip-confirm path matches WaitingListService.markSeated)", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.CALLED, WaitingStatus.SEATED),
      ).toBe(true);
    });

    it("allows cancellation from waiting/called/confirmed", () => {
      expect(
        isValidWaitingTransition(
          WaitingStatus.WAITING,
          WaitingStatus.CANCELLED,
        ),
      ).toBe(true);
      expect(
        isValidWaitingTransition(WaitingStatus.CALLED, WaitingStatus.CANCELLED),
      ).toBe(true);
      expect(
        isValidWaitingTransition(
          WaitingStatus.CONFIRMED,
          WaitingStatus.CANCELLED,
        ),
      ).toBe(true);
    });

    it("allows expiration from waiting/called/confirmed", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.WAITING, WaitingStatus.EXPIRED),
      ).toBe(true);
      expect(
        isValidWaitingTransition(WaitingStatus.CALLED, WaitingStatus.EXPIRED),
      ).toBe(true);
      expect(
        isValidWaitingTransition(
          WaitingStatus.CONFIRMED,
          WaitingStatus.EXPIRED,
        ),
      ).toBe(true);
    });

    it("rejects skipping the call step (waiting → seated, waiting → confirmed)", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.WAITING, WaitingStatus.SEATED),
      ).toBe(false);
      expect(
        isValidWaitingTransition(
          WaitingStatus.WAITING,
          WaitingStatus.CONFIRMED,
        ),
      ).toBe(false);
    });

    it("rejects any transition out of terminal states", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.SEATED, WaitingStatus.CALLED),
      ).toBe(false);
      expect(
        isValidWaitingTransition(
          WaitingStatus.CANCELLED,
          WaitingStatus.WAITING,
        ),
      ).toBe(false);
      expect(
        isValidWaitingTransition(WaitingStatus.EXPIRED, WaitingStatus.CALLED),
      ).toBe(false);
      expect(
        isValidWaitingTransition(WaitingStatus.NO_SHOW, WaitingStatus.CALLED),
      ).toBe(false);
    });

    it("rejects backwards transitions", () => {
      expect(
        isValidWaitingTransition(WaitingStatus.CALLED, WaitingStatus.WAITING),
      ).toBe(false);
      expect(
        isValidWaitingTransition(WaitingStatus.CONFIRMED, WaitingStatus.CALLED),
      ).toBe(false);
    });
  });

  describe("assertWaitingTransition", () => {
    it("returns void for legal transitions", () => {
      expect(() =>
        assertWaitingTransition(WaitingStatus.WAITING, WaitingStatus.CALLED),
      ).not.toThrow();
      expect(() =>
        assertWaitingTransition(WaitingStatus.CALLED, WaitingStatus.SEATED),
      ).not.toThrow();
    });

    it("throws ApiError(409, INVALID_STATUS_TRANSITION) on illegal transitions", () => {
      let caught: unknown;
      try {
        assertWaitingTransition(WaitingStatus.SEATED, WaitingStatus.CALLED);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      const apiErr = caught as ApiError;
      expect(apiErr.code).toBe("INVALID_STATUS_TRANSITION");
      expect(apiErr.status).toBe(409);
      expect(apiErr.message).toContain("seated");
      expect(apiErr.message).toContain("called");
    });

    it("rejects waiting → seated (skipping call/confirm)", () => {
      expect(() =>
        assertWaitingTransition(WaitingStatus.WAITING, WaitingStatus.SEATED),
      ).toThrow(ApiError);
    });

    it("rejects called → waiting (backwards)", () => {
      expect(() =>
        assertWaitingTransition(WaitingStatus.CALLED, WaitingStatus.WAITING),
      ).toThrow(ApiError);
    });

    it("rejects no_show → any (terminal)", () => {
      expect(() =>
        assertWaitingTransition(WaitingStatus.NO_SHOW, WaitingStatus.CALLED),
      ).toThrow(ApiError);
      expect(() =>
        assertWaitingTransition(WaitingStatus.NO_SHOW, WaitingStatus.SEATED),
      ).toThrow(ApiError);
    });
  });
});
