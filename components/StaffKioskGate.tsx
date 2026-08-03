'use client'

import { ArrowLeftRight, Delete, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isLanguageCode, type LanguageCode } from '@/lib/i18n/languages'
import { requiresStaffKioskPin } from '@/lib/staffKioskScope'
import {
  getStaffKioskOperatorToken,
  setStaffKioskOperatorToken,
  STAFF_KIOSK_HEADER,
  supabase,
} from '@/lib/supabase/client'

const INACTIVITY_MS = 5 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000

export type StaffKioskOperator = {
  profileId: string
  employeeCode: string | null
  name: string
  jobTitle: string | null
  accessRole: 'manager' | 'staff'
  avatarEmoji: string | null
  avatarInitials: string | null
  avatarColor: string | null
  avatarTextColor: string | null
}

type DirectoryOperator = Omit<StaffKioskOperator, 'accessRole'> & {
  accessRole: 'manager' | 'staff' | null
  pinConfigured: boolean
}

type StaffKioskGateProps = {
  authEmail?: string
  language?: string
  children: (operator: StaffKioskOperator, lock: () => void) => ReactNode
}

const copy = {
  en: {
    title: 'Who is operating this station?', subtitle: 'Choose your employee profile and enter your personal 4-digit PIN.',
    manager: 'Manager', staff: 'Staff', pin: '4-digit PIN', unlock: 'Unlock station', switch: 'Switch employee',
    lock: 'Lock station', noAccess: 'No employee PIN has been configured yet.', setupTitle: 'Employee PIN required',
    setupHelp: 'An Owner or Admin must sign in with their individual account and create employee PINs from HR → Employees → Store access.',
    employee: 'Employee', mismatch: 'The two PINs do not match.',
    loading: 'Loading employee access…', secured: 'Store device secured', inactivity: 'Locks automatically after 5 minutes of inactivity.',
    chooseEmployee: 'Choose employee', incorrect: 'Could not unlock the station.', back: 'Choose another employee', clear: 'Clear PIN',
  },
  vi: {
    title: 'Ai đang vận hành máy này?', subtitle: 'Chọn hồ sơ nhân viên và nhập mã PIN cá nhân gồm 4 chữ số.',
    manager: 'Quản lý', staff: 'Nhân viên', pin: 'Mã PIN 4 số', unlock: 'Mở khóa máy', switch: 'Đổi nhân viên',
    lock: 'Khóa máy', noAccess: 'Chưa có mã PIN nhân viên nào được thiết lập.', setupTitle: 'Cần mã PIN nhân viên',
    setupHelp: 'Chủ sở hữu hoặc Quản trị viên phải đăng nhập bằng tài khoản cá nhân và tạo PIN tại HR → Nhân viên → Quyền truy cập tại cửa hàng.',
    employee: 'Nhân viên', mismatch: 'Hai mã PIN không khớp.',
    loading: 'Đang tải quyền nhân viên…', secured: 'Thiết bị cửa hàng đã được bảo vệ', inactivity: 'Tự động khóa sau 5 phút không hoạt động.',
    chooseEmployee: 'Chọn nhân viên', incorrect: 'Không thể mở khóa máy.', back: 'Chọn nhân viên khác', clear: 'Xóa PIN',
  },
  ko: {
    title: '현재 이 기기를 사용하는 직원은 누구인가요?', subtitle: '직원 프로필을 선택하고 개인 4자리 PIN을 입력하세요.',
    manager: '관리자', staff: '직원', pin: '4자리 PIN', unlock: '기기 잠금 해제', switch: '직원 전환', lock: '기기 잠금',
    noAccess: '아직 직원 PIN이 설정되지 않았습니다.', setupTitle: '직원 PIN 필요',
    setupHelp: '소유자 또는 관리자가 개인 계정으로 로그인하여 HR → 직원 → 매장 액세스에서 PIN을 만들어야 합니다.',
    employee: '직원', mismatch: '두 PIN이 일치하지 않습니다.',
    loading: '직원 권한 불러오는 중…', secured: '매장 기기 보안 적용됨', inactivity: '5분 동안 활동이 없으면 자동으로 잠깁니다.',
    chooseEmployee: '직원 선택', incorrect: '기기 잠금을 해제할 수 없습니다.', back: '다른 직원 선택', clear: 'PIN 지우기',
  },
  ja: {
    title: 'この端末を操作するスタッフは誰ですか？', subtitle: '従業員プロフィールを選び、個人の4桁PINを入力してください。',
    manager: 'マネージャー', staff: 'スタッフ', pin: '4桁PIN', unlock: '端末を解除', switch: 'スタッフ切替', lock: '端末をロック',
    noAccess: '従業員PINはまだ設定されていません。', setupTitle: '従業員PINが必要です',
    setupHelp: 'オーナーまたは管理者が個人アカウントでログインし、HR → 従業員 → 店舗アクセスからPINを作成してください。',
    employee: '従業員', mismatch: '2つのPINが一致しません。',
    loading: '従業員アクセスを読み込み中…', secured: '店舗端末は保護されています', inactivity: '5分間操作がないと自動的にロックされます。',
    chooseEmployee: '従業員を選択', incorrect: '端末を解除できませんでした。', back: '別の従業員を選択', clear: 'PINを消去',
  },
  fr: {
    title: 'Qui utilise ce poste ?', subtitle: 'Choisissez votre profil employé et saisissez votre PIN personnel à 4 chiffres.',
    manager: 'Manager', staff: 'Personnel', pin: 'PIN à 4 chiffres', unlock: 'Déverrouiller le poste', switch: 'Changer d’employé', lock: 'Verrouiller le poste',
    noAccess: 'Aucun PIN employé n’est encore configuré.', setupTitle: 'PIN employé requis',
    setupHelp: 'Un propriétaire ou administrateur doit se connecter avec son compte individuel et créer les PIN dans RH → Employés → Accès magasin.',
    employee: 'Employé', mismatch: 'Les deux PIN ne correspondent pas.',
    loading: 'Chargement des accès employés…', secured: 'Poste du magasin sécurisé', inactivity: 'Verrouillage automatique après 5 minutes d’inactivité.',
    chooseEmployee: 'Choisir un employé', incorrect: 'Impossible de déverrouiller le poste.', back: 'Choisir un autre employé', clear: 'Effacer le PIN',
  },
  de: {
    title: 'Wer bedient diese Station?', subtitle: 'Mitarbeiterprofil auswählen und persönliche 4-stellige PIN eingeben.',
    manager: 'Manager', staff: 'Personal', pin: '4-stellige PIN', unlock: 'Station entsperren', switch: 'Mitarbeiter wechseln', lock: 'Station sperren',
    noAccess: 'Es wurde noch keine Mitarbeiter-PIN eingerichtet.', setupTitle: 'Mitarbeiter-PIN erforderlich',
    setupHelp: 'Ein Inhaber oder Administrator muss sich mit seinem persönlichen Konto anmelden und PINs unter HR → Mitarbeiter → Store-Zugriff erstellen.',
    employee: 'Mitarbeiter', mismatch: 'Die beiden PINs stimmen nicht überein.',
    loading: 'Mitarbeiterzugriff wird geladen…', secured: 'Store-Gerät geschützt', inactivity: 'Automatische Sperre nach 5 Minuten Inaktivität.',
    chooseEmployee: 'Mitarbeiter auswählen', incorrect: 'Die Station konnte nicht entsperrt werden.', back: 'Anderen Mitarbeiter wählen', clear: 'PIN löschen',
  },
  it: {
    title: 'Chi sta usando questa postazione?', subtitle: 'Scegli il profilo dipendente e inserisci il PIN personale di 4 cifre.',
    manager: 'Manager', staff: 'Staff', pin: 'PIN di 4 cifre', unlock: 'Sblocca postazione', switch: 'Cambia dipendente', lock: 'Blocca postazione',
    noAccess: 'Nessun PIN dipendente è ancora configurato.', setupTitle: 'PIN dipendente richiesto',
    setupHelp: 'Un proprietario o amministratore deve accedere con il proprio account individuale e creare i PIN in HR → Dipendenti → Accesso negozio.',
    employee: 'Dipendente', mismatch: 'I due PIN non corrispondono.',
    loading: 'Caricamento accessi dipendenti…', secured: 'Dispositivo del negozio protetto', inactivity: 'Blocco automatico dopo 5 minuti di inattività.',
    chooseEmployee: 'Scegli dipendente', incorrect: 'Impossibile sbloccare la postazione.', back: 'Scegli un altro dipendente', clear: 'Cancella PIN',
  },
} satisfies Record<LanguageCode, Record<string, string>>

