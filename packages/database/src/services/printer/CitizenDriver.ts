/**
 * Citizen 熱敏打印機驅動程式
 * 主要相容 ESC/POS 標準，但有部分特殊擴展命令
 */

import { PrinterDriver } from '../PrinterService'
import { ESCPOSCommands } from './ESCPOSCommands'
import type { 
  PrinterDevice, 
  PrintCommand,
  PrintContent 
} from '@makanmakan/shared-types'

export interface CitizenDriverConfig {
  connection: {
    type: 'usb' | 'network' | 'serial' | 'bluetooth'
    path?: string
    host?: string
    port?: number
    baudRate?: number
  }
  printer: {
    model: string
    series: 'CT-S' | 'CT-D' | 'CT-E' | 'PPU' // Citizen 產品系列
    paperWidth: 58 | 80 | 82.5 // mm (82.5 for CT-D series)
    encoding: string
    cutter: boolean
    drawer: boolean
    buzzer: boolean
    presenter: boolean // 出紙器 (部分型號支援)
  }
}

// Citizen 特殊命令擴展
class CitizenCommands extends ESCPOSCommands {
  // Citizen 特有的切紙命令 (更精確控制)
  static cutPaperCitizen(mode: 'full' | 'partial' = 'full', feedLines = 0): Buffer {
    if (feedLines > 0) {
      // 先走紙再切
      return Buffer.concat([
        Buffer.from([this.ESC, 0x64, feedLines]),
        Buffer.from([this.GS, 0x56, mode === 'full' ? 0x00 : 0x01])
      ])
    }
    return Buffer.from([this.GS, 0x56, mode === 'full' ? 0x00 : 0x01])
  }

  // Citizen 出紙器控制 (CT-D系列)
  static paperPresenter(action: 'eject' | 'retract'): Buffer {
    return action === 'eject' 
      ? Buffer.from([this.ESC, 0x0C]) // 出紙
      : Buffer.from([this.ESC, 0x0D]) // 收回
  }

  // Citizen 特有的頁面設定
  static setPageLength(lines: number): Buffer {
    return Buffer.from([this.ESC, 0x43, lines])
  }

  // Citizen 蜂鳴器 (增強版)
  static buzzerCitizen(pattern: 'short' | 'long' | 'double' | 'triple' = 'short'): Buffer {
    switch (pattern) {
      case 'short':
        return Buffer.from([this.ESC, 0x42, 0x01, 0x01])
      case 'long':
        return Buffer.from([this.ESC, 0x42, 0x01, 0x05])
      case 'double':
        return Buffer.from([this.ESC, 0x42, 0x02, 0x02])
      case 'triple':
        return Buffer.from([this.ESC, 0x42, 0x03, 0x01])
      default:
        return Buffer.from([this.ESC, 0x42, 0x01, 0x01])
    }
  }

  // Citizen 狀態查詢 (增強版)
  static getStatusCitizen(): Buffer {
    return Buffer.from([this.GS, 0x61, 0xFF])
  }

  // Citizen 打印頭溫度控制 (進階功能)
  static setTemperature(level: 1 | 2 | 3 | 4 | 5): Buffer {
    // level 1-5 (1=最低溫, 5=最高溫)
    return Buffer.from([this.ESC, 0x37, level])
  }

  // Citizen 打印濃度控制
  static setPrintDensity(density: number): Buffer {
    // density: 0-100%
    const densityValue = Math.max(0, Math.min(100, density))
    return Buffer.from([this.GS, 0x7C, densityValue])
  }

  // Citizen Logo 存儲和列印 (部分型號支援)
  static downloadLogo(logoId: number, logoData: Buffer): Buffer {
    const commands: Buffer[] = []
    commands.push(Buffer.from([this.GS, 0x2A, logoId, logoData.length & 0xFF, (logoData.length >> 8) & 0xFF]))
    commands.push(logoData)
    return Buffer.concat(commands)
  }

