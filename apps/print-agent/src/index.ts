/**
 * MakanMakan Print Agent
 *
 * Local print service that connects cloud system to physical printers
 * Integrates with queue-core printing modules
 */

import { config } from "dotenv";
import { LocalPrintService } from "./LocalPrintService";
import { createDefaultConfig } from "./config/defaults";
import { validateConfig } from "./config/validation";

// Load environment variables
config();

async function main() {
  try {
    console.log("🖨️  Starting MakanMakan Print Agent v2.0.0");

    // Create configuration
    const printConfig = createDefaultConfig();

    // Validate configuration
    const validation = validateConfig(printConfig);
    if (!validation.success) {
      console.error("❌ Configuration validation failed:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }

    // Create and start print service
    const printService = new LocalPrintService(printConfig);

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Received SIGINT, shutting down gracefully...");
      await printService.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
      await printService.stop();
      process.exit(0);
    });

    // Start the service
    await printService.start();

    console.log("🚀 Print Agent is running and ready for connections");
  } catch (error) {
    console.error("❌ Failed to start Print Agent:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the application
main().catch(console.error);
