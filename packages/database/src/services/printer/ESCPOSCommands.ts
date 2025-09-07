/**
 * ESC/POS 命令生成器
 * 支援標準 ESC/POS 打印機命令集
 */

export class ESCPOSCommands {
  // 基本控制命令
  static readonly ESC = 0x1B
  static readonly GS = 0x1D
  static readonly FS = 0x1C
  static readonly LF = 0x0A
  static readonly CR = 0x0D
  static readonly HT = 0x09

  // =============================================
  // 基礎命令
  // =============================================

  // 初始化打印機
  static initialize(): Buffer {
    return Buffer.from([this.ESC, 0x40])
  }

  // 重置設置
  static reset(): Buffer {
    return Buffer.from([this.ESC, 0x40])
  }

  // 換行
  static lineFeed(lines = 1): Buffer {
    return Buffer.from(Array(lines).fill(this.LF))
  }

  // 切紙
  static cutPaper(mode: 'full' | 'partial' = 'full'): Buffer {
    return mode === 'full' 
      ? Buffer.from([this.GS, 0x56, 0x00]) // 全切
      : Buffer.from([this.GS, 0x56, 0x01]) // 半切
  }

  // 開啟收銀櫃
  static openDrawer(connector = 0, pulseLength = 60): Buffer {
    // connector: 0 = pin 2, 1 = pin 5
    return Buffer.from([this.ESC, 0x70, connector, pulseLength, pulseLength])
  }

  // 蜂鳴器
  static buzzer(times = 1, duration = 3): Buffer {
    return Buffer.from([this.ESC, 0x42, times, duration])
  }

  // =============================================
  // 文字格式化
  // =============================================

  // 設定對齊方式
  static setAlignment(alignment: 'left' | 'center' | 'right'): Buffer {
    const alignValue = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2
    return Buffer.from([this.ESC, 0x61, alignValue])
  }

  // 設定文字大小
  static setTextSize(width: number, height: number): Buffer {
    // width, height: 1-8 倍
    const size = ((width - 1) << 4) | (height - 1)
    return Buffer.from([this.GS, 0x21, size])
  }

  // 粗體開關
  static setBold(enable: boolean): Buffer {
    return Buffer.from([this.ESC, 0x45, enable ? 1 : 0])
  }

  // 底線開關
  static setUnderline(mode: 'none' | 'single' | 'double' = 'none'): Buffer {
    const underlineValue = mode === 'none' ? 0 : mode === 'single' ? 1 : 2
    return Buffer.from([this.ESC, 0x2D, underlineValue])
  }

  // 反白開關
  static setInvert(enable: boolean): Buffer {
    return Buffer.from([this.GS, 0x42, enable ? 1 : 0])
  }

  // 字元間距
  static setCharacterSpacing(spacing: number): Buffer {
    return Buffer.from([this.ESC, 0x20, spacing])
  }

  // 行間距
  static setLineSpacing(spacing: number): Buffer {
    return Buffer.from([this.ESC, 0x33, spacing])
  }

  // =============================================
  // 文字輸出
  // =============================================

  // 輸出文字
  static text(text: string, encoding = 'utf8'): Buffer {
    return Buffer.from(text, encoding as BufferEncoding)
  }

  // 輸出一行文字並換行
  static textLine(text: string, encoding = 'utf8'): Buffer {
    return Buffer.concat([
      this.text(text, encoding),
      this.lineFeed()
    ])
  }

  // 製作分隔線
  static separator(char = '-', width = 32): Buffer {
    return this.textLine(char.repeat(width))
  }

  // 左右對齊文字 (適合價格顯示)
  static textColumns(left: string, right: string, totalWidth = 32): Buffer {
    const leftWidth = Buffer.from(left, 'utf8').length
    const rightWidth = Buffer.from(right, 'utf8').length
    const spacesNeeded = Math.max(0, totalWidth - leftWidth - rightWidth)
    
    return this.textLine(left + ' '.repeat(spacesNeeded) + right)
  }

  // 三欄對齊文字
  static textThreeColumns(left: string, center: string, right: string, totalWidth = 32): Buffer {
    const leftLen = Buffer.from(left, 'utf8').length
    const centerLen = Buffer.from(center, 'utf8').length
    const rightLen = Buffer.from(right, 'utf8').length
    
    const totalContentLen = leftLen + centerLen + rightLen
    const spacesAvailable = totalWidth - totalContentLen
    const spacesLeft = Math.floor(spacesAvailable / 2)
    const spacesRight = spacesAvailable - spacesLeft
    
    return this.textLine(left + ' '.repeat(spacesLeft) + center + ' '.repeat(spacesRight) + right)
  }

  // =============================================
  // 圖形和條碼
  // =============================================

  // 列印 QR Code
  static qrCode(data: string, size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 3, errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M'): Buffer {
    const dataBytes = Buffer.from(data, 'utf8')
    const commands: Buffer[] = []
    
    // QR Code 模型
    commands.push(Buffer.from([this.GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]))
    
    // QR Code 大小
    commands.push(Buffer.from([this.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size]))
    
    // 錯誤修正等級
    const ecLevel = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 }[errorCorrection]
    commands.push(Buffer.from([this.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, ecLevel]))
    
    // 資料
    const dataLength = dataBytes.length + 3
    const lengthBytes = [(dataLength) & 0xFF, (dataLength >> 8) & 0xFF]
    commands.push(Buffer.from([this.GS, 0x28, 0x6B, lengthBytes[0], lengthBytes[1], 0x31, 0x50, 0x30, ...dataBytes]))
    
