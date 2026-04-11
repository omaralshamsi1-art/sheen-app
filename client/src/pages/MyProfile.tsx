import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
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

// Inner component: lets user click the map to move the marker
function LocationPicker({ position, onChange }: { position: LatLng | null; onChange: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return position ? <Marker position={[position.lat, position.lng]} /> : null
}

export default function MyProfile() {
  const { user } = useAuth()
  const { fullName, phone, plateNumber, homeLat, homeLng, roleLoading } = useRole()

  const [name, setName] = useState('')
  const [phoneVal, setPhoneVal] = useState('')
  const [plate, setPlate] = useState('')
  const [location, setLocation] = useState<LatLng | null>(null)
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  // Pre-fill form once role data loads
  useEffect(() => {
    if (roleLoading) return
    setName(fullName || '')
    setPhoneVal(phone || '')
    setPlate(plateNumber || '')
    if (homeLat && homeLng) setLocation({ lat: homeLat, lng: homeLng })
  }, [roleLoading])

  const handleGPS = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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
      })
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    }
    setSaving(false)
  }

  // Default map center: Dubai if no location set
  const mapCenter: LatLng = location ?? { lat: 25.2048, lng: 55.2708 }

  return (
    <div className="min-h-screen bg-sheen-cream overflow-x-hidden">
      <TopBar title="My Profile" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Profile fields */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-sheen-black">Personal Info</h2>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
          </div>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">Phone Number</label>
            <input
              type="tel"
              value={phoneVal}
              onChange={e => setPhoneVal(e.target.value)}
              placeholder="e.g. 0501234567"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
          </div>

          <div>
            <label className="block font-body text-xs text-sheen-muted mb-1">UAE Plate Number</label>
            <input
              type="text"
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="e.g. A 12345"
              className="w-full px-3 py-2.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold uppercase tracking-widest"
            />
          </div>
        </div>

        {/* Home location */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-sheen-black">Home Location</h2>
            <button
              onClick={handleGPS}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sheen-cream text-sheen-brown text-xs font-body font-medium hover:bg-sheen-gold/10 transition-colors disabled:opacity-50"
            >
              {gpsLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              )}
              Use my location
            </button>
          </div>

          <p className="font-body text-xs text-sheen-muted">
            Tap anywhere on the map to pin your home, or use the GPS button.
          </p>

          <div className="rounded-xl overflow-hidden border border-sheen-muted/20" style={{ height: 280 }}>
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={location ? 15 : 11}
              style={{ height: '100%', width: '100%' }}
              key={`${mapCenter.lat},${mapCenter.lng}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationPicker position={location} onChange={setLocation} />
            </MapContainer>
          </div>

          {location && (
            <div className="flex items-center justify-between">
              <p className="font-body text-xs text-sheen-muted">
                📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>
              <button
                onClick={() => setLocation(null)}
                className="text-xs font-body text-red-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-sheen-brown text-white font-body font-semibold text-sm hover:bg-sheen-brown/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </main>
    </div>
  )
}
