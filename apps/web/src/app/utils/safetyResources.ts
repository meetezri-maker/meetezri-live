/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Region-aware support resources with international coverage
 */

import { SafetyResource } from '@/app/types/safety';
import { api } from '@/lib/api';

export type Region = 'US' | 'CA' | 'UK' | 'AU' | 'EU' | 'GLOBAL';

const DETECTED_REGION_STORAGE_KEY = 'ezri_detected_region';
const USER_REGION_STORAGE_KEY = 'ezri_user_region';

export type CrisisHotlineVariant = 'lifeline' | 'text' | 'emergency' | 'samhsa';

export interface CrisisHotlineDisplay {
  name: string;
  phone: string;
  description: string;
  resourceId: string;
  resourceLabel: string;
  resourceType: SafetyResource['type'];
  interactionOnDial: 'call' | 'text';
  telHref?: string;
  variant: CrisisHotlineVariant;
}

interface RegionInfo {
  code: Region;
  name: string;
  emergencyNumber: string;
  timezone?: string;
}

/**
 * Detect user's region: manual preference → IP (API) → timezone → GLOBAL.
 */
export async function detectUserRegion(): Promise<Region> {
  const stored = localStorage.getItem(USER_REGION_STORAGE_KEY);
  if (stored && isValidRegion(stored)) {
    return stored as Region;
  }

  try {
    const geo = await api.geo.getRegion();
    if (geo?.region && isValidRegion(geo.region)) {
      sessionStorage.setItem(DETECTED_REGION_STORAGE_KEY, geo.region);
      return geo.region as Region;
    }
  } catch (e) {
    console.warn('Could not detect region from IP:', e);
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const region = getRegionFromTimezone(timezone);
    if (region) {
      sessionStorage.setItem(DETECTED_REGION_STORAGE_KEY, region);
      return region;
    }
  } catch (e) {
    console.warn('Could not detect timezone:', e);
  }

  sessionStorage.setItem(DETECTED_REGION_STORAGE_KEY, 'GLOBAL');
  return 'GLOBAL';
}

/**
 * Set user's region preference
 */
export function setUserRegion(region: Region): void {
  localStorage.setItem(USER_REGION_STORAGE_KEY, region);
  sessionStorage.setItem(DETECTED_REGION_STORAGE_KEY, region);
}

/**
 * Get user's current region (sync): manual preference → auto-detected session → GLOBAL.
 */
export function getCurrentRegion(): Region {
  const stored = localStorage.getItem(USER_REGION_STORAGE_KEY);
  if (stored && isValidRegion(stored)) {
    return stored as Region;
  }
  const detected = sessionStorage.getItem(DETECTED_REGION_STORAGE_KEY);
  if (detected && isValidRegion(detected)) {
    return detected as Region;
  }
  return 'GLOBAL';
}

function isValidRegion(value: string): boolean {
  return ['US', 'CA', 'UK', 'AU', 'EU', 'GLOBAL'].includes(value);
}

function getRegionFromTimezone(timezone: string): Region | null {
  if (timezone.startsWith('America/')) {
    if (timezone.includes('Toronto') || timezone.includes('Vancouver') || 
        timezone.includes('Montreal') || timezone.includes('Edmonton')) {
      return 'CA';
    }
    return 'US';
  }
  if (timezone.startsWith('Europe/')) {
    if (timezone.includes('London')) return 'UK';
    return 'EU';
  }
  if (timezone.startsWith('Australia/')) {
    return 'AU';
  }
  return null;
}

/**
 * Get region information
 */
export function getRegionInfo(region: Region): RegionInfo {
  const regions: Record<Region, RegionInfo> = {
    US: { code: 'US', name: 'United States', emergencyNumber: '911' },
    CA: { code: 'CA', name: 'Canada', emergencyNumber: '911' },
    UK: { code: 'UK', name: 'United Kingdom', emergencyNumber: '999 or 112' },
    AU: { code: 'AU', name: 'Australia', emergencyNumber: '000 or 112' },
    EU: { code: 'EU', name: 'European Union', emergencyNumber: '112' },
    GLOBAL: { code: 'GLOBAL', name: 'Global', emergencyNumber: 'Varies by country' }
  };
  return regions[region];
}

/**
 * Get region-aware safety resources
 */
