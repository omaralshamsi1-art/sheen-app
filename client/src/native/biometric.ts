import { Capacitor } from '@capacitor/core'

/**
 * Face ID / Touch ID login. On native we store the Supabase refresh token in the
 * biometric-protected keychain after a password login; on next launch the user
 * can unlock with their face/fingerprint to restore the session.
 * Everything is gated to native, so the web login is unaffected.
 */

const SERVER = 'ae.sheencafe.session'

export async function biometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const res = await NativeBiometric.isAvailable()
    return res.isAvailable
  } catch {
    return false
  }
}

export async function hasBiometricLogin(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const res = await NativeBiometric.isCredentialsSaved({ server: SERVER })
    return res.isSaved
  } catch {
    return false
  }
}

/** Store the refresh token behind biometrics. Returns true if it was saved. */
export async function enableBiometricLogin(email: string, refreshToken: string): Promise<boolean> {
  if (!(await biometricAvailable())) return false
  try {
    const { NativeBiometric, AccessControl } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.setCredentials({
      username: email,
      password: refreshToken,
      server: SERVER,
      accessControl: AccessControl.BIOMETRY_ANY,
    })
    return true
  } catch {
    return false
  }
}

/** Prompt for biometrics and return the stored refresh token (null if cancelled/failed). */
export async function biometricUnlock(reason: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const creds = await NativeBiometric.getSecureCredentials({ server: SERVER, reason })
    return creds.password || null
  } catch {
    return null
  }
}

export async function disableBiometricLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    /* ignore */
  }
}
