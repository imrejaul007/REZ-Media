/**
 * DOOH - Digital Out of Home Advertising Network
 * Screen management, ad delivery, and playlist generation
 */

// Re-export types
export * from './types'

// Re-export services
export { createPlaylistGenerator } from './services/playlist.service'
export { createDeliveryEngine, createRevenueCalculator } from './services/delivery.service'
export { createScreenManager } from './services/screen.service'

/**
 * DOOH Network - Screen delivery layer for AdOS
 */
export class DOOHNetwork {
  private deliveryEngine: any
  private playlistGenerator: any
  private screenManager: any

  constructor() {
    const { createDeliveryEngine } = require('./services/delivery.service')
    const { createPlaylistGenerator } = require('./services/playlist.service')
    const { createScreenManager } = require('./services/screen.service')

    this.deliveryEngine = createDeliveryEngine()
    this.playlistGenerator = createPlaylistGenerator()
    this.screenManager = createScreenManager()
  }

  getAdsForScreen(screenId: string, campaigns: any[]) {
    const screen = this.screenManager.get(screenId)
    if (!screen) throw new Error('Screen not found')

    const request = {
      screen_id: screenId,
      available_slots: 10,
      context: this.buildContext()
    }

    return this.deliveryEngine.getAdsForScreen(request, screen, campaigns)
  }

  generatePlaylist(screenId: string, campaigns: any[]) {
    const screen = this.screenManager.get(screenId)
    if (!screen) throw new Error('Screen not found')

    return this.playlistGenerator.generatePlaylist({
      screen_id: screenId,
      date: new Date(),
      duration: 3600,
      time_slots: [{ start: '09:00', end: '22:00', slot_type: 'standard' }]
    }, screen, campaigns)
  }

  getStats() {
    return this.screenManager.getStats()
  }

  private buildContext() {
    const isWeekend = [0, 6].includes(new Date().getDay())
    return {
      time: new Date().toISOString(),
      day_type: isWeekend ? 'weekend' : 'weekday',
      audience: {
        primary: [],
        peak_hours: [],
        avg_dwell_time: 300
      }
    }
  }
}

export function createDOOHNetwork(): DOOHNetwork {
  return new DOOHNetwork()
}
