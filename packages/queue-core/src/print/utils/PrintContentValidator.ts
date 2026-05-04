/**
 * Print Content Validator
 * Validates print content and data
 */

import type { PrintContent } from "@makanmasak/shared-types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PrintContentValidator {
  /**
   * Validate print content
   */
  static validate(content: PrintContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!content) {
      errors.push("Print content is required");
      return { isValid: false, errors, warnings };
    }

    // Validate header
    if (!content.header) {
      errors.push("Print content header is required");
    } else {
      if (!content.header.restaurantInfo?.name) {
        errors.push("Restaurant name is required in header");
      }
      if (!content.header.transactionInfo?.orderId) {
        errors.push("Order ID is required in header");
      }
    }

    // Validate items
    if (!content.items || content.items.length === 0) {
      warnings.push("No items found in print content");
    } else {
      for (const [index, item] of content.items.entries()) {
        if (!item.name) {
          errors.push(`Item ${index + 1} is missing name`);
        }
        if (item.quantity <= 0) {
          errors.push(`Item ${index + 1} quantity must be positive`);
        }
        if (item.unitPrice < 0) {
          errors.push(`Item ${index + 1} unit price cannot be negative`);
        }
      }
    }

    // Validate summary
    if (!content.summary) {
      errors.push("Print content summary is required");
    } else {
      if (content.summary.total < 0) {
        errors.push("Total amount cannot be negative");
      }
    }

    // Validate footer
    if (!content.footer) {
      errors.push("Print content footer is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate content for specific printer type
   */
  static validateForPrinter(
    content: PrintContent,
    printerType: string,
  ): ValidationResult {
    const baseResult = this.validate(content);

    // Add printer-specific validation
    switch (printerType.toLowerCase()) {
      case "thermal":
        if (content.items.length > 50) {
          baseResult.warnings.push("Many items may slow down thermal printing");
        }
        break;
      case "inkjet":
        if (content.footer.qrCode && content.footer.barcode) {
          baseResult.warnings.push(
            "Both QR code and barcode may slow down inkjet printing",
          );
        }
        break;
      case "dot_matrix":
        if (content.header.logo) {
          baseResult.warnings.push(
            "Logo printing not supported on dot matrix printers",
          );
        }
        break;
    }

    return baseResult;
  }
}
