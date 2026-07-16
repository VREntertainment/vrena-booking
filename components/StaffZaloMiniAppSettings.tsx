'use client'

import { Check, Copy, LocateFixed, MapPin, Plus, Save, Share2, Trash2, X } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

const ZALO_MINI_APP_URL = 'https://zalo.me/s/2952410270374662395/'

type Language = 'en' | 'vi'

type ZaloSettings = {
  enabled: boolean
  require_location: boolean
  allow_timesheet: boolean
  allow_payslip: boolean
}

type CheckInLocation = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  active: boolean
}

type LocationDraft = {
  name: string
  address: string
  latitude: string
  longitude: string
  radius_meters: string
}

type Props = {
  language: Language
  onStatus: (message: string) => void
}

const defaultSettings: ZaloSettings = {
  enabled: true,
  require_location: true,
  allow_timesheet: true,
  allow_payslip: false,
}

const defaultLocation = (): LocationDraft => ({
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  radius_meters: '30',
})

const copy = {
  en: {
    title: 'Employee settings',
    subtitle: 'Control how employees use the Zalo Mini App for attendance.',
    appTitle: 'Zalo Mini App',
    appDescription: 'Employees can clock in and out, view their timesheet, and access enabled HR features.',
    enabled: 'Enable employee Mini App',
    enabledHelp: 'Turning this off blocks linking, attendance, and employee access.',
    locations: 'Check-in locations',
    locationsHelp: 'Clock-in and clock-out are accepted only inside an active workplace radius.',
    addresses: (count: number) => `${count} ${count === 1 ? 'location' : 'locations'}`,
    share: 'Share access link',
    shareHelp: 'Employees open the same link in Zalo, verify their phone number, and link to their HR profile.',
    shareButton: 'Share access link',
    copied: 'Mini App access link copied.',
    shared: 'Mini App access link shared.',
    permissions: 'Permissions',
    permissionsHelp: 'Select the features employees are allowed to use.',
    timesheet: 'Timesheet',
    timesheetHelp: 'View personal attendance information',
    payslip: 'Payroll',
    payslipHelp: 'Coming soon — employee payroll view is not available yet',
    locationRequired: 'Require workplace location for clock actions',
    locationRequiredHelp: 'Uses a fresh Zalo GPS location at clock-in and clock-out. Wi-Fi is not used.',
    addLocation: 'Add check-in location',
    name: 'Location name',
    address: 'Address or directions',
    latitude: 'Latitude',
    longitude: 'Longitude',
    radius: 'Allowed radius (metres)',
    useDevice: 'Use this device location',
    saveLocation: 'Save location',
    cancel: 'Cancel',
    active: 'Active',
    inactive: 'Inactive',
    remove: 'Remove',
    loading: 'Loading Zalo Mini App settings…',
    noLocations: 'No workplace is configured. Add at least one active location before requiring location.',
    locationCaptured: 'Current coordinates captured. Confirm the location name and save.',
    locationDenied: 'Location could not be read. Allow browser location access or enter coordinates manually.',
    invalidLocation: 'Enter a name, valid coordinates, and a radius from 10 to 500 metres.',
    settingsSaved: 'Zalo Mini App settings saved.',
    locationSaved: 'Check-in location saved.',
    locationRemoved: 'Check-in location removed.',
    loadFailed: 'Zalo Mini App settings could not be loaded.',
    saveFailed: 'The Zalo Mini App settings could not be saved.',
    appId: 'Mini App ID 2952410270374662395',
  },
  vi: {
    title: 'Thiết lập nhân viên',
    subtitle: 'Quản lý cách nhân viên sử dụng Zalo Mini App để chấm công.',
    appTitle: 'Zalo Mini App',
    appDescription: 'Nhân viên có thể chấm công, xem bảng công và sử dụng các tính năng HR được cho phép.',
    enabled: 'Bật Mini App cho nhân viên',
    enabledHelp: 'Tắt mục này sẽ chặn liên kết, chấm công và quyền truy cập của nhân viên.',
    locations: 'Địa điểm chấm công',
    locationsHelp: 'Chỉ chấp nhận chấm vào và chấm ra trong bán kính của địa điểm đang hoạt động.',
    addresses: (count: number) => `${count} địa điểm`,
    share: 'Chia sẻ liên kết truy cập',
    shareHelp: 'Nhân viên mở cùng một liên kết trong Zalo, xác thực số điện thoại và liên kết với hồ sơ HR.',
    shareButton: 'Chia sẻ liên kết',
    copied: 'Đã sao chép liên kết Mini App.',
    shared: 'Đã chia sẻ liên kết Mini App.',
    permissions: 'Quyền sử dụng',
    permissionsHelp: 'Chọn các tính năng nhân viên được phép sử dụng.',
    timesheet: 'Bảng công',
    timesheetHelp: 'Xem thông tin chấm công cá nhân',
    payslip: 'Bảng lương',
    payslipHelp: 'Sắp ra mắt — Mini App chưa có màn hình bảng lương',
    locationRequired: 'Yêu cầu vị trí nơi làm việc khi chấm công',
    locationRequiredHelp: 'Dùng vị trí GPS mới từ Zalo khi chấm vào và chấm ra. Không dùng Wi-Fi.',
    addLocation: 'Thêm địa điểm chấm công',
    name: 'Tên địa điểm',
    address: 'Địa chỉ hoặc hướng dẫn',
    latitude: 'Vĩ độ',
    longitude: 'Kinh độ',
    radius: 'Bán kính cho phép (mét)',
    useDevice: 'Dùng vị trí thiết bị này',
    saveLocation: 'Lưu địa điểm',
    cancel: 'Hủy',
    active: 'Đang hoạt động',
    inactive: 'Đã tắt',
    remove: 'Xóa',
    loading: 'Đang tải thiết lập Zalo Mini App…',
    noLocations: 'Chưa có nơi làm việc. Hãy thêm ít nhất một địa điểm đang hoạt động trước khi yêu cầu vị trí.',
    locationCaptured: 'Đã lấy tọa độ hiện tại. Hãy xác nhận tên địa điểm và lưu.',
    locationDenied: 'Không thể lấy vị trí. Hãy cho phép truy cập vị trí hoặc nhập tọa độ thủ công.',
    invalidLocation: 'Hãy nhập tên, tọa độ hợp lệ và bán kính từ 10 đến 500 mét.',
    settingsSaved: 'Đã lưu thiết lập Zalo Mini App.',
    locationSaved: 'Đã lưu địa điểm chấm công.',
    locationRemoved: 'Đã xóa địa điểm chấm công.',
    loadFailed: 'Không thể tải thiết lập Zalo Mini App.',
    saveFailed: 'Không thể lưu thiết lập Zalo Mini App.',
    appId: 'Mini App ID 2952410270374662395',
  },
} as const

