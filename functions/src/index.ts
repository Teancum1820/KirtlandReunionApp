import { createHash } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const db = getFirestore()
const topicPart = (value: string) => value.replace(/[^a-zA-Z0-9-_.~%]/g, '-')
const appUrl = (process.env.APP_URL ??
  'https://teancum1820.github.io/KirtlandReunionApp/').replace(/\/?$/, '/')

type DeviceRegistration = {
  token?: unknown
  familyId?: unknown
  groupId?: unknown
}

type ShuttleAlert = {
  alertType?: unknown
  familyId?: unknown
  groupId?: unknown
  locationName?: unknown
  target?: unknown
}

export const registerDeviceToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in is required.')
  }

  const { token, familyId, groupId } = request.data as DeviceRegistration
  if (
    typeof token !== 'string' ||
    token.length < 20 ||
    typeof familyId !== 'string' ||
    typeof groupId !== 'string'
  ) {
    throw new HttpsError('invalid-argument', 'Invalid device registration.')
  }

  const registrationId = createHash('sha256')
    .update(`${request.auth.uid}:${token}`)
    .digest('hex')
  const registrationRef = db.collection('deviceRegistrations').doc(registrationId)
  const existing = await registrationRef.get()
  const previous = existing.data() as
    | { token?: string; familyId?: string; groupId?: string }
    | undefined

  const messaging = getMessaging()
  if (previous?.token) {
    const oldTopics = [
      previous.familyId && `family-${topicPart(previous.familyId)}`,
      previous.groupId && `group-${topicPart(previous.groupId)}`,
    ].filter((topic): topic is string => Boolean(topic))
    await Promise.all(
      oldTopics.map((topic) =>
        messaging.unsubscribeFromTopic(previous.token as string, topic),
      ),
    )
  }

  const topics = [
    'all-reunion-attendees',
    `family-${topicPart(familyId)}`,
    `group-${topicPart(groupId)}`,
  ]
  await Promise.all(
    topics.map((topic) => messaging.subscribeToTopic(token, topic)),
  )

  await registrationRef.set({
    token,
    userId: request.auth.uid,
    familyId,
    groupId,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { registered: true }
})

export const sendShuttleAlert = onCall(async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError(
      'permission-denied',
      'An organizer account is required.',
    )
  }

  const data = request.data as ShuttleAlert
  if (
    (data.alertType !== 'departing' && data.alertType !== 'arriving') ||
    (data.target !== 'group' &&
      data.target !== 'family' &&
      data.target !== 'all')
  ) {
    throw new HttpsError('invalid-argument', 'Invalid shuttle alert.')
  }

  let topic = 'all-reunion-attendees'
  if (data.target === 'family') {
    if (typeof data.familyId !== 'string') {
      throw new HttpsError('invalid-argument', 'A family is required.')
    }
    topic = `family-${topicPart(data.familyId)}`
  }
  if (data.target === 'group') {
    if (typeof data.groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'A group is required.')
    }
    topic = `group-${topicPart(data.groupId)}`
  }

  const departing = data.alertType === 'departing'
  const title = departing
    ? 'Your shuttle is leaving now'
    : 'Your shuttle is arriving now'
  const location =
    typeof data.locationName === 'string'
      ? data.locationName
      : 'the reunion shuttle stop'
  const body = departing
    ? `Please board at ${location}. Open the app for details.`
    : `Your shuttle is pulling into ${location}.`

  const messageId = await getMessaging().send({
    topic,
    data: {
      alertType: data.alertType,
      target: data.target,
      url: appUrl,
    },
    webpush: {
      notification: {
        title,
        body,
        icon: `${appUrl}icon-192.png`,
        badge: `${appUrl}icon-192.png`,
        tag: `shuttle-${topic}`,
        requireInteraction: departing,
      },
      fcmOptions: {
        link: appUrl,
      },
    },
  })

  await db.collection('alertHistory').add({
    messageId,
    title,
    body,
    topic,
    alertType: data.alertType,
    sentBy: request.auth.uid,
    sentAt: FieldValue.serverTimestamp(),
  })

  return { sent: true, messageId }
})