async function staffKioskHeaders(includeOperator = false) {
  const { data, error } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (error || !accessToken) throw new Error(error?.message || 'Staff session required.')
  const operatorToken = getStaffKioskOperatorToken()
  return {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    ...(includeOperator && operatorToken ? { [STAFF_KIOSK_HEADER]: operatorToken } : {}),
  }
}

function operatorInitials(operator: Pick<DirectoryOperator, 'avatarInitials' | 'name'>) {
  if (operator.avatarInitials) return operator.avatarInitials.slice(0, 3).toUpperCase()
  return operator.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VR'
}

async function revokeOperatorToken(activeToken: string, reason: string) {
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return
    await fetch('/api/staff/kiosk/session', {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        [STAFF_KIOSK_HEADER]: activeToken,
      },
      body: JSON.stringify({ reason }),
      keepalive: true,
    })
  } catch {
    // The local lock is immediate even if the best-effort server revoke fails.
  }
}

export default function StaffKioskGate({ authEmail, language, children }: StaffKioskGateProps) {
  const requiresPin = requiresStaffKioskPin(authEmail)
  const resolvedLanguage: LanguageCode = isLanguageCode(language) ? language : 'en'
  const text = copy[resolvedLanguage]
  const [directory, setDirectory] = useState<DirectoryOperator[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [pin, setPin] = useState('')
  const [operator, setOperator] = useState<StaffKioskOperator | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const lastActivityRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const inactivityTimerRef = useRef<number | null>(null)

  const configuredOperators = useMemo(() => directory.filter((item) => item.pinConfigured && item.accessRole), [directory])
  const selectedOperator = useMemo(
    () => directory.find((item) => item.profileId === selectedProfileId) || null,
    [directory, selectedProfileId],
  )

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await staffKioskHeaders()
      const response = await fetch('/api/staff/kiosk/operators', { headers, cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as { error?: string; operators?: DirectoryOperator[] }
      if (!response.ok) throw new Error(payload.error || 'Could not load employee access.')
      const nextDirectory = payload.operators || []
      setDirectory(nextDirectory)
      setSelectedProfileId((current) => current || nextDirectory.find((item) => item.pinConfigured)?.profileId || nextDirectory[0]?.profileId || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.incorrect)
    } finally {
      setLoading(false)
    }
  }, [text.incorrect])

  useEffect(() => {
    if (!requiresPin) return
    const loadTimer = window.setTimeout(() => void loadDirectory(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadDirectory, requiresPin])

  useEffect(() => {
    if (requiresPin) return
    setStaffKioskOperatorToken('')
  }, [requiresPin])

  const lockOperator = useCallback((reason = 'locked') => {
    const activeToken = getStaffKioskOperatorToken()
    setOperator(null)
    setPin('')
    setError('')
    setStaffKioskOperatorToken('')
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = null
    if (!activeToken) return
    void revokeOperatorToken(activeToken, reason)
  }, [])

  const heartbeat = useCallback(async () => {
    if (!getStaffKioskOperatorToken()) return false
    try {
      const headers = await staffKioskHeaders(true)
      const response = await fetch('/api/staff/kiosk/session', { method: 'PATCH', headers, body: '{}' })
      if (!response.ok) {
        lockOperator('session_expired')
        return false
      }
      lastHeartbeatRef.current = Date.now()
      return true
    } catch {
      lockOperator('session_error')
      return false
    }
  }, [lockOperator])

  const manualLock = useCallback(() => {
    const activeToken = getStaffKioskOperatorToken()
    setOperator(null)
    setPin('')
    setError('')
    setStaffKioskOperatorToken('')
    if (activeToken) void revokeOperatorToken(activeToken, 'manual')
  }, [])

  useEffect(() => {
    if (!operator) return

    const scheduleLock = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current)
      const remaining = Math.max(0, INACTIVITY_MS - (Date.now() - lastActivityRef.current))
      inactivityTimerRef.current = window.setTimeout(() => lockOperator('inactivity'), remaining)
    }
    const recordActivity = () => {
      lastActivityRef.current = Date.now()
      scheduleLock()
      if (Date.now() - lastHeartbeatRef.current >= HEARTBEAT_MS) void heartbeat()
    }
    const verifyActivityWindow = () => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_MS) lockOperator('inactivity')
      else recordActivity()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') verifyActivityWindow()
    }

    recordActivity()
    window.addEventListener('pointerdown', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity)
    window.addEventListener('touchstart', recordActivity, { passive: true })
    window.addEventListener('focus', verifyActivityWindow)
    window.addEventListener('pageshow', verifyActivityWindow)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pointerdown', recordActivity)
      window.removeEventListener('keydown', recordActivity)
      window.removeEventListener('touchstart', recordActivity)
      window.removeEventListener('focus', verifyActivityWindow)
      window.removeEventListener('pageshow', verifyActivityWindow)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current)
    }
  }, [heartbeat, lockOperator, operator])

  useEffect(() => () => {
    setStaffKioskOperatorToken('')
  }, [])

  const unlock = useCallback(async (pinValue: string) => {
    if (!selectedOperator || submitting || !/^\d{4}$/.test(pinValue)) return
    setSubmitting(true)
    setError('')
    try {
      const headers = await staffKioskHeaders()
      const response = await fetch('/api/staff/kiosk/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ profileId: selectedOperator.profileId, pin: pinValue }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        operator?: Record<string, unknown>
        operatorToken?: string
      }
      if (!response.ok || !payload.operator || !payload.operatorToken) throw new Error(payload.error || text.incorrect)
      const result = payload.operator
      const accessRole = result.access_role === 'manager' ? 'manager' : 'staff'
      const nextOperator: StaffKioskOperator = {
        profileId: String(result.profile_id || selectedOperator.profileId),
        employeeCode: selectedOperator.employeeCode,
        name: String(result.name || selectedOperator.name),
        jobTitle: selectedOperator.jobTitle,
        accessRole,
        avatarEmoji: typeof result.avatar_emoji === 'string' ? result.avatar_emoji : selectedOperator.avatarEmoji,
        avatarInitials: typeof result.avatar_initials === 'string' ? result.avatar_initials : selectedOperator.avatarInitials,
        avatarColor: typeof result.avatar_color === 'string' ? result.avatar_color : selectedOperator.avatarColor,
        avatarTextColor: typeof result.avatar_text_color === 'string' ? result.avatar_text_color : selectedOperator.avatarTextColor,
      }
      setStaffKioskOperatorToken(payload.operatorToken)
      lastActivityRef.current = Date.now()
      lastHeartbeatRef.current = Date.now()
      setOperator(nextOperator)
      setPin('')
    } catch (unlockError) {
      setPin('')
      setError(unlockError instanceof Error ? unlockError.message : text.incorrect)
    } finally {
      setSubmitting(false)
    }
  }, [selectedOperator, submitting, text.incorrect])

  const updatePin = (value: string) => {
    const nextPin = value.replace(/\D/g, '').slice(0, 4)
    setPin(nextPin)
    if (nextPin.length === 4 && configuredOperators.length > 0) void unlock(nextPin)
  }

  if (!requiresPin) return <>{children({
    profileId: '', employeeCode: null, name: '', jobTitle: null, accessRole: 'manager',
    avatarEmoji: null, avatarInitials: null, avatarColor: null, avatarTextColor: null,
  }, () => {})}</>
  if (operator) return <>{children(operator, manualLock)}</>

  return (
    <section className="section staff-kiosk-lock" aria-labelledby="staff-kiosk-title">
      <header className="staff-kiosk-lock-head">
        <span className="staff-kiosk-lock-icon"><LockKeyhole aria-hidden="true" size={24} /></span>
        <div>
          <small><ShieldCheck aria-hidden="true" size={14} /> {text.secured}</small>
          <h2 id="staff-kiosk-title">{configuredOperators.length > 0 ? text.title : text.setupTitle}</h2>
          <p>{configuredOperators.length > 0 ? text.subtitle : text.setupHelp}</p>
        </div>
      </header>

      {loading ? <p className="staff-kiosk-loading">{text.loading}</p> : (
        <>
          {configuredOperators.length === 0 ? <p className="notice">{text.noAccess}</p> : (
            <div className="staff-kiosk-unlock-layout">
              <div className="staff-kiosk-operator-grid" aria-label={text.chooseEmployee}>
                {configuredOperators.map((item) => {
                  const active = item.profileId === selectedProfileId
                  return (
                    <button className={`staff-kiosk-operator-card ${active ? 'active' : ''}`} key={item.profileId} type="button" onClick={() => { setSelectedProfileId(item.profileId); setPin(''); setError('') }}>
                      <span className="staff-kiosk-avatar" style={{ background: item.avatarColor || undefined, color: item.avatarTextColor || undefined }}>
                        {item.avatarEmoji || operatorInitials(item)}
                      </span>
                      <span><strong>{item.name}</strong><small>{item.accessRole === 'manager' ? text.manager : text.staff}{item.jobTitle ? ` · ${item.jobTitle}` : ''}</small></span>
                    </button>
                  )
                })}
              </div>

              <div className="staff-kiosk-pin-panel">
                <div className="staff-kiosk-selected">
                  <UserRound aria-hidden="true" size={18} />
                  <span><small>{text.employee}</small><strong>{selectedOperator?.name || text.chooseEmployee}</strong></span>
                </div>
                <label className="staff-kiosk-pin-input">
                  <span>{text.pin}</span>
                  <input aria-label={text.pin} autoComplete="off" autoFocus inputMode="numeric" maxLength={4} pattern="[0-9]*" type="password" value={pin} onChange={(event) => updatePin(event.target.value)} />
                </label>
                <div className="staff-kiosk-keypad" aria-label={text.pin}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button disabled={submitting} key={digit} type="button" onClick={() => updatePin(`${pin}${digit}`)}>{digit}</button>)}
                  <button aria-label={text.clear} disabled={submitting} type="button" onClick={() => setPin('')}><ArrowLeftRight aria-hidden="true" size={19} /></button>
                  <button disabled={submitting} type="button" onClick={() => updatePin(`${pin}0`)}>0</button>
                  <button aria-label={text.back} disabled={submitting} type="button" onClick={() => setPin((current) => current.slice(0, -1))}><Delete aria-hidden="true" size={20} /></button>
                </div>
                <button className="primary staff-kiosk-unlock-button" disabled={submitting || pin.length !== 4 || !selectedOperator} type="button" onClick={() => void unlock(pin)}>
                  <LockKeyhole aria-hidden="true" size={18} /> {text.unlock}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <p className="staff-kiosk-error" role="alert">{error}</p>}
      <footer><ShieldCheck aria-hidden="true" size={15} /> {text.inactivity}</footer>
    </section>
  )
}

export function staffKioskCopy(language?: string) {
  return copy[isLanguageCode(language) ? language : 'en']
}
