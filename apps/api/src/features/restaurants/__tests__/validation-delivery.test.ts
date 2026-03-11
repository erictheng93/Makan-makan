/**
 * Restaurant Settings Validation - Delivery / Takeaway Fields
 */

import { describe, it, expect } from "vitest";
import { restaurantSchemas } from "../schemas/validation";

describe("Restaurant Settings Validation - Delivery Fields", () => {
  // ─── enableTakeaway ───

  it("should accept enableTakeaway as true", () => {
    const result = restaurantSchemas.settings.safeParse({
      enableTakeaway: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept enableTakeaway as false", () => {
    const result = restaurantSchemas.settings.safeParse({
      enableTakeaway: false,
    });
    expect(result.success).toBe(true);
  });

  // ─── enableDelivery ───

  it("should accept enableDelivery as true", () => {
    const result = restaurantSchemas.settings.safeParse({
      enableDelivery: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept enableDelivery as false", () => {
    const result = restaurantSchemas.settings.safeParse({
      enableDelivery: false,
    });
    expect(result.success).toBe(true);
  });

  // ─── deliveryFee ───

  it("should accept deliveryFee of 0 (free delivery)", () => {
    const result = restaurantSchemas.settings.safeParse({ deliveryFee: 0 });
    expect(result.success).toBe(true);
  });

  it("should accept a positive deliveryFee", () => {
    const result = restaurantSchemas.settings.safeParse({ deliveryFee: 60 });
    expect(result.success).toBe(true);
  });

  it("should reject a negative deliveryFee", () => {
    const result = restaurantSchemas.settings.safeParse({ deliveryFee: -1 });
    expect(result.success).toBe(false);
  });

  // ─── estimatedPrepTimeMin ───

  it("should accept a valid estimatedPrepTimeMin", () => {
    const result = restaurantSchemas.settings.safeParse({
      estimatedPrepTimeMin: 15,
    });
    expect(result.success).toBe(true);
  });

  it("should reject estimatedPrepTimeMin of 0", () => {
    const result = restaurantSchemas.settings.safeParse({
      estimatedPrepTimeMin: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject a non-integer estimatedPrepTimeMin", () => {
    const result = restaurantSchemas.settings.safeParse({
      estimatedPrepTimeMin: 1.5,
    });
    expect(result.success).toBe(false);
  });

  // ─── estimatedPrepTimeMax ───

  it("should accept a valid estimatedPrepTimeMax", () => {
    const result = restaurantSchemas.settings.safeParse({
      estimatedPrepTimeMax: 20,
    });
    expect(result.success).toBe(true);
  });

  // ─── Combined / Edge Cases ───

  it("should accept all delivery fields together", () => {
    const result = restaurantSchemas.settings.safeParse({
      enableTakeaway: true,
      enableDelivery: true,
      deliveryFee: 60,
      estimatedPrepTimeMin: 15,
      estimatedPrepTimeMax: 30,
    });
    expect(result.success).toBe(true);
  });

  it("should accept an empty object (all fields optional)", () => {
    const result = restaurantSchemas.settings.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept delivery fields mixed with other settings fields", () => {
    const result = restaurantSchemas.settings.safeParse({
      allowOnlineOrdering: true,
      currency: "TWD",
      enableTakeaway: true,
      enableDelivery: false,
      deliveryFee: 0,
      estimatedPrepTimeMin: 10,
      estimatedPrepTimeMax: 25,
    });
    expect(result.success).toBe(true);
  });
});