export default function StaffZaloMiniAppSettings({ language, onStatus }: Props) {
  const text = copy[language]
  const [settings, setSettings] = useState<ZaloSettings>(defaultSettings)
  const [locations, setLocations] = useState<CheckInLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(defaultLocation)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    const [settingsResult, locationsResult] = await Promise.all([
      supabase
        .from('staff_zalo_settings')
        .select('enabled, require_location, allow_timesheet, allow_payslip')
        .eq('id', 'default')
        .single(),
      supabase
        .from('staff_check_in_locations')
        .select('id, name, address, latitude, longitude, radius_meters, active')
        .is('deleted_at', null)
        .order('name', { ascending: true }),
    ])

    if (settingsResult.error || locationsResult.error) {
      onStatus(settingsResult.error?.message || locationsResult.error?.message || text.loadFailed)
    } else {
      setSettings(settingsResult.data as ZaloSettings)
      setLocations((locationsResult.data || []) as CheckInLocation[])
    }
    setLoading(false)
  }, [onStatus, text.loadFailed])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadSettings(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadSettings])

  async function updateSetting<K extends keyof ZaloSettings>(key: K, value: ZaloSettings[K]) {
    const previous = settings
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('staff_zalo_settings')
      .update({ [key]: value, updated_by: userData.user?.id || null })
      .eq('id', 'default')
    setSaving(false)

    if (error) {
      setSettings(previous)
      onStatus(error.message || text.saveFailed)
      return
    }
    onStatus(text.settingsSaved)
  }

  async function shareAccessLink() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'VRena Employee Attendance',
          text: language === 'vi' ? 'Mở Zalo Mini App để chấm công tại VRena.' : 'Open the Zalo Mini App for VRena employee attendance.',
          url: ZALO_MINI_APP_URL,
        })
        onStatus(text.shared)
        return
      }
      await navigator.clipboard.writeText(ZALO_MINI_APP_URL)
      onStatus(text.copied)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      onStatus(text.saveFailed)
    }
  }

  function captureDeviceLocation() {
    if (!navigator.geolocation) {
      onStatus(text.locationDenied)
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationDraft((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }))
        setLocating(false)
        onStatus(text.locationCaptured)
      },
      () => {
        setLocating(false)
        onStatus(text.locationDenied)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    )
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latitude = Number(locationDraft.latitude)
    const longitude = Number(locationDraft.longitude)
    const radius = Number(locationDraft.radius_meters)
    if (
      !locationDraft.name.trim()
      || !Number.isFinite(latitude)
      || latitude < -90
      || latitude > 90
      || !Number.isFinite(longitude)
      || longitude < -180
      || longitude > 180
      || !Number.isInteger(radius)
      || radius < 10
      || radius > 500
    ) {
      onStatus(text.invalidLocation)
      return
    }

    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('staff_check_in_locations').insert({
      name: locationDraft.name.trim(),
      address: locationDraft.address.trim() || null,
      latitude,
      longitude,
      radius_meters: radius,
      active: true,
      created_by: userData.user?.id || null,
      updated_by: userData.user?.id || null,
    })
    setSaving(false)

    if (error) {
      onStatus(error.message || text.saveFailed)
      return
    }

    setLocationDraft(defaultLocation())
    setShowLocationForm(false)
    onStatus(text.locationSaved)
    await loadSettings()
  }

  async function toggleLocation(location: CheckInLocation) {
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('staff_check_in_locations')
      .update({ active: !location.active, updated_by: userData.user?.id || null })
      .eq('id', location.id)
    setSaving(false)

    if (error) {
      onStatus(error.message || text.saveFailed)
      return
    }
    setLocations((current) => current.map((item) => item.id === location.id ? { ...item, active: !item.active } : item))
    onStatus(text.settingsSaved)
  }

  async function removeLocation(location: CheckInLocation) {
    setSaving(true)
    const { error } = await supabase
      .from('staff_check_in_locations')
      .delete()
      .eq('id', location.id)
    setSaving(false)

    if (error) {
      onStatus(error.message || text.saveFailed)
      return
    }
    setLocations((current) => current.filter((item) => item.id !== location.id))
    onStatus(text.locationRemoved)
  }

  if (loading) return <p className="notice">{text.loading}</p>

  return (
    <section className="staff-zalo-settings" aria-labelledby="staff-zalo-settings-title">
      <header className="staff-zalo-settings-header">
        <div>
          <h3 id="staff-zalo-settings-title">{text.title}</h3>
          <p>{text.subtitle}</p>
        </div>
        <span>{text.appId}</span>
      </header>

      <div className="staff-zalo-settings-card">
        <div className="staff-zalo-setting-row staff-zalo-app-row">
          <div className="staff-zalo-setting-copy">
            <strong>{text.appTitle}</strong>
            <span>{text.appDescription}</span>
          </div>
          <button
            aria-checked={settings.enabled}
            aria-label={text.enabled}
            className={`staff-zalo-switch ${settings.enabled ? 'active' : ''}`}
            disabled={saving}
            role="switch"
            type="button"
            onClick={() => void updateSetting('enabled', !settings.enabled)}
          >
            <span aria-hidden="true" />
          </button>
        </div>

        <div className="staff-zalo-setting-row">
          <div className="staff-zalo-setting-copy">
            <strong><MapPin aria-hidden="true" size={18} />{text.locations}</strong>
            <span>{text.locationsHelp}</span>
          </div>
          <button className="staff-zalo-row-action" type="button" onClick={() => setShowLocations((current) => !current)}>
            {text.addresses(locations.length)}
          </button>
        </div>

        {showLocations && (
          <div className="staff-zalo-location-panel">
            <div className="staff-zalo-location-toolbar">
              <p>{locations.length === 0 ? text.noLocations : text.locationRequiredHelp}</p>
              <button className="primary" type="button" onClick={() => setShowLocationForm(true)}>
                <Plus aria-hidden="true" size={16} />{text.addLocation}
              </button>
            </div>

            {locations.map((location) => (
              <article className={`staff-zalo-location ${location.active ? '' : 'inactive'}`} key={location.id}>
                <div className="staff-zalo-location-pin"><MapPin aria-hidden="true" size={19} /></div>
                <div>
                  <strong>{location.name}</strong>
                  <span>{location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}</span>
                  <small>{location.radius_meters} m · {location.active ? text.active : text.inactive}</small>
                </div>
                <div className="staff-zalo-location-actions">
                  <button aria-label={`${location.active ? text.inactive : text.active}: ${location.name}`} disabled={saving} type="button" onClick={() => void toggleLocation(location)}>
                    {location.active ? <Check aria-hidden="true" size={16} /> : <X aria-hidden="true" size={16} />}
                  </button>
                  <button aria-label={`${text.remove}: ${location.name}`} disabled={saving} type="button" onClick={() => void removeLocation(location)}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </article>
            ))}

            {showLocationForm && (
              <form className="staff-zalo-location-form" onSubmit={saveLocation}>
                <h4>{text.addLocation}</h4>
                <div className="form-grid compact-form-grid">
                  <label>{text.name}<input maxLength={120} required value={locationDraft.name} onChange={(event) => setLocationDraft({ ...locationDraft, name: event.target.value })} /></label>
                  <label>{text.address}<input maxLength={500} value={locationDraft.address} onChange={(event) => setLocationDraft({ ...locationDraft, address: event.target.value })} /></label>
                  <label>{text.latitude}<input inputMode="decimal" required value={locationDraft.latitude} onChange={(event) => setLocationDraft({ ...locationDraft, latitude: event.target.value })} /></label>
                  <label>{text.longitude}<input inputMode="decimal" required value={locationDraft.longitude} onChange={(event) => setLocationDraft({ ...locationDraft, longitude: event.target.value })} /></label>
                  <label>{text.radius}<input max={500} min={10} required step={1} type="number" value={locationDraft.radius_meters} onChange={(event) => setLocationDraft({ ...locationDraft, radius_meters: event.target.value })} /></label>
                </div>
                <div className="staff-zalo-location-form-actions">
                  <button disabled={locating || saving} type="button" onClick={captureDeviceLocation}>
                    <LocateFixed aria-hidden="true" size={16} />{text.useDevice}
                  </button>
                  <button disabled={saving} type="button" onClick={() => { setShowLocationForm(false); setLocationDraft(defaultLocation()) }}>
                    <X aria-hidden="true" size={16} />{text.cancel}
                  </button>
                  <button className="primary" disabled={saving} type="submit">
                    <Save aria-hidden="true" size={16} />{text.saveLocation}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="staff-zalo-setting-row">
          <div className="staff-zalo-setting-copy">
            <strong><Share2 aria-hidden="true" size={18} />{text.share}</strong>
            <span>{text.shareHelp}</span>
          </div>
          <button className="staff-zalo-share-button" type="button" onClick={() => void shareAccessLink()}>
            <Copy aria-hidden="true" size={16} />{text.shareButton}
          </button>
        </div>

        <div className="staff-zalo-permissions">
          <div className="staff-zalo-setting-copy">
            <strong>{text.permissions}</strong>
            <span>{text.permissionsHelp}</span>
          </div>
          <div className="staff-zalo-permission-grid">
            <label>
              <input checked={settings.allow_timesheet} disabled={saving} type="checkbox" onChange={(event) => void updateSetting('allow_timesheet', event.target.checked)} />
              <span><strong>{text.timesheet}</strong><small>{text.timesheetHelp}</small></span>
            </label>
            <label className="unavailable">
              <input checked={false} disabled type="checkbox" />
              <span><strong>{text.payslip}</strong><small>{text.payslipHelp}</small></span>
            </label>
            <label className="staff-zalo-location-permission">
              <input checked={settings.require_location} disabled={saving} type="checkbox" onChange={(event) => void updateSetting('require_location', event.target.checked)} />
              <span><strong>{text.locationRequired}</strong><small>{text.locationRequiredHelp}</small></span>
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
