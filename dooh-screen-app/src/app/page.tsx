'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Types
interface ScreenConfig {
  screenId: string
  screenName: string
  location: string
  type: 'flight_seatback' | 'flight_overhead' | 'flight_entrance' | 'flight_lavatory'
             | 'airport_display' | 'airport_gate' | 'airport_lounge' | 'airport_kiosk'
             | 'generic_display'
  context?: FlightContext | AirportContext
}

interface FlightContext {
  flight_number: string
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  cabin_class: 'economy' | 'business' | 'first'
  seat_range: string
}

interface AirportContext {
  terminal: string
  gate?: string
  lounge_name?: string
  passenger_flow: 'arrivals' | 'departures' | 'transit'
}

interface AdSlot {
  id: string
  campaign_id: string
  creative: {
    type: 'image' | 'video' | 'text' | 'interactive'
    url?: string
    content?: string
    duration: number
    target_audience?: string[]
  }
  position: number
}

interface Playlist {
  id: string
  screen_id: string
  slots: AdSlot[]
  version: number
  generated_at: string
  expires_at?: string
}

// Local storage for offline
const PLAYLIST_STORAGE_KEY = 'dooh_playlist'
const LAST_SYNC_KEY = 'dooh_last_sync'

export default function ScreenPage() {
  const [config, setConfig] = useState<ScreenConfig | null>(null)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [currentSlot, setCurrentSlot] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [flightInfo, setFlightInfo] = useState<FlightContext | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const playlistRef = useRef<NodeJS.Timeout | null>(null)

  const HEARTBEAT_INTERVAL = 60000 // 60 seconds
  const PLAYLIST_REFRESH_INTERVAL = 300000 // 5 minutes (30 min offline)
  const OFFLINE_BUFFER_HOURS = 24

  // Load playlist from local storage (offline support)
  const loadLocalPlaylist = useCallback((): Playlist | null => {
    try {
      const stored = localStorage.getItem(PLAYLIST_STORAGE_KEY)
      if (stored) {
        const parsed: Playlist = JSON.parse(stored)
        // Check if still valid
        if (parsed.expires_at && new Date(parsed.expires_at) > new Date()) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Failed to load local playlist:', e)
    }
    return null
  }, [])

  // Save playlist to local storage
  const saveLocalPlaylist = useCallback((pl: Playlist) => {
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(pl))
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    } catch (e) {
      console.error('Failed to save playlist:', e)
    }
  }, [])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize screen
  useEffect(() => {
    const initScreen = async () => {
      // Get config from env or flight API
      const screenId = process.env.NEXT_PUBLIC_SCREEN_ID || 'demo-screen-001'
      const screenType = (process.env.NEXT_PUBLIC_SCREEN_TYPE || 'generic_display') as ScreenConfig['type']
      const screenName = process.env.NEXT_PUBLIC_SCREEN_NAME || 'Demo Screen'
      const location = process.env.NEXT_PUBLIC_SCREEN_LOCATION || 'Demo Location'

      // For flight screens, get live flight info
      let flightContext: FlightContext | AirportContext | undefined

      if (screenType.startsWith('flight_')) {
        // Fetch flight info from seatback API
        try {
          const flightRes = await fetch('/api/flight-info')
          if (flightRes.ok) {
            const data = await flightRes.json()
            setFlightInfo(data)
            flightContext = data
          }
        } catch (e) {
          console.log('Using offline flight data')
        }
      }

      setConfig({
        screenId,
        screenName,
        location,
        type: screenType,
        context: flightContext,
      })

      // Load cached playlist for offline
      const localPlaylist = loadLocalPlaylist()
      if (localPlaylist) {
        setPlaylist(localPlaylist)
        setError(null)
      }

      setLoading(false)
    }

    initScreen()
  }, [loadLocalPlaylist])

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!config) return

    const payload = {
      screen_id: config.screenId,
      status: 'active',
      timestamp: new Date().toISOString(),
      playlist_version: playlist?.version || 0,
      is_online: navigator.onLine,
      context: config.context,
    }

    try {
      if (navigator.onLine) {
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Queue for later
        const queue = JSON.parse(localStorage.getItem('heartbeat_queue') || '[]')
        queue.push(payload)
        localStorage.setItem('heartbeat_queue', JSON.stringify(queue))
      }
    } catch (err) {
      console.error('Heartbeat failed:', err)
    }
  }, [config, playlist?.version])

  // Fetch playlist
  const fetchPlaylist = useCallback(async () => {
    if (!config) return

    try {
      const serverUrl = process.env.NEXT_PUBLIC_DOOH_SERVER || 'https://dooh.rezapp.com'

      if (navigator.onLine) {
        const res = await fetch(`${serverUrl}/api/screens/${config.screenId}/playlist`)

        if (res.ok) {
          const data: Playlist = await res.json()
          // Add expiry (24 hours from now)
          data.expires_at = new Date(Date.now() + OFFLINE_BUFFER_HOURS * 60 * 60 * 1000).toISOString()
          setPlaylist(data)
          saveLocalPlaylist(data)
          setError(null)
        } else {
          throw new Error('Failed to fetch')
        }
      } else {
        // Use cached playlist
        const local = loadLocalPlaylist()
        if (local) {
          setPlaylist(local)
        } else {
          setError('Offline - no cached playlist')
        }
      }
    } catch (err) {
      console.error('Playlist fetch failed:', err)
      const local = loadLocalPlaylist()
      if (local) {
        setPlaylist(local)
        setError('Using offline playlist')
      } else {
        setError('Server unreachable')
      }
    }
  }, [config, loadLocalPlaylist, saveLocalPlaylist])

  // Sync queued heartbeats when back online
  useEffect(() => {
    if (!isOnline || !navigator.onLine) return

    const queue = JSON.parse(localStorage.getItem('heartbeat_queue') || '[]')
    if (queue.length > 0) {
      fetch('/api/heartbeat/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heartbeats: queue }),
      }).then(() => {
        localStorage.setItem('heartbeat_queue', '[]')
      }).catch(console.error)
    }
  }, [isOnline])

  // Heartbeat loop
  useEffect(() => {
    if (!config) return

    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [config, sendHeartbeat])

  // Playlist refresh loop
  useEffect(() => {
    if (!config) return

    fetchPlaylist()
    playlistRef.current = setInterval(fetchPlaylist, PLAYLIST_REFRESH_INTERVAL)

    return () => {
      if (playlistRef.current) clearInterval(playlistRef.current)
    }
  }, [config, fetchPlaylist])

  // Ad rotation
  useEffect(() => {
    if (!playlist || playlist.slots.length === 0) return

    const currentAd = playlist.slots[currentSlot]
    const duration = currentAd?.creative.duration || 10

    const timer = setTimeout(() => {
      setCurrentSlot((prev) => (prev + 1) % playlist.slots.length)
    }, duration * 1000)

    return () => clearTimeout(timer)
  }, [currentSlot, playlist])

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#fff',
        fontSize: '24px',
      }}>
        Loading...
      </div>
    )
  }

  const currentAd = playlist?.slots[currentSlot]
  const isFlightScreen = config?.type?.startsWith('flight_')

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Flight info bar */}
      {isFlightScreen && flightInfo && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          zIndex: 100,
        }}>
          <div>
            <span style={{ fontWeight: 'bold', marginRight: '20px' }}>{flightInfo.airline}</span>
            <span>{flightInfo.flight_number}</span>
          </div>
          <div>
            <span style={{ marginRight: '10px' }}>{flightInfo.origin}</span>
            <span>→</span>
            <span style={{ marginLeft: '10px' }}>{flightInfo.destination}</span>
          </div>
          <div>
            {flightInfo.departure_time} - {flightInfo.arrival_time}
          </div>
        </div>
      )}

      {/* Status indicators */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
        {!isOnline && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '8px',
          }}>
            OFFLINE MODE
          </div>
        )}
        {error && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#f59e0b',
            color: '#000',
            borderRadius: '8px',
            fontSize: '12px',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Screen info */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: '#fff',
        fontSize: '12px',
        opacity: 0.5,
        zIndex: 50,
      }}>
        <div>{config?.screenName}</div>
        <div>{config?.location}</div>
        {playlist && <div>Playlist v{playlist.version}</div>}
      </div>

      {/* Ad content */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {currentAd ? (
          <>
            {currentAd.creative.type === 'image' && currentAd.creative.url && (
              <img
                src={currentAd.creative.url}
                alt="Ad"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
            {currentAd.creative.type === 'text' && (
              <div style={{ color: '#fff', fontSize: '48px', textAlign: 'center', padding: '40px' }}>
                {currentAd.creative.content}
              </div>
            )}
            {currentAd.creative.type === 'video' && currentAd.creative.url && (
              <video
                src={currentAd.creative.url}
                autoPlay
                muted
                loop={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
          </>
        ) : (
          <div style={{ color: '#fff', fontSize: '24px' }}>
            {isOnline ? 'Loading ads...' : 'Offline - No cached content'}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {currentAd && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '4px',
          backgroundColor: '#6366f1',
          animation: `shrink ${currentAd.creative.duration}s linear`,
          width: '100%',
        }}>
          <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
        </div>
      )}
    </div>
  )
}
