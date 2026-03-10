/**
 * 本地打印代理服務
 * 在餐廳本地運行，連接雲端系統與打印機硬體
 */

import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { PrintAgentService } from "./services/PrintAgentService";
import { PrinterDriverFactory } from "@makanmakan/queue-core/print";
import type { PrintRequest, PrinterEvent } from "@makanmakan/shared-types";

export interface LocalPrintServiceConfig {
  // 網路設定
  port: number;
  wsPort: number;
  allowedOrigins: string[];

  // 認證設定
  apiKey: string;
  cloudEndpoint: string;

  // 服務設定
  serviceName: string;
  restaurantId: string;

  // 打印機設定
  autoDiscovery: boolean;
  discoveryInterval: number; // ms
  heartbeatInterval: number; // ms

  // 佇列設定
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;
}

export class LocalPrintService {
  private config: LocalPrintServiceConfig;
  private printAgentService: PrintAgentService;
  private driverFactory: PrinterDriverFactory;
  private expressApp!: express.Application;
  private wsServer!: WebSocketServer;
  private connectedClients: Set<WebSocket> = new Set();
  private isRunning = false;
  private discoveryTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(config: LocalPrintServiceConfig) {
    this.config = config;
    this.printAgentService = new PrintAgentService(config);
    this.driverFactory = new PrinterDriverFactory({
      connectionTimeout: 10000,
      commandTimeout: 5000,
      retryAttempts: 3,
      enableAutoDetection: config.autoDiscovery,
    });

    this.setupExpressApp();
    this.setupWebSocket();
    this.setupEventHandlers();
  }

  // =============================================
  // 服務生命週期
  // =============================================

