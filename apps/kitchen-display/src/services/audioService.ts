import { Howl } from 'howler'

// Audio file paths (these would be actual audio files in production)
const SOUND_PATHS = {
  newOrder: '/sounds/new-order.mp3',
  orderReady: '/sounds/order-ready.mp3',
  orderUrgent: '/sounds/order-urgent.mp3',
  orderComplete: '/sounds/order-complete.mp3',
  warning: '/sounds/warning.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  notification: '/sounds/notification.mp3',
  bell: '/sounds/bell.mp3',
  chime: '/sounds/chime.mp3'
}

// Sound categories for easy management
export type SoundType = keyof typeof SOUND_PATHS

export interface AudioNotification {
  id: string
  type: SoundType
  volume: number
  repeat: number
  delay: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export interface AudioSettings {
  masterVolume: number
  enabled: boolean
  sounds: {
    [key in SoundType]: {
      enabled: boolean
      volume: number
      sound?: string
    }
  }
  notificationQueue: boolean
  maxQueueSize: number
  priorityOverride: boolean
}

class AudioService {
  private sounds: Map<SoundType, Howl> = new Map()
  private settings: AudioSettings
  private notificationQueue: AudioNotification[] = []
  private isPlaying = false
  private initialized = false

  constructor() {
    this.settings = this.loadSettings()
    this.initializeSounds()
  }

  private loadSettings(): AudioSettings {
    const saved = localStorage.getItem('kitchen-audio-settings')
    if (saved) {
      return { ...this.getDefaultSettings(), ...JSON.parse(saved) }
    }
    return this.getDefaultSettings()
  }

  private getDefaultSettings(): AudioSettings {
    return {
      masterVolume: 0.7,
      enabled: true,
      sounds: {
        newOrder: { enabled: true, volume: 0.8 },
        orderReady: { enabled: true, volume: 0.9 },
        orderUrgent: { enabled: true, volume: 1.0 },
        orderComplete: { enabled: true, volume: 0.6 },
        warning: { enabled: true, volume: 0.8 },
        success: { enabled: true, volume: 0.5 },
        error: { enabled: true, volume: 0.9 },
        notification: { enabled: true, volume: 0.6 },
        bell: { enabled: true, volume: 0.7 },
        chime: { enabled: true, volume: 0.5 }
      },
      notificationQueue: true,
      maxQueueSize: 10,
      priorityOverride: true
    }
  }

  private initializeSounds() {
    // Initialize Howl instances for each sound type
    Object.entries(SOUND_PATHS).forEach(([type, path]) => {
      const soundType = type as SoundType
      
      // For demo purposes, we'll use the Web Audio API to generate sounds
      // In production, you would load actual audio files
      const sound = new Howl({
        src: [this.generateToneDataURL(this.getToneFrequency(soundType))],
        volume: this.settings.sounds[soundType].volume * this.settings.masterVolume,
        format: ['mp3', 'wav'],
        html5: true,
        preload: true,
        onload: () => {
          console.log(`Audio loaded: ${type}`)
        },
        onloaderror: (id, error) => {
          console.warn(`Audio load error for ${type}:`, error)
          // Fallback to generated tone
          this.generateFallbackSound(soundType)
        }
      })
      
      this.sounds.set(soundType, sound)
    })
    
    this.initialized = true
  }

  private getToneFrequency(soundType: SoundType): number {
    // Different frequencies for different notification types
    const frequencies = {
      newOrder: 800,
      orderReady: 1000,
      orderUrgent: 1500,
      orderComplete: 600,
      warning: 1200,
      success: 750,
      error: 400,
      notification: 900,
      bell: 1100,
      chime: 850
    }
    return frequencies[soundType] || 800
  }

  private generateToneDataURL(frequency: number, duration = 0.5): string {
    const sampleRate = 44100
    const samples = Math.floor(sampleRate * duration)
    const buffer = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, samples * 2, true)
    
    // Generate tone
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
      const envelope = Math.exp(-i / (sampleRate * 0.3)) // Decay envelope
      view.setInt16(44 + i * 2, sample * envelope * 32767, true)
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' })
    return URL.createObjectURL(blob)
  }

  private generateFallbackSound(soundType: SoundType) {
    const frequency = this.getToneFrequency(soundType)
    const dataURL = this.generateToneDataURL(frequency)
    
    const sound = new Howl({
      src: [dataURL],
      volume: this.settings.sounds[soundType].volume * this.settings.masterVolume,
      html5: true
    })
    
    this.sounds.set(soundType, sound)
  }

  // Public methods
  public play(
    type: SoundType, 
    options: Partial<AudioNotification> = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.initialized || !this.settings.enabled) {
        resolve()
        return
      }

      const soundSettings = this.settings.sounds[type]
      if (!soundSettings.enabled) {
        resolve()
        return
      }