    // 列印
    commands.push(Buffer.from([this.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]))
    
    return Buffer.concat(commands)
  }

  // 列印 Code 128 條碼
  static barcode128(data: string, height = 50, width: 1 | 2 | 3 | 4 | 5 | 6 = 2, showText: boolean = true): Buffer {
    const commands: Buffer[] = []
    
    // 設定條碼高度
    commands.push(Buffer.from([this.GS, 0x68, height]))
    
    // 設定條碼寬度
    commands.push(Buffer.from([this.GS, 0x77, width]))
    
    // 設定 HRI (可讀文字) 位置
    commands.push(Buffer.from([this.GS, 0x48, showText ? 2 : 0])) // 2 = 下方顯示
    
    // 列印條碼
    const dataBytes = Buffer.from(data, 'ascii')
    commands.push(Buffer.from([this.GS, 0x6B, 0x49, dataBytes.length, ...dataBytes]))
    
    return Buffer.concat(commands)
  }

  // 簡單點陣圖列印 (黑白)
  static printImage(imageData: boolean[][], alignment: 'left' | 'center' | 'right' = 'left'): Buffer {
    const commands: Buffer[] = []
    
    // 設定對齊
    commands.push(this.setAlignment(alignment))
    
    const height = imageData.length
    const width = imageData[0]?.length || 0
    const bytesPerLine = Math.ceil(width / 8)
    
    // ESC * 模式
    commands.push(Buffer.from([this.ESC, 0x2A, 0x00, bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF]))
    
    // 轉換像素數據為字節
    for (let y = 0; y < height; y++) {
      const lineData: number[] = []
      for (let x = 0; x < bytesPerLine; x++) {
        let byte = 0
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = x * 8 + bit
          if (pixelX < width && imageData[y][pixelX]) {
            byte |= (1 << (7 - bit))
          }
        }
        lineData.push(byte)
      }
      commands.push(Buffer.from(lineData))
      commands.push(this.lineFeed())
    }
    
    return Buffer.concat(commands)
  }

  // =============================================
  // 複合功能
  // =============================================

  // 列印標題
  static printTitle(title: string, width = 32): Buffer {
    const commands: Buffer[] = []
    
    commands.push(this.setAlignment('center'))
    commands.push(this.setBold(true))
    commands.push(this.setTextSize(2, 2))
    commands.push(this.textLine(title))
    commands.push(this.setTextSize(1, 1))
    commands.push(this.setBold(false))
    commands.push(this.setAlignment('left'))
    commands.push(this.lineFeed())
    
    return Buffer.concat(commands)
  }

  // 列印小計行
  static printSubtotal(label: string, amount: string, width = 32): Buffer {
    return this.textColumns(label, amount, width)
  }

  // 列印總計行
  static printTotal(label: string, amount: string, width = 32): Buffer {
    const commands: Buffer[] = []
    
    commands.push(this.setBold(true))
    commands.push(this.setTextSize(1, 2))
    commands.push(this.textColumns(label, amount, width))
    commands.push(this.setTextSize(1, 1))
    commands.push(this.setBold(false))
    
    return Buffer.concat(commands)
  }

  // 列印表格行
  static printTableRow(columns: string[], widths: number[]): Buffer {
    let row = ''
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i] || ''
      const width = widths[i] || 0
      const colBytes = Buffer.from(col, 'utf8')
      
      if (colBytes.length > width) {
        // 截斷過長文字
        row += col.substring(0, width)
      } else {
        // 補齊空格
        row += col + ' '.repeat(width - colBytes.length)
      }
    }
    
    return this.textLine(row)
  }

  // =============================================
  // 測試和診斷
  // =============================================

  // 列印測試頁
  static printTestPage(): Buffer {
    const commands: Buffer[] = []
    
    commands.push(this.initialize())
    commands.push(this.printTitle('TEST PAGE', 32))
    commands.push(this.separator('=', 32))
    
    // 字體測試
    commands.push(this.textLine('Normal Text'))
    commands.push(this.setBold(true))
    commands.push(this.textLine('Bold Text'))
    commands.push(this.setBold(false))
    commands.push(this.setUnderline('single'))
    commands.push(this.textLine('Underlined Text'))
    commands.push(this.setUnderline('none'))
    
    // 對齊測試
    commands.push(this.separator('-', 32))
    commands.push(this.setAlignment('left'))
    commands.push(this.textLine('Left Aligned'))
    commands.push(this.setAlignment('center'))
    commands.push(this.textLine('Center Aligned'))
    commands.push(this.setAlignment('right'))
    commands.push(this.textLine('Right Aligned'))
    commands.push(this.setAlignment('left'))
    
    // 大小測試
    commands.push(this.separator('-', 32))
    commands.push(this.setTextSize(2, 1))
    commands.push(this.textLine('Wide Text'))
    commands.push(this.setTextSize(1, 2))
    commands.push(this.textLine('Tall Text'))
    commands.push(this.setTextSize(2, 2))
    commands.push(this.textLine('Big Text'))
    commands.push(this.setTextSize(1, 1))
    
    // 列印完成
    commands.push(this.separator('=', 32))
    commands.push(this.textLine('Test completed'))
    commands.push(this.lineFeed(3))
    commands.push(this.cutPaper())
    
    return Buffer.concat(commands)
  }

  // 狀態查詢
  static getStatus(): Buffer {
    return Buffer.from([this.GS, 0x61, 0xFF])
  }

  // 查詢紙張狀態
  static getPaperStatus(): Buffer {
    return Buffer.from([this.GS, 0x72, 0x01])
  }
}