export function getSafetyResources(region?: Region): SafetyResource[] {
  const userRegion = region || getCurrentRegion();
  
  const resourcesByRegion: Record<Region, SafetyResource[]> = {
    US: [
      {
        id: 'us_988',
        type: 'crisis_line',
        name: '988 Suicide & Crisis Lifeline',
        description: '24/7 confidential support for people in distress',
        phone: '988',
        url: 'https://988lifeline.org',
        availability: '24/7',
        region: 'US',
      },
      {
        id: 'us_crisis_text',
        type: 'text_line',
        name: 'Crisis Text Line',
        description: 'Text HOME to 741741 to connect with a Crisis Counselor',
        phone: '741741',
        url: 'https://www.crisistextline.org',
        availability: '24/7',
        region: 'US',
      },
      {
        id: 'us_emergency',
        type: 'emergency',
        name: 'Emergency Services',
        description: 'For immediate life-threatening emergencies',
        phone: '911',
        availability: '24/7',
        region: 'US',
      },
      {
        id: 'us_veterans',
        type: 'crisis_line',
        name: 'Veterans Crisis Line',
        description: 'Support for veterans, service members, and their families',
        phone: '988 then press 1',
        url: 'https://www.veteranscrisisline.net',
        availability: '24/7',
        region: 'US',
      },
      {
        id: 'us_trevor',
        type: 'crisis_line',
        name: 'The Trevor Project',
        description: 'Crisis support for LGBTQ+ young people',
        phone: '1-866-488-7386',
        url: 'https://www.thetrevorproject.org',
        availability: '24/7',
        region: 'US',
      },
      {
        id: 'us_nami',
        type: 'support_group',
        name: 'NAMI Helpline',
        description: 'Information and support for mental health concerns',
        phone: '1-800-950-6264',
        url: 'https://www.nami.org/help',
        availability: 'Mon-Fri 10am-10pm ET',
        region: 'US',
      },
    ],
    CA: [
      {
        id: 'ca_988',
        type: 'crisis_line',
        name: '988 Suicide & Emergency Lifeline',
        description: '24/7 suicide prevention and crisis support',
        phone: '988',
        url: 'https://988.ca',
        availability: '24/7',
        region: 'CA',
      },
      {
        id: 'ca_crisis_text',
        type: 'text_line',
        name: 'Crisis Text Line',
        description: 'Text CONNECT to 686868',
        phone: '686868',
        url: 'https://www.crisistextline.ca',
        availability: '24/7',
        region: 'CA',
      },
      {
        id: 'ca_emergency',
        type: 'emergency',
        name: 'Emergency Services',
        description: 'For immediate life-threatening emergencies',
        phone: '911',
        availability: '24/7',
        region: 'CA',
      },
      {
        id: 'ca_kids_help',
        type: 'crisis_line',
        name: 'Kids Help Phone',
        description: 'Support for young people under 30',
        phone: '1-800-668-6868',
        url: 'https://kidshelpphone.ca',
        availability: '24/7',
        region: 'CA',
      },
      {
        id: 'ca_wellness',
        type: 'support_group',
        name: 'Wellness Together Canada',
        description: 'Mental health and substance use support',
        phone: '1-866-585-0445',
        url: 'https://www.wellnesstogether.ca',
        availability: '24/7',
        region: 'CA',
      },
    ],
    UK: [
      {
        id: 'uk_samaritans',
        type: 'crisis_line',
        name: 'Samaritans',
        description: '24/7 confidential emotional support',
        phone: '116 123',
        url: 'https://www.samaritans.org',
        availability: '24/7',
        region: 'UK',
      },
      {
        id: 'uk_shout',
        type: 'text_line',
        name: 'Shout Crisis Text Line',
        description: 'Text SHOUT to 85258',
        phone: '85258',
        url: 'https://www.giveusashout.org',
        availability: '24/7',
        region: 'UK',
      },
      {
        id: 'uk_emergency',
        type: 'emergency',
        name: 'Emergency Services',
        description: 'For immediate life-threatening emergencies',
        phone: '999 or 112',
        availability: '24/7',
        region: 'UK',
      },
      {
        id: 'uk_papyrus',
        type: 'crisis_line',
        name: 'PAPYRUS HOPELINEUK',
        description: 'Support for young people under 35',
        phone: '0800 068 4141',
        url: 'https://www.papyrus-uk.org',
        availability: '9am-midnight daily',
        region: 'UK',
      },
      {
        id: 'uk_mind',
        type: 'support_group',
        name: 'Mind Infoline',
        description: 'Mental health information and support',
        phone: '0300 123 3393',
        url: 'https://www.mind.org.uk',
        availability: 'Mon-Fri 9am-6pm',
        region: 'UK',
      },
    ],
    AU: [
      {
        id: 'au_lifeline',
        type: 'crisis_line',
        name: 'Lifeline Australia',
        description: '24/7 crisis support and suicide prevention',
        phone: '13 11 14',
        url: 'https://www.lifeline.org.au',
        availability: '24/7',
        region: 'AU',
      },
      {
        id: 'au_beyond_blue',
        type: 'crisis_line',
        name: 'Beyond Blue',
        description: 'Support for anxiety, depression and suicide prevention',
        phone: '1300 22 4636',
        url: 'https://www.beyondblue.org.au',
        availability: '24/7',
        region: 'AU',
      },
      {
        id: 'au_emergency',
        type: 'emergency',
        name: 'Emergency Services',
        description: 'For immediate life-threatening emergencies',
        phone: '000 or 112',
        availability: '24/7',
        region: 'AU',
      },
      {
        id: 'au_kids_helpline',
        type: 'crisis_line',
        name: 'Kids Helpline',
        description: 'Support for young people aged 5-25',
        phone: '1800 55 1800',
        url: 'https://kidshelpline.com.au',
        availability: '24/7',
        region: 'AU',
      },
      {
        id: 'au_mensline',
        type: 'support_group',
        name: "MensLine Australia",
        description: 'Support for men',
        phone: '1300 78 99 78',
        url: 'https://mensline.org.au',
        availability: '24/7',
        region: 'AU',
      },
    ],
    EU: [
      {
        id: 'eu_116123',
        type: 'crisis_line',
        name: 'European Emotional Support Line',
        description: 'Emotional support across Europe',
        phone: '116 123',
        url: 'https://www.befrienders.org',
        availability: 'Varies by country',
        region: 'EU',
      },
      {
        id: 'eu_emergency',
        type: 'emergency',
        name: 'Emergency Services',
        description: 'For immediate life-threatening emergencies',
        phone: '112',
        availability: '24/7',
        region: 'EU',
      },
      {
        id: 'eu_telefonseelsorge_de',
        type: 'crisis_line',
        name: 'TelefonSeelsorge (Germany)',
        description: 'Crisis support in German',
        phone: '0800 111 0 111',
        url: 'https://www.telefonseelsorge.de',
        availability: '24/7',
        region: 'EU',
      },
      {
        id: 'eu_sos_fr',
        type: 'crisis_line',
        name: 'SOS Amitié (France)',
        description: 'Crisis support in French',
        phone: '09 72 39 40 50',
        url: 'https://www.sos-amitie.com',
        availability: '24/7',
        region: 'EU',
      },
    ],
    GLOBAL: [
      {
        id: 'global_befrienders',
        type: 'crisis_line',
        name: 'Befrienders Worldwide',
        description: 'Global directory of crisis centers',
        phone: 'Varies by country',
        url: 'https://www.befrienders.org',
        availability: '24/7',
        region: 'GLOBAL',
      },
      {
        id: 'global_iasp',
        type: 'crisis_line',
        name: 'IASP Crisis Centers',
        description: 'International Association for Suicide Prevention',
        phone: 'Varies by country',
        url: 'https://www.iasp.info/resources/Crisis_Centres',
        availability: 'Varies',
        region: 'GLOBAL',
      },
    ],
  };

  return resourcesByRegion[userRegion] || resourcesByRegion.GLOBAL;
}

