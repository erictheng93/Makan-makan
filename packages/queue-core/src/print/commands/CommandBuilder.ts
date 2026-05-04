/**
 * Print Command Builder
 * High-level interface for building printer commands
 */

import { ESCPOSCommands } from "./ESCPOSCommands";
import type { PrintContent } from "@makanmasak/shared-types";

export interface PrintCommand {
  type: "text" | "image" | "barcode" | "qr" | "cut" | "feed";
  data: any;
  options?: any;
}

export class CommandBuilder {
  private commands: PrintCommand[] = [];

  /**
   * Add text command
   */
  addText(
    text: string,
    options?: {
      bold?: boolean;
      underline?: boolean;
      alignment?: "left" | "center" | "right";
      size?: { width: number; height: number };
    },
  ): CommandBuilder {
    this.commands.push({
      type: "text",
      data: text,
      options,
    });
    return this;
  }

  /**
   * Add image command
   */
  addImage(
    imageData: string,
    options?: {
      width?: number;
      height?: number;
      alignment?: "left" | "center" | "right";
    },
  ): CommandBuilder {
    this.commands.push({
      type: "image",
      data: imageData,
      options,
    });
    return this;
  }

  /**
   * Add barcode command
   */
  addBarcode(
    data: string,
    type: "CODE128" | "CODE39" | "EAN13" | "EAN8" = "CODE128",
  ): CommandBuilder {
    this.commands.push({
      type: "barcode",
      data,
      options: { type },
    });
    return this;
  }

  /**
   * Add QR code command
   */
  addQRCode(data: string, size: number = 3): CommandBuilder {
    this.commands.push({
      type: "qr",
      data,
      options: { size },
    });
    return this;
  }

  /**
   * Add paper cut command
   */
  addCut(full: boolean = true): CommandBuilder {
    this.commands.push({
      type: "cut",
      data: null,
      options: { full },
    });
    return this;
  }

  /**
   * Add paper feed command
   */
  addFeed(lines: number): CommandBuilder {
    this.commands.push({
      type: "feed",
      data: lines,
      options: null,
    });
    return this;
  }

  /**
   * Build ESC/POS command string
   */
  buildESCPOS(): string {
    const commands: string[] = [ESCPOSCommands.initialize()];

    for (const command of this.commands) {
      switch (command.type) {
        case "text":
          if (command.options?.alignment) {
            commands.push(
              ESCPOSCommands.setAlignment(command.options.alignment),
            );
          }
          if (command.options?.bold) {
            commands.push(ESCPOSCommands.setBold(true));
          }
          if (command.options?.underline) {
            commands.push(ESCPOSCommands.setUnderline(true));
          }
          if (command.options?.size) {
            commands.push(
              ESCPOSCommands.setTextSize(
                command.options.size.width,
                command.options.size.height,
              ),
            );
          }

          commands.push(ESCPOSCommands.printLine(command.data));

          // Reset formatting
          if (command.options?.bold) {
            commands.push(ESCPOSCommands.setBold(false));
          }
          if (command.options?.underline) {
            commands.push(ESCPOSCommands.setUnderline(false));
          }
          if (command.options?.size) {
            commands.push(ESCPOSCommands.setTextSize(1, 1));
          }
          break;

        case "barcode":
          commands.push(
            ESCPOSCommands.printBarcode(command.data, command.options?.type),
          );
          break;

        case "qr":
          commands.push(
            ESCPOSCommands.printQRCode(command.data, command.options?.size),
          );
          break;

        case "cut":
          commands.push(ESCPOSCommands.cutPaper(command.options?.full));
          break;

        case "feed":
          commands.push(ESCPOSCommands.feedPaper(command.data));
          break;
      }
    }

    return ESCPOSCommands.buildSequence(commands);
  }

  /**
   * Build from print content
   */
  static fromPrintContent(content: PrintContent): CommandBuilder {
    const builder = new CommandBuilder();

    // Add restaurant header
    if (content.header?.restaurantInfo?.name) {
      builder.addText(content.header.restaurantInfo.name, {
        bold: true,
        alignment: "center",
      });
    }

    if (content.header?.restaurantInfo?.address) {
      builder.addText(content.header.restaurantInfo.address, {
        alignment: "center",
      });
    }

    builder.addFeed(1);

    // Add transaction info
    if (content.header?.transactionInfo) {
      builder.addText(`Order: ${content.header.transactionInfo.orderId}`);
      builder.addText(`Cashier: ${content.header.transactionInfo.cashier}`);
      builder.addText(
        `Time: ${content.header.transactionInfo.timestamp.toLocaleString()}`,
      );
    }

    builder.addFeed(1);

    // Add items
    for (const item of content.items) {
      builder.addText(`${item.quantity}x ${item.name}`);
      builder.addText(`  $${item.totalPrice.toFixed(2)}`, {
        alignment: "right",
      });
    }

    builder.addFeed(1);

    // Add summary
    builder.addText(`Subtotal: $${content.summary.subtotal.toFixed(2)}`, {
      alignment: "right",
    });
    for (const tax of content.summary.tax) {
      builder.addText(`${tax.name}: $${tax.amount.toFixed(2)}`, {
        alignment: "right",
      });
    }
    builder.addText(`Total: $${content.summary.total.toFixed(2)}`, {
      bold: true,
      alignment: "right",
    });

    builder.addFeed(1);

    // Add footer
    if (content.footer?.thankYouMessage) {
      builder.addText(content.footer.thankYouMessage, { alignment: "center" });
    }

    if (content.footer?.qrCode) {
      const size =
        content.footer.qrCode.size === "small"
          ? 2
          : content.footer.qrCode.size === "medium"
            ? 3
            : 4;
      builder.addQRCode(content.footer.qrCode.data, size);
    }

    if (content.footer?.barcode) {
      builder.addBarcode(
        content.footer.barcode.data,
        content.footer.barcode.format,
      );
    }

    // Add cut at the end
    builder.addCut(true);

    return builder;
  }

  /**
   * Clear all commands
   */
  clear(): CommandBuilder {
    this.commands = [];
    return this;
  }

  /**
   * Get command count
   */
  getCommandCount(): number {
    return this.commands.length;
  }
}