  static printStoredLogo(logoId: number): Buffer {
    return Buffer.from([this.GS, 0x2F, logoId])
  }

  // Citizen 記憶體查詢
  static getMemoryStatus(): Buffer {
    return Buffer.from([this.GS, 0x49, 0x01])
  }
}

export class CitizenDriver extends PrinterDriver {
  private connection: any = null
  private driverConfig: CitizenDriverConfig
  private _isConnected = false

  isConnected(): boolean {
    return this._isConnected
  }

  constructor(device: PrinterDevice, config: CitizenDriverConfig) {
    super(device, config)
    this.driverConfig = config
  }

  // =============================================
  // 連線管理
  // =============================================

  async connect(): Promise<boolean> {
    try {
      await this.establishConnection()
      
      // Citizen 特殊初始化
      await this.initializeCitizenPrinter()
      
      const testResult = await this.testConnection()
      if (testResult) {
        this._isConnected = true
        this.device.status = 'online'
        this.device.lastSeen = new Date()
        
        // 設定最佳打印參數
        await this.optimizePrintSettings()
        
        return true
      }
      
      return false
    } catch (error) {
      console.error(`Failed to connect to Citizen printer ${this.device.id}:`, error)
      this.device.status = 'error'
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connection && this._isConnected) {
        await this.closeConnection()
      }
    } catch (error) {
      console.error(`Error disconnecting Citizen printer ${this.device.id}:`, error)
    } finally {
      this._isConnected = false
      this.device.status = 'offline'
      this.connection = null
    }
  }

  private async establishConnection(): Promise<void> {
    const { type, path, host, port, baudRate } = this.driverConfig.connection

    switch (type) {
      case 'usb':
        this.connection = await this.connectUSB(path!)
        break
      
      case 'network':
        this.connection = await this.connectNetwork(host!, port!)
        break
      
      case 'serial':
        this.connection = await this.connectSerial(path!, baudRate!)
        break
      
      default:
        throw new Error(`Unsupported connection type: ${type}`)
    }
  }

  private async connectUSB(devicePath: string): Promise<any> {
    // Citizen USB 連線
    const mockUSBConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve()
    }

    console.log(`Connecting to Citizen USB device: ${devicePath}`)
    return mockUSBConnection
  }

  private async connectNetwork(host: string, port: number): Promise<any> {
    // Citizen 網路連線 (通常使用 9100 埠)
    const net = require('net')
    
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        console.log(`Connected to Citizen network printer: ${host}:${port}`)
        resolve({
          write: (data: Buffer) => new Promise((writeResolve, writeReject) => {
            socket.write(data, (err: any) => {
              if (err) writeReject(err)
              else writeResolve(true)
            })
          }),
          read: () => Promise.resolve(Buffer.alloc(0)),
          close: () => new Promise(closeResolve => {
            socket.end(() => closeResolve(undefined))
          })
        })
      })

      socket.on('error', reject)
      socket.setTimeout(5000, () => {
        reject(new Error('Connection timeout'))
      })
    })
  }

  private async connectSerial(port: string, baudRate: number): Promise<any> {
    const mockSerialConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve()
    }

    console.log(`Connecting to Citizen serial port: ${port} at ${baudRate} baud`)
    return mockSerialConnection
  }

  private async closeConnection(): Promise<void> {
    if (this.connection && this.connection.close) {
      await this.connection.close()
    }
  }

  private async initializeCitizenPrinter(): Promise<void> {
    // Citizen 特有的初始化序列
    const commands: Buffer[] = []
    
    // 基本初始化
    commands.push(CitizenCommands.initialize())
    
    // 根據系列設定參數
    if (this.driverConfig.printer.series === 'CT-D') {
      // CT-D 系列特殊設定 (有出紙器)
      commands.push(CitizenCommands.setPageLength(60))
    } else if (this.driverConfig.printer.series === 'CT-S') {
      // CT-S 系列緊湊型設定
      commands.push(CitizenCommands.setTemperature(3))
    }

    const initBuffer = Buffer.concat(commands)
    await this.sendRawData(initBuffer)
  }

  private async optimizePrintSettings(): Promise<void> {
    // 根據紙張寬度和型號優化設定
    const commands: Buffer[] = []
    
    // 設定適當的打印濃度
    commands.push(CitizenCommands.setPrintDensity(85))
    
    // 根據紙張寬度調整溫度
    if (this.driverConfig.printer.paperWidth === 58) {
      commands.push(CitizenCommands.setTemperature(2)) // 較低溫度
    } else {
      commands.push(CitizenCommands.setTemperature(3)) // 標準溫度
    }

    const optimizeBuffer = Buffer.concat(commands)
    await this.sendRawData(optimizeBuffer)
  }

  private async testConnection(): Promise<boolean> {
    try {
      const statusCommand = CitizenCommands.getStatusCitizen()
      await this.sendRawData(statusCommand)
      return true
    } catch (error) {
      console.error('Citizen printer connection test failed:', error)
      return false
    }
  }

  // =============================================
  // 打印功能
  // =============================================

  async print(commands: Buffer): Promise<boolean> {
    if (!this._isConnected || !this.connection) {
      throw new Error('Citizen printer not connected')
    }

    try {
      await this.sendRawData(commands)
      return true
    } catch (error) {
      console.error(`Print failed on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  async getStatus(): Promise<PrinterDevice['status']> {
    if (!this._isConnected) {
      return 'offline'
    }

    try {
      const statusCommand = CitizenCommands.getStatusCitizen()
      await this.sendRawData(statusCommand)
      
      // Citizen 狀態解析
      this.device.lastSeen = new Date()
      return 'online'
    } catch (error) {
      console.error(`Status check failed for Citizen printer ${this.device.id}:`, error)
      return 'error'
    }
  }

  async openDrawer(): Promise<boolean> {
    if (!this.supportsFeature('drawer')) {
      return false
    }

    try {
      const drawerCommand = CitizenCommands.openDrawer()
      await this.sendRawData(drawerCommand)
      return true
    } catch (error) {
      console.error(`Failed to open drawer on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  async cutPaper(): Promise<boolean> {
    if (!this.supportsFeature('cutter')) {
      return false
    }

    try {
      // 使用 Citizen 增強切紙功能
      const cutCommand = CitizenCommands.cutPaperCitizen('full', 2)
      await this.sendRawData(cutCommand)
      return true
    } catch (error) {
      console.error(`Failed to cut paper on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  async buzzer(times = 1): Promise<boolean> {
    if (!this.supportsFeature('buzzer')) {
      return false
    }

    try {
      // 使用 Citizen 增強蜂鳴器
      const pattern = times === 1 ? 'short' : times === 2 ? 'double' : 'triple'
      const buzzerCommand = CitizenCommands.buzzerCitizen(pattern as any)
      await this.sendRawData(buzzerCommand)
      return true
    } catch (error) {
      console.error(`Failed to buzz on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  // =============================================
  // Citizen 特有功能
  // =============================================

  async ejectPaper(): Promise<boolean> {
    if (!this.driverConfig.printer.presenter) {
      return false
    }

    try {
      const ejectCommand = CitizenCommands.paperPresenter('eject')
      await this.sendRawData(ejectCommand)
      return true
    } catch (error) {
      console.error(`Failed to eject paper on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  async retractPaper(): Promise<boolean> {
    if (!this.driverConfig.printer.presenter) {
      return false
    }

    try {
      const retractCommand = CitizenCommands.paperPresenter('retract')
      await this.sendRawData(retractCommand)
      return true
    } catch (error) {
      console.error(`Failed to retract paper on Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  async downloadLogo(logoId: number, logoData: Buffer): Promise<boolean> {
    try {
      const downloadCommand = CitizenCommands.downloadLogo(logoId, logoData)
      await this.sendRawData(downloadCommand)
      return true
    } catch (error) {
      console.error(`Failed to download logo to Citizen printer ${this.device.id}:`, error)
      return false
    }
  }

  // =============================================
  // 命令生成 (基於 ESC/POS 但使用 Citizen 增強)
  // =============================================

  generateCommands(content: PrintContent): Buffer {
    const commands: Buffer[] = []
    const width = this.getPaperWidth()

    // Citizen 初始化
    commands.push(CitizenCommands.initialize())

    // 收據頭部
    commands.push(this.generateHeader(content.header, width))

    // 分隔線
    commands.push(CitizenCommands.separator('=', width))

    // 訂單項目
    commands.push(this.generateItems(content.items, width))

    // 分隔線  
    commands.push(CitizenCommands.separator('-', width))

    // 總計區域
    commands.push(this.generateSummary(content.summary, width))

    // 分隔線
    commands.push(CitizenCommands.separator('=', width))

    // 收據底部
    commands.push(this.generateFooter(content.footer))

    // Citizen 特有的結束處理
    commands.push(CitizenCommands.lineFeed(3))

    return Buffer.concat(commands)
  }

  // 其他方法與 Epson 類似，但使用 CitizenCommands
  private generateHeader(header: PrintContent['header'], width: number): Buffer {
    const commands: Buffer[] = []

    const restaurant = header.restaurantInfo
    commands.push(CitizenCommands.setAlignment('center'))
    commands.push(CitizenCommands.setBold(true))
    commands.push(CitizenCommands.setTextSize(2, 2))
    commands.push(CitizenCommands.textLine(restaurant.name))
    commands.push(CitizenCommands.setTextSize(1, 1))
    commands.push(CitizenCommands.setBold(false))

    commands.push(CitizenCommands.textLine(restaurant.address))
    commands.push(CitizenCommands.textLine(`Tel: ${restaurant.phone}`))

    if (restaurant.taxNumber) {
      commands.push(CitizenCommands.textLine(`Tax No: ${restaurant.taxNumber}`))
    }

    commands.push(CitizenCommands.setAlignment('left'))
    commands.push(CitizenCommands.lineFeed())

    const transaction = header.transactionInfo
    commands.push(CitizenCommands.textColumns('Receipt No:', transaction.receiptNumber, width))
    commands.push(CitizenCommands.textColumns('Order ID:', transaction.orderId, width))
    commands.push(CitizenCommands.textColumns('Cashier:', transaction.cashier, width))
    commands.push(CitizenCommands.textLine(transaction.timestamp.toLocaleString()))

    return Buffer.concat(commands)
  }

  private generateItems(items: PrintContent['items'], width: number): Buffer {
    const commands: Buffer[] = []

    for (const item of items) {
      const itemLine = `${item.name} x${item.quantity}`
      const priceStr = this.formatPrice(item.totalPrice)
      commands.push(CitizenCommands.textColumns(itemLine, priceStr, width))

      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modifierLine = `  + ${modifier.name}`
          const modifierPriceStr = modifier.price > 0 ? this.formatPrice(modifier.price) : ''
          commands.push(CitizenCommands.textColumns(modifierLine, modifierPriceStr, width))
        }
      }
    }

    return Buffer.concat(commands)
  }

  private generateSummary(summary: PrintContent['summary'], width: number): Buffer {
    const commands: Buffer[] = []

    commands.push(CitizenCommands.textColumns('Subtotal:', this.formatPrice(summary.subtotal), width))

    if (summary.tax && summary.tax.length > 0) {
      for (const tax of summary.tax) {
        commands.push(CitizenCommands.textColumns(`${tax.name}:`, this.formatPrice(tax.amount), width))
      }
    }

    commands.push(CitizenCommands.separator('-', width))
    commands.push(CitizenCommands.setBold(true))
    commands.push(CitizenCommands.setTextSize(1, 2))
    commands.push(CitizenCommands.textColumns('TOTAL:', this.formatPrice(summary.total), width))
    commands.push(CitizenCommands.setTextSize(1, 1))
    commands.push(CitizenCommands.setBold(false))

    return Buffer.concat(commands)
  }

  private generateFooter(footer: PrintContent['footer']): Buffer {
    const commands: Buffer[] = []

    commands.push(CitizenCommands.setAlignment('center'))
    commands.push(CitizenCommands.lineFeed())
    commands.push(CitizenCommands.textLine(footer.thankYouMessage))

    if (footer.thankYouMessageLocal) {
      commands.push(CitizenCommands.textLine(footer.thankYouMessageLocal))
    }

    // QR Code
    if (footer.qrCode) {
      commands.push(CitizenCommands.lineFeed())
      const qrSize = footer.qrCode.size === 'small' ? 3 : footer.qrCode.size === 'large' ? 6 : 4
      commands.push(CitizenCommands.qrCode(footer.qrCode.data, qrSize))
    }

    commands.push(CitizenCommands.setAlignment('left'))
    return Buffer.concat(commands)
  }

  // =============================================
  // 工具方法
  // =============================================

  private async sendRawData(data: Buffer): Promise<void> {
    if (!this.connection) {
      throw new Error('No connection available')
    }

    await this.connection.write(data)
  }

  private getPaperWidth(): number {
    switch (this.driverConfig.printer.paperWidth) {
      case 58: return 24
      case 80: return 32
      case 82.5: return 34 // CT-D 系列特殊寬度
      default: return 32
    }
  }

  private formatPrice(amount: number): string {
    return amount.toFixed(2)
  }

  // =============================================
  // 診斷和測試
  // =============================================

  async printTestPage(): Promise<boolean> {
    try {
      const commands: Buffer[] = []
      
      commands.push(CitizenCommands.initialize())
      commands.push(CitizenCommands.setAlignment('center'))
      commands.push(CitizenCommands.setBold(true))
      commands.push(CitizenCommands.setTextSize(2, 2))
      commands.push(CitizenCommands.textLine('CITIZEN PRINTER TEST'))
      commands.push(CitizenCommands.setTextSize(1, 1))
      commands.push(CitizenCommands.setBold(false))
      
      commands.push(CitizenCommands.separator('=', this.getPaperWidth()))
      commands.push(CitizenCommands.textLine(`Model: ${this.driverConfig.printer.model}`))
      commands.push(CitizenCommands.textLine(`Series: ${this.driverConfig.printer.series}`))
      commands.push(CitizenCommands.textLine(`Paper: ${this.driverConfig.printer.paperWidth}mm`))
      
      // 測試 Citizen 特有功能
      if (this.driverConfig.printer.presenter) {
        commands.push(CitizenCommands.textLine('Presenter: Supported'))
      }
      
      commands.push(CitizenCommands.separator('=', this.getPaperWidth()))
      commands.push(CitizenCommands.setAlignment('center'))
      commands.push(CitizenCommands.textLine('Test completed'))
      commands.push(CitizenCommands.lineFeed(3))

      const testCommands = Buffer.concat(commands)
      return await this.print(testCommands)
    } catch (error) {
      console.error(`Citizen printer test failed on ${this.device.id}:`, error)
      return false
    }
  }

  getSeries(): string {
    return this.driverConfig.printer.series
  }

  hasPresenter(): boolean {
    return this.driverConfig.printer.presenter
  }

  async getMemoryStatus(): Promise<any> {
    try {
      const memoryCommand = CitizenCommands.getMemoryStatus()
      await this.sendRawData(memoryCommand)
      // 實際實作中會解析記憶體狀態回應
      return { available: true, used: 0, total: 0 }
    } catch (error) {
      console.error('Failed to get memory status:', error)
      return null
    }
  }
}