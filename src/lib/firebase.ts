import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import type { OrganizerAlert, UserSelection } from '../types'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null

function getFirebaseApp() {
  if (!firebaseConfigured) return null
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export async function enableRemoteAlerts(
  selection: UserSelection,
): Promise<{ ok: boolean; message: string }> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      ok: false,
      message: 'This browser does not support web push notifications.',
    }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      ok: false,
      message: 'Notifications were not enabled. You can change this in browser settings.',
    }
  }

  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification('Kirtland Together alerts are ready', {
      body: 'Connect Firebase to receive live shuttle departure and arrival updates.',
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      tag: 'kirtland-alert-setup',
    })
    return {
      ok: true,
      message: 'Local notifications work. Connect Firebase for live shuttle alerts.',
    }
  }

  if (!(await isSupported())) {
    return {
      ok: false,
      message: 'Firebase messaging is not supported in this browser.',
    }
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    return {
      ok: false,
      message: 'The Firebase VAPID key is not configured.',
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const auth = getAuth(firebaseApp)
    if (!auth.currentUser) await signInAnonymously(auth)
    const messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      return {
        ok: false,
        message: 'A notification token could not be created.',
      }
    }

    const functions = getFunctions(
      firebaseApp,
      import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1',
    )
    const registerDevice = httpsCallable(functions, 'registerDeviceToken')
    await registerDevice({ ...selection, token })

    return {
      ok: true,
      message: 'Shuttle alerts are enabled for your group.',
    }
  } catch (error) {
    console.error('Unable to enable remote alerts', error)
    return {
      ok: false,
      message: 'Alerts could not be connected. Check the Firebase setup.',
    }
  }
}

export async function signInOrganizer(
  email: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) {
    return { ok: false, message: 'Firebase is not configured yet.' }
  }
  try {
    await signInWithEmailAndPassword(getAuth(firebaseApp), email, password)
    return { ok: true, message: 'Organizer signed in.' }
  } catch (error) {
    console.error('Organizer sign-in failed', error)
    return { ok: false, message: 'Sign-in failed. Check the organizer account.' }
  }
}

export async function sendOrganizerAlert(
  alert: OrganizerAlert,
): Promise<{ ok: boolean; message: string }> {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) {
    return { ok: false, message: 'Firebase is not configured yet.' }
  }
  try {
    const functions = getFunctions(
      firebaseApp,
      import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1',
    )
    const sendAlert = httpsCallable(functions, 'sendShuttleAlert')
    await sendAlert(alert)
    return { ok: true, message: 'Shuttle alert sent.' }
  } catch (error) {
    console.error('Unable to send alert', error)
    return {
      ok: false,
      message: 'Alert failed. Confirm this account has the admin claim.',
    }
  }
}
