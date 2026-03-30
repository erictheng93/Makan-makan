/**
 * Contract Test Helpers
 *
 * Utilities for API contract testing — validates that response shapes
 * match their declared Zod schemas. Any schema drift (field added,
 * removed, or renamed) causes a compile-time or test-time failure.
 */

import { z, type ZodType } from "zod";

// ---------------------------------------------------------------------------
// Common Response Envelopes
// ---------------------------------------------------------------------------

/** Standard success envelope: { success: true, data: T } */
export function successEnvelope<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/** Success envelope with optional message */
export function successWithMessage<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });
}

/** Success with pagination meta */
export function paginatedEnvelope<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(dataSchema),
    pagination: PaginationSchema.optional(),
    meta: PaginationMetaSchema.optional(),
  });
}

/** Message-only success response (DELETE, password change, etc.) */
export const messageOnlyResponse = z.object({
  success: z.literal(true),
  message: z.string(),
});

/** Standard error envelope */
export const errorEnvelope = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Common Sub-Schemas
// ---------------------------------------------------------------------------

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export const TimestampFields = {
  createdAt: z.union([z.string(), z.date(), z.number()]),
  updatedAt: z.union([z.string(), z.date(), z.number()]),
};

// ---------------------------------------------------------------------------
// Contract Test Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a value conforms to a Zod schema.
 * Returns the parse result for further assertions.
 */
export function assertMatchesSchema<T extends ZodType>(
  schema: T,
  value: unknown,
  label?: string,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const prefix = label ? `[${label}] ` : "";
    throw new Error(
      `${prefix}Response does not match contract schema:\n${result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return result.data;
}

/**
 * Assert that a value does NOT contain unexpected fields beyond what the schema defines.
 * Helps catch accidental data leakage (e.g., password hashes in user responses).
 */
export function assertNoExtraFields(
  expectedKeys: string[],
  actual: Record<string, unknown>,
  label?: string,
): void {
  const actualKeys = Object.keys(actual);
  const extra = actualKeys.filter((k) => !expectedKeys.includes(k));
  if (extra.length > 0) {
    const prefix = label ? `[${label}] ` : "";
    throw new Error(
      `${prefix}Response contains unexpected fields: ${extra.join(", ")}`,
    );
  }
}

/**
 * Assert that sensitive fields are NOT present in a response.
 */
export function assertNoSensitiveFields(
  actual: Record<string, unknown>,
  sensitiveFields: string[],
  label?: string,
): void {
  const leaked = sensitiveFields.filter((f) => f in actual);
  if (leaked.length > 0) {
    const prefix = label ? `[${label}] ` : "";
    throw new Error(
      `${prefix}Response leaks sensitive fields: ${leaked.join(", ")}`,
    );
  }
}
