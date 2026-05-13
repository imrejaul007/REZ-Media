'use client'

import { useCallback, useRef, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { Listing } from '@/types'

interface Props {
  listings: Listing[]
  highlightedId?: string | null
  onMarkerClick?: (id: string) => void
}

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%', minHeight: '60vh', borderRadius: '12px' }

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // India center

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a1a' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  ],
}

export default function ListingsMap({ listings, highlightedId, onMarkerClick }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'adbazaar-google-maps',
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map

    // Fit bounds to all pins if any have coordinates
    const withCoords = listings.filter((l) => l.lat != null && l.lng != null)
    if (withCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      withCoords.forEach((l) => bounds.extend({ lat: l.lat!, lng: l.lng! }))
      map.fitBounds(bounds, 60)
    } else if (withCoords.length === 1) {
      map.setCenter({ lat: withCoords[0].lat!, lng: withCoords[0].lng! })
      map.setZoom(13)
    }
  }, [listings])

  const onUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  const handleMarkerClick = (listing: Listing) => {
    setSelectedListing(listing)
    onMarkerClick?.(listing.id)
    if (listing.lat != null && listing.lng != null) {
      mapRef.current?.panTo({ lat: listing.lat, lng: listing.lng })
    }
  }

  const listingsWithCoords = listings.filter((l) => l.lat != null && l.lng != null)

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ minHeight: '60vh' }}>
        <span className="text-5xl">🗺</span>
        <p className="font-semibold text-white">Map View</p>
        <p className="text-sm text-center max-w-xs" style={{ color: '#737373' }}>
          Set <code className="px-1 rounded" style={{ backgroundColor: '#2a2a2a', color: '#f59e0b' }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable map discovery.
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2" style={{ minHeight: '60vh' }}>
        <span className="text-4xl">⚠️</span>
        <p className="text-sm" style={{ color: '#ef4444' }}>Failed to load Google Maps</p>
        <p className="text-xs" style={{ color: '#737373' }}>Check your API key and network</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm" style={{ color: '#737373' }}>Loading map…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full" style={{ minHeight: '60vh' }}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={5}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {listingsWithCoords.map((listing) => (
          <Marker
            key={listing.id}
            position={{ lat: listing.lat!, lng: listing.lng! }}
            onClick={() => handleMarkerClick(listing)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: highlightedId === listing.id ? 10 : 7,
              fillColor: highlightedId === listing.id ? '#f59e0b' : '#ffffff',
              fillOpacity: 1,
              strokeColor: '#f59e0b',
              strokeWeight: 2,
            }}
          />
        ))}

        {selectedListing && selectedListing.lat != null && selectedListing.lng != null && (
          <InfoWindow
            position={{ lat: selectedListing.lat, lng: selectedListing.lng }}
            onCloseClick={() => setSelectedListing(null)}
          >
            <div style={{ maxWidth: 200, backgroundColor: '#1a1a1a', padding: 8, borderRadius: 8 }}>
              <p style={{ fontWeight: 600, fontSize: 13, color: '#fff', marginBottom: 4 }}>
                {selectedListing.title}
              </p>
              <p style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 4 }}>
                {selectedListing.city}{selectedListing.area ? `, ${selectedListing.area}` : ''}
              </p>
              {selectedListing.price != null && (
                <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                  ₹{selectedListing.price.toLocaleString('en-IN')}
                </p>
              )}
              <a
                href={`/listing/${selectedListing.id}`}
                style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#f59e0b', textDecoration: 'underline' }}
              >
                View listing →
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Pin count badge */}
      <div
        className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#f59e0b', backdropFilter: 'blur(4px)' }}
      >
        {listingsWithCoords.length} / {listings.length} on map
      </div>
    </div>
  )
}
