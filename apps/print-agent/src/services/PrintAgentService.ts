/**
 * Enhanced Print Agent Service
 * Integrates with queue-core printing modules
 */

import {
  PrinterService,
  PrintJobManager,
  PrinterDriverFactory
} from '@makanmakan/queue-core'
import type {
  PrintRequest,
  PrintServiceConfig
} from '@makanmakan/shared-types'
import { LocalPrintServiceConfig } from '../LocalPrintService'

export class PrintAgentService {
  private printerService: PrinterService
  private jobManager: PrintJobManager
  private driverFactory: PrinterDriverFactory
  private config: LocalPrintServiceConfig
  private isInitialized = false

  constructor(config: LocalPrintServiceConfig) {
    this.config = config

    // Create print service configuration from local config
    const printServiceConfig: PrintServiceConfig = this.createPrintServiceConfig(config)

    // Initialize core services from queue-core
    this.printerService = new PrinterService(printServiceConfig)
    this.jobManager = new PrintJobManager({
      maxConcurrentJobs: 5,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      jobTimeout: 30000
    })
    this.driverFactory = new PrinterDriverFactory()

    this.setupEventHandlers()
  }

  // =============================================
  // Service Lifecycle
  // =============================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🔧 Initializing Print Agent Service...')

      // Initialize printer service
      await this.printerService.initialize()

      // Initialize job manager
      await this.jobManager.initialize()

      // Initialize driver factory
      await this.driverFactory.initialize()

      // Auto-discover printers if enabled
      if (this.config.autoDiscovery) {
        await this.discoverPrinters()
      }

      this.isInitialized = true
      console.log('✅ Print Agent Service initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Print Agent Service:', error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    try {
      console.log('🛑 Shutting down Print Agent Service...')

      // Stop job manager (wait for jobs to complete)
      await this.jobManager.shutdown(true)

      // Disconnect all printers
      await this.printerService.shutdown()

      // Cleanup driver factory
      await this.driverFactory.cleanup()

      this.isInitialized = false
      console.log('✅ Print Agent Service shut down successfully')

    } catch (error) {
      console.error('❌ Error during Print Agent Service shutdown:', error)
      throw error
    }
  }

  // =============================================
  // Print Job Management
  // =============================================

  async createPrintJob(request: PrintRequest): Promise<PrintResponse> {
    if (!this.isInitialized) {
      throw new Error('Print Agent Service not initialized')
    }

    try {
      // Validate print request
      this.validatePrintRequest(request)

      // Create print job
      const job = await this.printerService.createPrintJob(request)

      // Queue job for processing
      await this.jobManager.queueJob(job)

      return {
        success: true,
        jobId: job.id,
        message: 'Print job created and queued successfully',
        timestamp: new Date()
      }

    } catch (error) {
      console.error('Print job creation failed:', error)
      return {
        success: false,
        error: {
          code: 'JOB_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      }
    }
  }

  getJobStatus(jobId: string): PrintJob | null {
    return this.jobManager.getJob(jobId)
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      return await this.jobManager.cancelJob(jobId)
    } catch (error) {
      console.error('Job cancellation failed:', error)
      return false
    }
  }

  getQueuedJobs(): PrintJob[] {
    return this.jobManager.getQueuedJobs()
  }

  getActiveJobs(): PrintJob[] {
    return this.jobManager.getActiveJobs()
  }

  // =============================================
  // Device Management
  // =============================================

  async discoverPrinters(): Promise<PrinterDevice[]> {
    try {
      console.log('🔍 Discovering printers...')

      const devices = await this.driverFactory.scanForPrinters([
        'usb', 'network', 'bluetooth'
      ])

      console.log(`Found ${devices.length} printer(s)`)

      // Auto-register discovered printers
      for (const device of devices) {
        await this.registerPrinter(device)
      }

      return devices

    } catch (error) {
      console.error('Printer discovery failed:', error)
      return []
    }
  }

  async registerPrinter(device: PrinterDevice): Promise<boolean> {
    try {
      // Check if device is already registered
      const existing = this.printerService.getDevice(device.id)
      if (existing) {
        console.log(`Printer ${device.name} already registered`)
        return true
      }

      // Create driver for the device
      const driver = await this.driverFactory.createDriver(device)

      // Register with printer service
      await this.printerService.registerDriver(driver)

      console.log(`✅ Registered printer: ${device.name} (${device.brand})`)
      return true

    } catch (error) {
      console.error(`❌ Failed to register printer ${device.name}:`, error)
      return false
    }
  }

  async unregisterPrinter(deviceId: string): Promise<boolean> {
    try {
      await this.printerService.unregisterDriver(deviceId)
      console.log(`🗑️  Unregistered printer: ${deviceId}`)
      return true

    } catch (error) {
      console.error(`❌ Failed to unregister printer ${deviceId}:`, error)
      return false
    }
  }

  getDevices(): PrinterDevice[] {
    return this.printerService.getDevices()
  }

  getDevice(deviceId: string): PrinterDevice | null {
    return this.printerService.getDevice(deviceId)
  }

  // =============================================
  // Health and Statistics
  // =============================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, boolean>
    devices: { total: number; connected: number; errors: number }
    jobs: { queued: number; active: number; failed: number }
  }> {
    const devices = this.getDevices()
    const queuedJobs = this.getQueuedJobs()
    const activeJobs = this.getActiveJobs()

    const connectedDevices = devices.filter(d => d.status === 'connected').length
    const deviceErrors = devices.filter(d => d.status === 'error').length

    const services = {
      printerService: this.printerService.isHealthy(),
      jobManager: this.jobManager.isHealthy(),
      driverFactory: this.driverFactory.isHealthy()
    }

    const allServicesHealthy = Object.values(services).every(Boolean)
    const hasDeviceErrors = deviceErrors > 0
    const hasConnectedDevices = connectedDevices > 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (!allServicesHealthy || (!hasConnectedDevices && devices.length > 0)) {
      status = 'unhealthy'
    } else if (hasDeviceErrors || queuedJobs.length > 50) {
      status = 'degraded'
    }

    return {
      status,
      services,
      devices: {
        total: devices.length,
        connected: connectedDevices,
        errors: deviceErrors
      },
      jobs: {
        queued: queuedJobs.length,
        active: activeJobs.length,
        failed: this.jobManager.getFailedJobsCount()
      }
    }
  }

