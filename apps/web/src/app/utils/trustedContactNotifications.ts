/**
 * Trusted Contact Notification System
 * 
 * Handles automated notifications to trusted contacts when safety concerns are detected.
 * Privacy-safe: No medical details, session content, or diagnosis shared.
 */

import type { SafetyState } from '@/app/types/safety';

export interface TrustedContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isTrustedContact: boolean;
  notificationPreference: 'sms' | 'email' | 'both';
  lastNotified?: string;
}

export interface NotificationEvent {
  id: string;
  timestamp: string;
  contactId: number;
  contactName: string;
  safetyState: SafetyState;
  method: 'sms' | 'email';
  status: 'sent' | 'failed' | 'pending';
  messageTemplate: string;
}

/**
 * Privacy-safe message templates
 * These messages are supportive but contain NO medical information
 */
const MESSAGE_TEMPLATES = {
  HIGH_RISK: {
    sms: (userName: string, contactName: string) => 
      `Hi ${contactName}, this is an automated check-in from Ezri. ${userName} may benefit from some extra support right now. Consider reaching out to see how they're doing. This is not an emergency - just a friendly heads up. 💜`,
    email: (userName: string, contactName: string) => ({
      subject: `Check-in Request for ${userName}`,
      body: `Hi ${contactName},

This is an automated message from Ezri's wellness support system.

${userName} has designated you as a trusted contact who can receive supportive check-in notifications. Our system has detected that they may benefit from some extra support right now.

**This is not an emergency.** We're simply letting you know that reaching out to check in on ${userName} could be helpful at this time.

What you can do:
• Send a caring text or call to say hello
• Offer to spend time together if possible
• Let them know you're thinking of them
• Listen without judgment if they want to talk

**Important:** This message contains no medical information or details about ${userName}'s conversations or mental health status. It's simply a supportive nudge to help ${userName} feel connected.

If you believe ${userName} is in immediate danger, please contact emergency services (911) or the 988 Suicide & Crisis Lifeline.

With care,
The Ezri Team

---
To update your notification preferences, visit your contact settings in the Ezri app.`
    })
  },
  
  SAFETY_MODE: {
    sms: (userName: string, contactName: string) =>
      `Hi ${contactName}, this is an urgent check-in from Ezri. ${userName} may need significant support right now. Please reach out as soon as possible. If you believe they're in immediate danger, call 911 or 988. 🆘`,
    email: (userName: string, contactName: string) => ({
      subject: `URGENT: Check-in Request for ${userName}`,
      body: `Hi ${contactName},

This is an URGENT automated message from Ezri's wellness support system.

${userName} has designated you as a trusted contact. Our safety system has detected significant concern patterns and ${userName} may need substantial support right now.

**What you should do:**
1. **Reach out immediately** - Call or text ${userName} as soon as possible
2. **Check on their safety** - Ask directly if they're safe and if they have thoughts of self-harm
3. **Offer concrete support** - Be present, listen, and help them access professional resources
4. **Contact emergency services if needed** - If you believe they're in immediate danger, call 911 or 988 Suicide & Crisis Lifeline

**Professional Resources:**
• 988 Suicide & Crisis Lifeline - Call or text 988 (24/7, free, confidential)
• Crisis Text Line - Text HOME to 741741
• Emergency Services - Call 911 for immediate danger

**Important:** This message contains no medical information or session details. It's an automated alert based on safety detection patterns. Trust your judgment and don't hesitate to seek professional help.

With urgent care,
The Ezri Team

---
If ${userName} is safe and this was triggered in error, they can adjust their safety settings in the app.`
    })
  }
};

/**
 * Determines if contacts should be notified based on safety state
 */
export function shouldNotifyContacts(state: SafetyState): boolean {
  return state === 'HIGH_RISK' || state === 'SAFETY_MODE';
}

/**
 * Gets appropriate message template for current safety state
 */
export function getMessageTemplate(
  state: SafetyState,
  method: 'sms' | 'email',
  userName: string,
  contactName: string
): string | { subject: string; body: string } {
  if (state === 'SAFETY_MODE') {
    return MESSAGE_TEMPLATES.SAFETY_MODE[method](userName, contactName);
  }
  
  if (state === 'HIGH_RISK') {
    return MESSAGE_TEMPLATES.HIGH_RISK[method](userName, contactName);
  }
  
  // Fallback - should not reach here if shouldNotifyContacts is used
  return method === 'email' 
    ? { subject: 'Check-in Request', body: '' }
    : '';
}

/**
 * Checks if a contact was recently notified (prevents spam)
 * Minimum 4 hours between notifications to same contact
 */
