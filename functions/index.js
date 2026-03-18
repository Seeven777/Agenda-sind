const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Quando novo evento criado → notifica TODOS users
 */
exports.onEventCreated = onDocumentCreated("events/{eventId}", async (event) => {
  const eventData = event.data.data();

  // Query todos users com fcmToken
  const usersSnap = await admin.firestore()
    .collection('users')
    .where('fcmToken', '!=', null)
    .get();

  const tokens = [];
  usersSnap.docs.forEach(doc => tokens.push(doc.data().fcmToken));

  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: `Novo evento: ${eventData.title}`,
      body: `${eventData.location} - ${eventData.date}`,
    },
    data
