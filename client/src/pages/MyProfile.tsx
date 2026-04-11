import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import toast from 'react-hot-toast'

// Fix leaflet default marker icons (broken in Vite builds)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface LatLng { lat: number; lng: number }
interface NominatimResult { place_id: number; display_name: string; lat: string; lon: string }

// Reverse-geocode a coordinate to a human-readable address
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Search addresses by text
async function searchAddress(query: string): Promise<NominatimResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  return res.json()
}

// Moves the map view when the center prop changes
function MapFlyTo({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([center.lat, center.lng], zoom, { duration: 1 }) }, [center.lat, center.lng])
  return null
}

// Lets user tap the map to set a marker
function LocationPicker({ position, onChange }: { position: LatLng | null; onChange: (p: LatLng) => void }) {
  useMapEvents({ click(e) { onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) } })
  return position ? <Marker position={[position.lat, position.lng]} /> : null
}

export default function MyProfile() {
  const { user } = useAuth()
  const { fullName, phone, plateNumber, homeLat, homeLng, homeAddress, roleLoading } = useRole()

  const [name, setName] = useState('')
  const [phoneVal, setPhoneVal] = useState('')
  const [plate, setPlate] = useState('')
  const [location, setLocation] = useState<LatLng | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Map fly-to target (separate from pinned location so we can fly without pinning)
  const [mapFocus, setMapFocus] = useState<LatLng>({ lat: 25.2048, lng: 55.2708 })
  const [mapZoom, setMapZoom] = useState(11)

  // Pre-fill form once role data loads
  useEffect(() => {
    if (roleLoading) return
    setName(fullName || '')
    setPhoneVal(phone || '')
    setPlate(plateNumber || '')
    if (homeLat && homeLng) {
      const loc = { lat: homeLat, lng: homeLng }
      setLocation(loc)
      setMapFocus(loc)
      setMapZoom(15)
      if (homeAddress) setAddress(homeAddress)
      else reverseGeocode(homeLat, homeLng).then(setAddress)
    }
  }, [roleLoading])

  // Reverse-geocode whenever location changes
  const handleLocationChange = useCallback(async (loc: LatLng) => {
    setLocation(loc)
    setMapFocus(loc)
    setMapZoom(16)
    setAddress('Looking up address…')
    try {
      const addr = await reverseGeocode(loc.lat, loc.lng)
      setAddress(addr)
    } catch {
      setAddress(`${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`)
    }
  }, [])

  // Debounced address search
  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    setSearchResults([])
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (val.trim().length < 3) return
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchAddress(val)
        setSearchResults(results)
      } catch { /* ignore */ }
      setSearching(false)
    }, 500)
  }

  const handleSearchSelect = (result: NominatimResult) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) }
    setLocation(loc)
    setMapFocus(loc)
    setMapZoom(16)
    setAddress(result.display_name)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleGPS = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
      },
      () => { toast.error('Could not get your location'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await api.patch(`/api/users/profile/${user.id}`, {
        full_name: name.trim() || undefined,
        phone: phoneVal.trim() || undefined,
        plate_number: plate.trim() || undefined,
        home_lat: location?.lat ?? null,
        home_lng: location?.lng ?? null,
        home_address: address ?? null,
      })
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-sheen-cream overflow-x-hidden">
      <TopBar title="My Profile" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Personal info */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-sheen-black">Personal Info</h2>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
          </div>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">Phone Number</label>
            <input type="tel" value={phoneVal} onChange={e => setPhoneVal(e.target.value)} placeholder="e.g. 0501234567"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
          </div>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">UAE Plate Number</label>
            <input type="text" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="e.g. A 12345"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold uppercase tracking-widest" />
          </div>
        </div>

        {/* Home location */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-sheen-black">Home Location</h2>
            <button onClick={handleGPS} disabled={gpsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sheen-cream text-sheen-brown text-xs font-body font-medium hover:bg-sheen-gold/10 transition-colors disabled:opacity-50">
              {gpsLoading
                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              }
              Use my location
            </button>
          </div>

          {/* Address search */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-sheen-muted/30 bg-sheen-cream">
              <svg className="w-4 h-4 text-sheen-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder="Search for an address…"
                className="flex-1 bg-transparent font-body text-sm focus:outline-none text-sheen-black placeholder:text-sheen-muted"
              />
              {searching && <svg className="w-3.5 h-3.5 animate-spin text-sheen-muted shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[1000] mt-1 bg-white rounded-lg shadow-lg border border-sheen-muted/20 max-h-48 overflow-y-auto">
                {searchResults.map(r => (
                  <button key={r.place_id} onClick={() => handleSearchSelect(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-sheen-cream transition-colors border-b border-sheen-muted/10 last:border-0">
                    <p className="font-body text-xs text-sheen-black leading-snug line-clamp-2">{r.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="font-body text-xs text-sheen-muted">Or tap anywhere on the map to pin your home.</p>

          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-sheen-muted/20" style={{ height: 280 }}>
            <MapContainer center={[mapFocus.lat, mapFocus.lng]} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFlyTo center={mapFocus} zoom={mapZoom} />
              <LocationPicker position={location} onChange={handleLocationChange} />
            </MapContainer>
          </div>

          {/* Address display */}
          {address && (
            <div className="flex items-start justify-between gap-2">
              <p className="font-body text-xs text-sheen-black leading-snug flex-1">
                <span className="text-sheen-gold mr-1">📍</span>{address}
              </p>
              <button onClick={() => { setLocation(null); setAddress(null) }}
                className="text-xs font-body text-red-400 hover:text-red-600 shrink-0">
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl bg-sheen-brown text-white font-body font-semibold text-sm hover:bg-sheen-brown/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </main>
    </div>
  )
}