const HOTLINE_TYPE_ORDER: SafetyResource['type'][] = [
  'emergency',
  'crisis_line',
  'text_line',
  'support_group',
];

function variantForResource(resource: SafetyResource): CrisisHotlineVariant {
  if (resource.type === 'emergency') return 'emergency';
  if (resource.type === 'text_line') return 'text';
  if (resource.type === 'support_group') return 'samhsa';
  return 'lifeline';
}

export function getTelHrefForPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 3) return `tel:${digits}`;
  return `tel:${phone}`;
}

/**
 * Crisis UI hotline cards derived from region-aware safety resources.
 */
export function getCrisisHotlineDisplayResources(region?: Region): CrisisHotlineDisplay[] {
  const resources = getSafetyResources(region);
  const sorted = [...resources].sort(
    (a, b) => HOTLINE_TYPE_ORDER.indexOf(a.type) - HOTLINE_TYPE_ORDER.indexOf(b.type),
  );

  return sorted.slice(0, 4).map((resource) => ({
    name: resource.name,
    phone: resource.phone ?? resource.url ?? 'See website',
    description: resource.description,
    resourceId: resource.id,
    resourceLabel: resource.name,
    resourceType: resource.type,
    interactionOnDial: resource.type === 'text_line' ? 'text' : 'call',
    telHref: resource.phone ? getTelHrefForPhone(resource.phone) : undefined,
    variant: variantForResource(resource),
  }));
}

/**
 * Primary emergency number for immediate-danger callouts.
 */
export function getPrimaryEmergencyResource(region?: Region): SafetyResource | undefined {
  const resources = getSafetyResources(region);
  return (
    resources.find((r) => r.type === 'emergency') ??
    resources.find((r) => r.type === 'crisis_line')
  );
}

/**
 * Get emergency resources only
 */
export function getEmergencyResources(region: string = 'US'): SafetyResource[] {
  const allResources = getSafetyResources(region as Region);
  return allResources.filter(
    resource => resource.type === 'emergency' || resource.type === 'crisis_line'
  );
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 3) {
    return digits; // 988
  } else if (digits.length === 6) {
    return digits; // 741741
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11) {
    return `${digits.slice(0, 1)}-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone; // Return original if doesn't match expected format
}