      const notification: AudioNotification = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        volume: soundSettings.volume,
        repeat: 1,
        delay: 0,
        priority: 'medium',
        ...options
      }

      if (this.settings.notificationQueue && this.isPlaying) {
        this.addToQueue(notification)
        resolve()
        return
      }

      this.playNotification(notification)
        .then(() => resolve())
        .catch(reject)
    })
  }

  private async playNotification(notification: AudioNotification): Promise<void> {
    const sound = this.sounds.get(notification.type)
    if (!sound) {
      throw new Error(`Sound not found: ${notification.type}`)
    }

    this.isPlaying = true
    
    return new Promise((resolve, reject) => {
      // Apply volume settings
      sound.volume(notification.volume * this.settings.masterVolume)
      
      // Add delay if specified
      setTimeout(() => {
        let playCount = 0
        const maxPlays = notification.repeat
        
        const playNext = () => {
          if (playCount >= maxPlays) {
            this.isPlaying = false
            this.processQueue()
            resolve()
            return
          }
          
          playCount++
          sound.play()
          
          // If we need to repeat, wait for the sound to finish
          if (playCount < maxPlays) {
            sound.once('end', () => {
              setTimeout(playNext, 200) // Small gap between repeats
            })
          } else {
            sound.once('end', () => {
              this.isPlaying = false
              this.processQueue()
              resolve()
            })
          }
        }
        
        sound.once('loaderror', reject)
        sound.once('playerror', reject)
        playNext()
        
      }, notification.delay)
    })
  }

  private addToQueue(notification: AudioNotification) {
    // Remove oldest notifications if queue is full
    while (this.notificationQueue.length >= this.settings.maxQueueSize) {
      this.notificationQueue.shift()
    }
    
    // Insert based on priority
    const priorities = { low: 1, medium: 2, high: 3, urgent: 4 }
    const notificationPriority = priorities[notification.priority]
    
    let insertIndex = this.notificationQueue.length
    
    if (this.settings.priorityOverride) {
      for (let i = 0; i < this.notificationQueue.length; i++) {
        if (priorities[this.notificationQueue[i].priority] < notificationPriority) {
          insertIndex = i
          break
        }
      }
    }
    
    this.notificationQueue.splice(insertIndex, 0, notification)
  }

  private async processQueue() {
    if (this.notificationQueue.length === 0 || this.isPlaying) {
      return
    }
    
    const next = this.notificationQueue.shift()!
    await this.playNotification(next)
  }

  // Convenience methods for common notifications
  public playNewOrder(urgent = false): Promise<void> {
    return this.play(urgent ? 'orderUrgent' : 'newOrder', {
      priority: urgent ? 'urgent' : 'high',
      repeat: urgent ? 3 : 1
    })
  }

  public playOrderReady(): Promise<void> {
    return this.play('orderReady', {
      priority: 'high',
      repeat: 2
    })
  }

  public playOrderComplete(): Promise<void> {
    return this.play('orderComplete', {
      priority: 'medium'
    })
  }

  public playWarning(): Promise<void> {
    return this.play('warning', {
      priority: 'high',
      repeat: 2
    })
  }

  public playSuccess(): Promise<void> {
    return this.play('success')
  }

  public playError(): Promise<void> {
    return this.play('error', {
      priority: 'urgent',
      repeat: 2
    })
  }

  // Settings management
  public updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettings()
    this.updateSoundVolumes()
  }

  private saveSettings() {
    localStorage.setItem('kitchen-audio-settings', JSON.stringify(this.settings))
  }

  private updateSoundVolumes() {
    this.sounds.forEach((sound, type) => {
      const soundSettings = this.settings.sounds[type]
      sound.volume(soundSettings.volume * this.settings.masterVolume)
    })
  }

  public getSettings(): AudioSettings {
    return { ...this.settings }
  }

  // Control methods
  public enable() {
    this.settings.enabled = true
    this.saveSettings()
  }

  public disable() {
    this.settings.enabled = false
    this.stopAll()
    this.saveSettings()
  }

  public setMasterVolume(volume: number) {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume))
    this.updateSoundVolumes()
    this.saveSettings()
  }

  public stopAll() {
    this.sounds.forEach(sound => sound.stop())
    this.notificationQueue.length = 0
    this.isPlaying = false
  }

  // Testing methods
  public testSound(type: SoundType): Promise<void> {
    return this.play(type, { priority: 'urgent' })
  }

  public testAllSounds(): Promise<void> {
    return new Promise(async (resolve) => {
      for (const [type] of this.sounds) {
        await this.testSound(type)
        await new Promise(r => setTimeout(r, 500)) // Wait between tests
      }
      resolve()
    })
  }
}

// Create and export singleton instance
export const audioService = new AudioService()
export default audioService