export function canNotifyContact(contact: TrustedContact): boolean {
  if (!contact.lastNotified) return true;
  
  const lastNotifiedTime = new Date(contact.lastNotified).getTime();
  const now = Date.now();
  const fourHours = 4 * 60 * 60 * 1000;
  
  return (now - lastNotifiedTime) >= fourHours;
}

/**
 * Sends notification to a trusted contact
 * In production, this would integrate with Twilio (SMS) and SendGrid (Email)
 */
export async function sendNotification(
  contact: TrustedContact,
  state: SafetyState,
  userName: string = 'Your friend'
): Promise<NotificationEvent> {
  const event: NotificationEvent = {
    id: `notif_${Date.now()}_${contact.id}`,
    timestamp: new Date().toISOString(),
    contactId: contact.id,
    contactName: contact.name,
    safetyState: state,
    method: contact.notificationPreference === 'both' ? 'sms' : contact.notificationPreference,
    status: 'pending',
    messageTemplate: ''
  };

  try {
    // Determine notification methods
    const methods: ('sms' | 'email')[] = 
      contact.notificationPreference === 'both' 
        ? ['sms', 'email']
        : [contact.notificationPreference];

    // Send via each method
    for (const method of methods) {
      const message = getMessageTemplate(state, method, userName, contact.name);
      
      if (method === 'sms') {
        // Production: await twilioClient.messages.create({ ... })
        console.log(`📱 SMS to ${contact.phone}:`, message);
        event.messageTemplate = typeof message === 'string' ? message : '';
      } else {
        // Production: await sendGridClient.send({ ... })
        const emailMsg = message as { subject: string; body: string };
        console.log(`📧 Email to ${contact.email}:`, emailMsg.subject);
        event.messageTemplate = emailMsg.body;
      }
    }

    event.status = 'sent';
    
    // Log notification event
    logNotificationEvent(event);
    
    return event;
  } catch (error) {
    console.error('Error sending notification:', error);
    event.status = 'failed';
    return event;
  }
}

/**
 * Notifies all eligible trusted contacts
 */
export async function notifyTrustedContacts(
  state: SafetyState,
  userName: string = 'Your friend'
): Promise<NotificationEvent[]> {
  if (!shouldNotifyContacts(state)) {
    return [];
  }

  // Load contacts from localStorage
  const contactsJson = localStorage.getItem('ezri_emergency_contacts');
  if (!contactsJson) return [];

  const allContacts: TrustedContact[] = JSON.parse(contactsJson);
  
  // Filter to trusted contacts who can be notified
  const eligibleContacts = allContacts.filter(c => 
    c.isTrustedContact && canNotifyContact(c)
  );

  if (eligibleContacts.length === 0) {
    console.log('No eligible trusted contacts to notify');
    return [];
  }

  // Send notifications
  const events: NotificationEvent[] = [];
  
  for (const contact of eligibleContacts) {
    const event = await sendNotification(contact, state, userName);
    events.push(event);
    
    // Update lastNotified timestamp
    updateContactLastNotified(contact.id);
  }

  return events;
}

/**
 * Updates the lastNotified timestamp for a contact
 */
function updateContactLastNotified(contactId: number): void {
  const contactsJson = localStorage.getItem('ezri_emergency_contacts');
  if (!contactsJson) return;

  const contacts: TrustedContact[] = JSON.parse(contactsJson);
  const updated = contacts.map(c => 
    c.id === contactId 
      ? { ...c, lastNotified: new Date().toISOString() }
      : c
  );

  localStorage.setItem('ezri_emergency_contacts', JSON.stringify(updated));
}

/**
 * Logs notification event to localStorage
 */
function logNotificationEvent(event: NotificationEvent): void {
  const eventsJson = localStorage.getItem('ezri_notification_history');
  const events: NotificationEvent[] = eventsJson ? JSON.parse(eventsJson) : [];
  
  events.unshift(event); // Add to beginning
  
  // Keep only last 100 events
  const trimmed = events.slice(0, 100);
  
  localStorage.setItem('ezri_notification_history', JSON.stringify(trimmed));
}

/**
 * Gets notification history
 */
export function getNotificationHistory(): NotificationEvent[] {
  const eventsJson = localStorage.getItem('ezri_notification_history');
  return eventsJson ? JSON.parse(eventsJson) : [];
}

/**
 * Gets notification history for a specific contact
 */
export function getContactNotificationHistory(contactId: number): NotificationEvent[] {
  const allEvents = getNotificationHistory();
  return allEvents.filter(e => e.contactId === contactId);
}