  getStatistics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      jobs: this.jobManager.getStatistics(),
      devices: this.printerService.getDeviceStatistics(),
      performance: this.printerService.getPerformanceMetrics()
    }
  }

  // =============================================
  // Event Handling
  // =============================================

  private setupEventHandlers(): void {
    // Printer service events
    this.printerService.on('device_connected', (device) => {
      this.emit('device_connected', device)
    })

    this.printerService.on('device_disconnected', (device) => {
      this.emit('device_disconnected', device)
    })

    this.printerService.on('device_error', (device, error) => {
      this.emit('device_error', { device, error })
    })

    // Job manager events
    this.jobManager.on('job_started', (job) => {
      this.emit('job_started', job)
    })

    this.jobManager.on('job_completed', (job) => {
      this.emit('job_completed', job)
    })

    this.jobManager.on('job_failed', (job, error) => {
      this.emit('job_failed', { job, error })
    })

    this.jobManager.on('job_cancelled', (job) => {
      this.emit('job_cancelled', job)
    })
  }

  // Event emitter methods (simple implementation)
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map()

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // =============================================
  // Private Methods
  // =============================================

  private createPrintServiceConfig(config: LocalPrintServiceConfig): PrintServiceConfig {
    return {
      serviceId: `print-agent-${config.restaurantId}`,
      serviceName: config.serviceName,
      version: '2.0.0',
      devices: [],
      queue: {
        maxSize: config.maxQueueSize,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        batchSize: 5
      },
      network: {
        serverPort: config.port,
        apiKey: config.apiKey,
        cloudEndpoint: config.cloudEndpoint,
        heartbeatInterval: config.heartbeatInterval
      }
    }
  }

  private validatePrintRequest(request: PrintRequest): void {
    if (!request.orderId) {
      throw new Error('Missing required field: orderId')
    }

    if (!request.restaurantId) {
      throw new Error('Missing required field: restaurantId')
    }

    if (request.restaurantId !== this.config.restaurantId) {
      throw new Error(`Invalid restaurant ID: expected ${this.config.restaurantId}, got ${request.restaurantId}`)
    }

    if (!request.type) {
      throw new Error('Missing required field: type')
    }

    if (!request.data) {
      throw new Error('Missing required field: data')
    }
  }

  // =============================================
  // Getters
  // =============================================

  get initialized(): boolean {
    return this.isInitialized
  }

  get configuration(): LocalPrintServiceConfig {
    return { ...this.config }
  }
}