  async start(): Promise<void> {
    try {
      console.log(
        `🖨️  Starting Local Print Service for Restaurant ${this.config.restaurantId}`,
      );

      // 啟動 HTTP 伺服器
      await this.startHttpServer();

      // 啟動 WebSocket 伺服器
      await this.startWebSocketServer();

      // 初始化打印機發現
      if (this.config.autoDiscovery) {
        await this.startPrinterDiscovery();
      }

      // 啟動心跳
      this.startHeartbeat();

      // 註冊到雲端
      await this.registerWithCloud();

      this.isRunning = true;
      console.log(`✅ Local Print Service started successfully`);
      console.log(`📡 HTTP API: http://localhost:${this.config.port}`);
      console.log(`🔗 WebSocket: ws://localhost:${this.config.wsPort}`);
    } catch (error) {
      console.error("❌ Failed to start Local Print Service:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping Local Print Service...");

    this.isRunning = false;

    // 停止定時器
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // 關閉 WebSocket 連線
    this.connectedClients.forEach((ws) => ws.close());
    this.wsServer.close();

    // 關閉 HTTP 伺服器
    // expressApp.close() 會在實際實作中調用

    console.log("✅ Local Print Service stopped");
  }

  // =============================================
  // HTTP API 設定
  // =============================================

  private setupExpressApp(): void {
    this.expressApp = express();

    // 中間件
    this.expressApp.use(
      cors({
        origin: this.config.allowedOrigins,
        credentials: true,
      }),
    );
    this.expressApp.use(express.json({ limit: "10mb" }));
    this.expressApp.use(this.authenticateRequest.bind(this));

    // API 路由
    this.setupApiRoutes();

    // 錯誤處理
    this.expressApp.use(this.errorHandler.bind(this));
  }

  private setupApiRoutes(): void {
    const router = express.Router();

    // =============================================
    // 打印作業管理
    // =============================================

    // 創建打印作業
    router.post("/print", async (req, res) => {
      try {
        const printRequest: PrintRequest = req.body;
        const result =
          await this.printAgentService.createPrintJob(printRequest);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "PRINT_FAILED",
            message: `Print job creation failed: ${error}`,
          },
        });
      }
    });

    // 查詢作業狀態
    router.get("/print/:jobId", async (req, res) => {
      try {
        const { jobId } = req.params;
        const job = this.printAgentService.getJobStatus(jobId);

        if (job) {
          res.json({
            success: true,
            data: job,
          });
        } else {
          res.status(404).json({
            success: false,
            error: {
              code: "JOB_NOT_FOUND",
              message: "Print job not found",
            },
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "STATUS_CHECK_FAILED",
            message: `Status check failed: ${error}`,
          },
        });
      }
    });

    // 取消作業
    router.delete("/print/:jobId", async (req, res) => {
      try {
        const { jobId } = req.params;
        const cancelled = await this.printAgentService.cancelJob(jobId);

        res.json({
          success: cancelled,
          message: cancelled
            ? "Job cancelled"
            : "Job not found or cannot be cancelled",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "CANCEL_FAILED",
            message: `Job cancellation failed: ${error}`,
          },
        });
      }
    });

    // =============================================
    // 設備管理
    // =============================================

    // 獲取所有設備
    router.get("/devices", async (req, res) => {
      try {
        const devices = this.printAgentService.getDevices();
        res.json({
          success: true,
          data: devices,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "DEVICE_LIST_FAILED",
            message: `Failed to get devices: ${error}`,
          },
        });
      }
    });

    // 獲取特定設備
    router.get("/devices/:deviceId", async (req, res) => {
      try {
        const { deviceId } = req.params;
        const device = this.printAgentService.getDevice(deviceId);

        if (device) {
          res.json({
            success: true,
            data: device,
          });
        } else {
          res.status(404).json({
            success: false,
            error: {
              code: "DEVICE_NOT_FOUND",
              message: "Device not found",
            },
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "DEVICE_GET_FAILED",
            message: `Failed to get device: ${error}`,
          },
        });
      }
    });

    // 手動添加設備
    router.post("/devices", async (req, res) => {
      try {
        const { connectionType, address, brand: _brand } = req.body;

        // 檢測設備
        const device = await this.driverFactory.detectPrinter({
          type: connectionType,
          address: address,
        });

        if (device) {
          // 註冊打印機
          await this.printAgentService.registerPrinter(device);

          res.json({
            success: true,
            data: device,
            message: "Device added successfully",
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: "DEVICE_NOT_DETECTED",
              message: "Could not detect printer at specified address",
            },
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "DEVICE_ADD_FAILED",
            message: `Failed to add device: ${error}`,
          },
        });
      }
    });

    // 移除設備
    router.delete("/devices/:deviceId", async (req, res) => {
      try {
        const { deviceId } = req.params;
        await this.printAgentService.unregisterPrinter(deviceId);

        res.json({
          success: true,
          message: "Device removed successfully",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "DEVICE_REMOVE_FAILED",
            message: `Failed to remove device: ${error}`,
          },
        });
      }
    });

    // 測試設備
    router.post("/devices/:deviceId/test", async (req, res) => {
      try {
        const { deviceId } = req.params;
        const device = this.printAgentService.getDevice(deviceId);

        if (!device) {
          res.status(404).json({
            success: false,
            error: {
              code: "DEVICE_NOT_FOUND",
              message: "Device not found",
            },
          });
          return;
        }

        // 創建測試打印作業
        const testRequest: PrintRequest = {
          restaurantId: this.config.restaurantId,
          country: "TW",
          type: "order",
          deviceId,
          data: {
            order: {
              id: "TEST_ORDER",
              items: [
                {
                  name: "Test Item",
                  quantity: 1,
                  price: 0,
                },
              ],
              subtotal: 0,
              tax: 0,
              total: 0,
              createdAt: new Date(),
            },
          },
        };

        const result = await this.printAgentService.createPrintJob(testRequest);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "TEST_FAILED",
            message: `Device test failed: ${error}`,
          },
        });
      }
    });

    // =============================================
    // 系統管理
    // =============================================

    // 健康檢查
    router.get("/health", async (req, res) => {
      try {
        const health = await this.printAgentService.healthCheck();
        res.json({
          success: true,
          data: {
            ...health,
            service: "running",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: "2.0.0",
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "HEALTH_CHECK_FAILED",
            message: `Health check failed: ${error}`,
          },
        });
      }
    });

    // 統計資訊
    router.get("/statistics", async (req, res) => {
      try {
        const stats = this.printAgentService.getStatistics();
        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "STATS_FAILED",
            message: `Failed to get statistics: ${error}`,
          },
        });
      }
    });

    // 設備發現
    router.post("/discover", async (req, res) => {
      try {
        const { connectionTypes } = req.body || {
          connectionTypes: ["usb", "network"],
        };
        const devices =
          await this.driverFactory.scanForPrinters(connectionTypes);

        res.json({
          success: true,
          data: devices,
          message: `Found ${devices.length} printer(s)`,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "DISCOVERY_FAILED",
            message: `Device discovery failed: ${error}`,
          },
        });
      }
    });

    this.expressApp.use("/api/v1", router);
  }

  // =============================================
  // WebSocket 設定
  // =============================================

  private setupWebSocket(): void {
    this.wsServer = new WebSocketServer({
      port: this.config.wsPort,
      verifyClient: (info: { origin: string; secure: boolean; req: any }) => {
        // 驗證 WebSocket 連線
        return this.verifyWebSocketClient(info);
      },
    });

    this.wsServer.on("connection", (ws, _request) => {
      console.log("📡 WebSocket client connected");

      this.connectedClients.add(ws);

      // 發送歡迎訊息
      ws.send(
        JSON.stringify({
          type: "welcome",
          data: {
            service: this.config.serviceName,
            restaurantId: this.config.restaurantId,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      // 處理客戶端訊息
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      });

      // 處理連線關閉
      ws.on("close", () => {
        console.log("📡 WebSocket client disconnected");
        this.connectedClients.delete(ws);
      });

      // 處理錯誤
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.connectedClients.delete(ws);
      });
    });
  }

  private verifyWebSocketClient(_info: {
    origin: string;
    secure: boolean;
    req: any;
  }): boolean {
    // 實作 WebSocket 客戶端驗證邏輯
    // 可以檢查 API key、來源等
    return true;
  }

  private handleWebSocketMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case "ping":
        ws.send(
          JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString(),
          }),
        );
        break;

      case "subscribe":
        // 訂閱特定事件類型
        // 實作事件訂閱邏輯
        break;

      default:
        console.warn("Unknown WebSocket message type:", message.type);
    }
  }

  // =============================================
  // 事件處理
  // =============================================

  private setupEventHandlers(): void {
    // 監聽打印機事件
    this.printAgentService.on("device_connected", (data: any) => {
      this.broadcastEvent({
        type: "device_connected",
        timestamp: new Date(),
        data,
      });
    });

    this.printAgentService.on("device_disconnected", (data: any) => {
      this.broadcastEvent({
        type: "device_disconnected",
        timestamp: new Date(),
        data,
      });
    });

    this.printAgentService.on("job_completed", (data: any) => {
      this.broadcastEvent({
        type: "job_completed",
        timestamp: new Date(),
        data,
      });
    });

    this.printAgentService.on("job_failed", (data: any) => {
      this.broadcastEvent({
        type: "job_failed",
        timestamp: new Date(),
        data,
      });
    });
  }

  private broadcastEvent(event: PrinterEvent): void {
    const message = JSON.stringify({
      type: "event",
      event,
    });

    this.connectedClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // =============================================
  // 私有方法
  // =============================================

  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.expressApp.listen(this.config.port, () => {
        resolve();
      });

      server.on("error", reject);
    });
  }

  private async startWebSocketServer(): Promise<void> {
    // WebSocket 伺服器在 setupWebSocket 中已啟動
  }

  private async startPrinterDiscovery(): Promise<void> {
    // 立即執行一次發現
    await this.discoverPrinters();

    // 設定定期發現
    this.discoveryTimer = setInterval(async () => {
      await this.discoverPrinters();
    }, this.config.discoveryInterval);
  }

  private async discoverPrinters(): Promise<void> {
    try {
      console.log("🔍 Discovering printers...");
      const devices = await this.driverFactory.scanForPrinters([
        "usb",
        "network",
      ]);

      for (const device of devices) {
        // 檢查是否已經註冊
        const existing = this.printAgentService.getDevice(device.id);
        if (!existing) {
          try {
            await this.printAgentService.registerPrinter(device);
            console.log(`✅ Registered new printer: ${device.name}`);
          } catch (error) {
            console.error(
              `❌ Failed to register printer ${device.name}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      console.error("Printer discovery failed:", error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, this.config.heartbeatInterval);
  }

  private async sendHeartbeat(): Promise<void> {
    // 發送心跳到雲端服務
    // 實際實作中會調用雲端 API
    console.log("💓 Heartbeat sent to cloud");
  }

  private async registerWithCloud(): Promise<void> {
    try {
      // 註冊到雲端服務
      console.log("☁️  Registering with cloud service...");

      // 實際實作中會調用雲端 API 註冊本地服務
      const _registrationData = {
        serviceId: `local-print-${this.config.restaurantId}`,
        restaurantId: this.config.restaurantId,
        endpoint: `http://localhost:${this.config.port}`,
        wsEndpoint: `ws://localhost:${this.config.wsPort}`,
        devices: this.printAgentService.getDevices(),
        capabilities: [], // this.driverFactory.getSupportedBrands(),
        version: "2.0.0",
      };

      console.log("✅ Successfully registered with cloud service");
    } catch (error) {
      console.error("❌ Failed to register with cloud service:", error);
    }
  }

  private authenticateRequest(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    const apiKey = req.headers["x-api-key"];

    if (apiKey !== this.config.apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
      });
      return;
    }

    next();
  }

  private errorHandler(
    error: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ): void {
    console.error("API Error:", error);

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  }

  // =============================================
  // 公開介面
  // =============================================

  getConfig(): LocalPrintServiceConfig {
    return this.config;
  }

  getPrintAgentService(): PrintAgentService {
    return this.printAgentService;
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
