/**
 * Country-keyed suicide / crisis hotlines (ISO 3166-1 alpha-2).
 * Canonical source — seeded to Postgres and used by web/API.
 */

export type CrisisResourceType = 'crisis_line' | 'text_line' | 'emergency' | 'support_group';

export interface CrisisHotlineExtra {
  id: string;
  type: CrisisResourceType;
  name: string;
  description: string;
  phone?: string;
  url?: string;
}

export interface CrisisResourceDto {
  id: string;
  type: CrisisResourceType;
  name: string;
  description: string;
  phone?: string;
  url?: string;
  availability: string;
  region: string;
}
export interface CountryHotlineEntry {
  countryCode: string;
  countryName: string;
  dialCode: string;
  /** Primary suicide / mental health crisis line */
  crisisLine: {
    name: string;
    phone: string;
    description?: string;
    url?: string;
  };
  /** National emergency number when known */
  emergencyPhone?: string;
  /** Extra lines (text, veterans, regional, etc.) */
  extras?: CrisisHotlineExtra[];
}

const AVAILABILITY_247 = '24/7';

function entry(
  countryCode: string,
  countryName: string,
  dialCode: string,
  crisisName: string,
  crisisPhone: string,
  options?: {
    crisisDescription?: string;
    crisisUrl?: string;
    emergencyPhone?: string;
    extras?: CountryHotlineEntry['extras'];
  },
): CountryHotlineEntry {
  return {
    countryCode,
    countryName,
    dialCode,
    crisisLine: {
      name: crisisName,
      phone: crisisPhone,
      description: options?.crisisDescription,
      url: options?.crisisUrl,
    },
    emergencyPhone: options?.emergencyPhone,
    extras: options?.extras,
  };
}

/** Verified hotlines from product directory — keyed by ISO country code. */
export const CRISIS_HOTLINES_BY_COUNTRY: Record<string, CountryHotlineEntry> = {
  US: entry('US', 'United States', '+1', '988 Suicide & Crisis Lifeline', '988', {
    crisisDescription: '24/7 confidential support for people in distress',
    crisisUrl: 'https://988lifeline.org',
    emergencyPhone: '911',
    extras: [
      {
        id: 'us_crisis_text',
        type: 'text_line',
        name: 'Crisis Text Line',
        description: 'Text HOME to 741741 to connect with a Crisis Counselor',
        phone: '741741',
        url: 'https://www.crisistextline.org',
      },
      {
        id: 'us_veterans',
        type: 'crisis_line',
        name: 'Veterans Crisis Line',
        description: 'Support for veterans — call 988 then press 1',
        phone: '988 then press 1',
        url: 'https://www.veteranscrisisline.net',
      },
    ],
  }),
  CA: entry('CA', 'Canada', '+1', '988 Suicide & Crisis Lifeline', '988', {
    crisisDescription: '24/7 suicide prevention and crisis support',
    crisisUrl: 'https://988.ca',
    emergencyPhone: '911',
    extras: [
      {
        id: 'ca_crisis_text',
        type: 'text_line',
        name: 'Crisis Text Line',
        description: 'Text CONNECT to 686868',
        phone: '686868',
        url: 'https://www.crisistextline.ca',
      },
      {
        id: 'ca_kids_help',
        type: 'crisis_line',
        name: 'Kids Help Phone',
        description: 'Support for young people under 30',
        phone: '1-800-668-6868',
        url: 'https://kidshelpphone.ca',
      },
    ],
  }),
  GB: entry('GB', 'United Kingdom', '+44', 'Samaritans', '116 123', {
    crisisDescription: '24/7 confidential emotional support',
    crisisUrl: 'https://www.samaritans.org',
    emergencyPhone: '999',
    extras: [
      {
        id: 'uk_shout',
        type: 'text_line',
        name: 'Shout Crisis Text Line',
        description: 'Text SHOUT to 85258',
        phone: '85258',
        url: 'https://www.giveusashout.org',
      },
    ],
  }),
  IE: entry('IE', 'Ireland', '+353', 'Samaritans Ireland', '116 123', {
    crisisUrl: 'https://www.samaritans.org',
    emergencyPhone: '112',
  }),
  AU: entry('AU', 'Australia', '+61', 'Lifeline Australia', '13 11 14', {
    crisisDescription: '24/7 crisis support and suicide prevention',
    crisisUrl: 'https://www.lifeline.org.au',
    emergencyPhone: '000',
    extras: [
      {
        id: 'au_beyond_blue',
        type: 'crisis_line',
        name: 'Beyond Blue',
        description: 'Support for anxiety, depression and suicide prevention',
        phone: '1300 22 4636',
        url: 'https://www.beyondblue.org.au',
      },
    ],
  }),
  NZ: entry('NZ', 'New Zealand', '+64', 'Need to Talk?', '1737', {
    crisisDescription: 'Free call or text — trained counsellors',
    crisisUrl: 'https://www.mentalhealth.org.nz',
    emergencyPhone: '111',
  }),
  FR: entry('FR', 'France', '+33', 'Numéro national de prévention du suicide', '3114', {
    crisisDescription: '24/7 suicide prevention',
    emergencyPhone: '112',
  }),
  DE: entry('DE', 'Germany', '+49', 'TelefonSeelsorge', '0800 111 0 111', {
    crisisDescription: '24/7 crisis support in German',
    crisisUrl: 'https://www.telefonseelsorge.de',
    emergencyPhone: '112',
  }),
  NL: entry('NL', 'Netherlands', '+31', '113 Zelfmoordpreventie', '113', {
    crisisUrl: 'https://www.113.nl',
    emergencyPhone: '112',
  }),
  ES: entry('ES', 'Spain', '+34', 'Línea 024', '024', {
    crisisDescription: 'Atención a la conducta suicida',
    emergencyPhone: '112',
  }),
  BE: entry('BE', 'Belgium', '+32', 'Centre de Prévention du Suicide', '1813', {
    emergencyPhone: '112',
  }),
  CH: entry('CH', 'Switzerland', '+41', 'Die Dargebotene Hand', '143', {
    crisisUrl: 'https://www.143.ch',
    emergencyPhone: '112',
  }),
  AT: entry('AT', 'Austria', '+43', 'TelefonSeelsorge Österreich', '142', {
    emergencyPhone: '112',
  }),
  IT: entry('IT', 'Italy', '+39', 'Telefono Amico', '800 860 022', {
    emergencyPhone: '112',
  }),
  SE: entry('SE', 'Sweden', '+46', 'Mind Självmordslinjen', '031 711 24 00', {
    emergencyPhone: '112',
  }),
  NO: entry('NO', 'Norway', '+47', 'Mental Helse Hjelpetelefonen', '815 33 300', {
    emergencyPhone: '112',
  }),
  DK: entry('DK', 'Denmark', '+45', 'Livslinien', '70 20 12 01', {
    emergencyPhone: '112',
  }),
  FI: entry('FI', 'Finland', '+358', 'Suomen Mielenterveysseura', '010 195 202', {
    emergencyPhone: '112',
  }),
  PT: entry('PT', 'Portugal', '+351', 'SOS Voz Amiga', '21 854 07 40', {
    emergencyPhone: '112',
  }),
  PL: entry('PL', 'Poland', '+48', 'Telefon Zaufania', '52 70 00 00', {
    emergencyPhone: '112',
  }),
  HU: entry('HU', 'Hungary', '+36', 'Emotional Support Line', '116 123', {
    emergencyPhone: '112',
  }),
  GR: entry('GR', 'Greece', '+30', '1018 Suicide Prevention', '1018', {
    emergencyPhone: '112',
  }),
  RO: entry('RO', 'Romania', '+40', 'Telefonul Sufletului', '0800 801 200', {
    emergencyPhone: '112',
  }),
  RU: entry('RU', 'Russia', '+7', 'Psychological Support Line', '0078202577577', {
    emergencyPhone: '112',
  }),
  TR: entry('TR', 'Turkey', '+90', 'Emergency Mental Health Support', '112', {
    crisisDescription: 'Dial 112 for emergency support services',
    emergencyPhone: '112',
  }),
  IL: entry('IL', 'Israel', '+972', 'Eran Emotional First Aid', '1201', {
    crisisUrl: 'https://www.eran.org.il',
    emergencyPhone: '100',
  }),
  AE: entry('AE', 'United Arab Emirates', '+971', 'UAE Mental Health Support', '800 46342', {
    emergencyPhone: '999',
  }),
  SA: entry('SA', 'Saudi Arabia', '+966', 'National Mental Health Services', '937', {
    crisisDescription: 'Emergency support services — call 937 for mental health crisis',
    emergencyPhone: '911',
  }),
  QA: entry('QA', 'Qatar', '+974', 'Mental Health Support', '16000', {
    crisisDescription: 'National healthcare mental health services',
    emergencyPhone: '999',
  }),
  KW: entry('KW', 'Kuwait', '+965', 'Mental Health Helpline', '94069304', {
    emergencyPhone: '112',
  }),
  JO: entry('JO', 'Jordan', '+962', 'Jordan Mental Health Helpline', '110', {
    emergencyPhone: '911',
  }),
  LB: entry('LB', 'Lebanon', '+961', 'Embrace Lifeline', '1564', {
    crisisUrl: 'https://www.embracelebanon.org',
    emergencyPhone: '112',
  }),
  EG: entry('EG', 'Egypt', '+20', 'Befrienders Cairo', '16328', {
    emergencyPhone: '122',
  }),
  ZA: entry('ZA', 'South Africa', '+27', 'SADAG Suicide Crisis Line', '051 444 5691', {
    crisisUrl: 'https://www.sadag.org',
    emergencyPhone: '10111',
  }),
  KE: entry('KE', 'Kenya', '+254', 'Befrienders Kenya', '722178177', {
    emergencyPhone: '999',
  }),
  NG: entry('NG', 'Nigeria', '+234', 'Nigeria Suicide Prevention Initiative', '08092106493', {
    emergencyPhone: '112',
  }),
  UG: entry('UG', 'Uganda', '+256', 'Mental Health Uganda', '0800 21 21 21', {
    emergencyPhone: '112',
  }),
  IN: entry('IN', 'India', '+91', 'Tele-MANAS', '14416', {
    crisisDescription: 'National tele-mental health helpline',
    crisisUrl: 'https://telemanas.mohfw.gov.in',
    emergencyPhone: '112',
  }),
  PK: entry('PK', 'Pakistan', '+92', 'Umang Mental Health Helpline', '0311 7786264', {
    crisisDescription: '24/7 mental health support',
    emergencyPhone: '15',
    extras: [
      {
        id: 'pk_rozan',
        type: 'crisis_line',
        name: 'Rozan Counseling Helpline',
        description: 'Counseling and emotional support',
        phone: '0800-22444',
      },
      {
        id: 'pk_rescue',
        type: 'emergency',
        name: 'Rescue Services',
        description: 'Emergency rescue assistance',
        phone: '1122',
      },
    ],
  }),
  BD: entry('BD', 'Bangladesh', '+880', 'Kaan Pete Roi', '01779554391', {
    crisisDescription: 'Emotional support — regional services also available',
    crisisUrl: 'https://www.kaanpeteroi.com',
    emergencyPhone: '999',
  }),
  LK: entry('LK', 'Sri Lanka', '+94', 'Sumithrayo', '011 057 2222662', {
    crisisUrl: 'https://www.sumithrayo.org',
    emergencyPhone: '119',
  }),
  SG: entry('SG', 'Singapore', '+65', 'Samaritans of Singapore', '1767', {
    crisisUrl: 'https://www.sos.org.sg',
    emergencyPhone: '995',
  }),
  MY: entry('MY', 'Malaysia', '+60', 'Befrienders KL', '03-7627 2929', {
    crisisDescription: 'Various Befrienders lines nationwide',
    crisisUrl: 'https://www.befrienders.org.my',
    emergencyPhone: '999',
  }),
  HK: entry('HK', 'Hong Kong', '+852', 'Samaritan Befrienders Hong Kong', '2382 0000', {
    crisisUrl: 'https://www.sbhk.org.hk',
    emergencyPhone: '999',
  }),
  JP: entry('JP', 'Japan', '+81', 'TELL Lifeline', '0570-783-556', {
    crisisUrl: 'https://telljp.com',
    emergencyPhone: '110',
  }),
  KR: entry('KR', 'South Korea', '+82', 'Suicide Prevention Hotline', '109', {
    emergencyPhone: '119',
  }),
  CN: entry('CN', 'China', '+86', 'Beijing Suicide Research & Prevention', '800-810-1117', {
    emergencyPhone: '120',
  }),
  PH: entry('PH', 'Philippines', '+63', 'NCMH Crisis Hotline', '1553', {
    crisisDescription: 'National Center for Mental Health crisis line',
    emergencyPhone: '911',
  }),
  TH: entry('TH', 'Thailand', '+66', 'Samaritans of Thailand', '(02) 713-6793', {
    emergencyPhone: '191',
  }),
  ID: entry('ID', 'Indonesia', '+62', 'Into The Light Indonesia', '119', {
    crisisDescription: 'Mental health crisis support — national emergency 119',
    emergencyPhone: '119',
  }),
  BR: entry('BR', 'Brazil', '+55', 'CVV — Centro de Valorização da Vida', '188', {
    crisisUrl: 'https://www.cvv.org.br',
    emergencyPhone: '192',
  }),
  MX: entry('MX', 'Mexico', '+52', 'Línea de la Vida', '55 1025 5050', {
    emergencyPhone: '911',
  }),
  AR: entry('AR', 'Argentina', '+54', 'Centro de Asistencia al Suicida', '135', {
    emergencyPhone: '911',
  }),
  CL: entry('CL', 'Chile', '+56', 'Salud Responde', '600 360 7777', {
    crisisDescription: 'Verified crisis lines — see national directory for regional options',
    crisisUrl: 'https://www.minsal.cl',
    emergencyPhone: '131',
  }),
  CO: entry('CO', 'Colombia', '+57', 'Línea 106', '(57-1) 323 24 25', {
    emergencyPhone: '123',
  }),
  PE: entry('PE', 'Peru', '+51', 'Línea 100', '381-3695', {
    emergencyPhone: '105',
  }),
};

/** Map E.164 dial prefix → default ISO country (longest match). */
export const DIAL_CODE_TO_COUNTRY: Record<string, string> = {
  '+971': 'AE',
  '+966': 'SA',
  '+974': 'QA',
  '+965': 'KW',
  '+962': 'JO',
  '+961': 'LB',
  '+880': 'BD',
  '+852': 'HK',
  '+358': 'FI',
  '+353': 'IE',
  '+351': 'PT',
  '+254': 'KE',
  '+256': 'UG',
  '+234': 'NG',
  '+972': 'IL',
  '+44': 'GB',
  '+91': 'IN',
  '+92': 'PK',
  '+94': 'LK',
  '+86': 'CN',
  '+82': 'KR',
  '+81': 'JP',
  '+66': 'TH',
  '+65': 'SG',
  '+64': 'NZ',
  '+63': 'PH',
  '+62': 'ID',
  '+61': 'AU',
  '+60': 'MY',
  '+57': 'CO',
  '+56': 'CL',
  '+55': 'BR',
  '+54': 'AR',
  '+52': 'MX',
  '+51': 'PE',
  '+49': 'DE',
  '+48': 'PL',
  '+47': 'NO',
  '+46': 'SE',
  '+45': 'DK',
  '+41': 'CH',
  '+40': 'RO',
  '+39': 'IT',
  '+36': 'HU',
  '+34': 'ES',
  '+33': 'FR',
  '+32': 'BE',
  '+31': 'NL',
  '+30': 'GR',
  '+27': 'ZA',
  '+20': 'EG',
  '+7': 'RU',
  '+1': 'US',
};

export function dialCodeToCountryCode(dialCode: string): string | null {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  const sorted = Object.keys(DIAL_CODE_TO_COUNTRY).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (normalized.startsWith(prefix)) {
      const code = DIAL_CODE_TO_COUNTRY[prefix];
      if (prefix === '+1' && normalized.length > 2) {
        const national = normalized.slice(2).replace(/\D/g, '');
        if (national.startsWith('204') || national.startsWith('226') || national.startsWith('236') ||
            national.startsWith('249') || national.startsWith('250') || national.startsWith('289') ||
            national.startsWith('306') || national.startsWith('343') || national.startsWith('365') ||
            national.startsWith('403') || national.startsWith('416') || national.startsWith('418') ||
            national.startsWith('431') || national.startsWith('437') || national.startsWith('438') ||
            national.startsWith('450') || national.startsWith('506') || national.startsWith('514') ||
            national.startsWith('519') || national.startsWith('548') || national.startsWith('579') ||
            national.startsWith('581') || national.startsWith('587') || national.startsWith('604') ||
            national.startsWith('613') || national.startsWith('639') || national.startsWith('647') ||
            national.startsWith('672') || national.startsWith('705') || national.startsWith('709') ||
            national.startsWith('742') || national.startsWith('778') || national.startsWith('780') ||
            national.startsWith('782') || national.startsWith('807') || national.startsWith('819') ||
            national.startsWith('825') || national.startsWith('867') || national.startsWith('873') ||
            national.startsWith('902') || national.startsWith('905')) {
          return 'CA';
        }
      }
      return code;
    }
  }
  return null;
}

export function countryCodeFromPhoneValue(phone: string): string | null {
  if (!phone?.startsWith('+')) return null;
  const sorted = Object.keys(DIAL_CODE_TO_COUNTRY).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (phone.startsWith(prefix)) {
      return dialCodeToCountryCode(prefix);
    }
  }
  return null;
}

export function isSupportedCrisisCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return countryCode.toUpperCase() in CRISIS_HOTLINES_BY_COUNTRY;
}

export function getCountryHotlineEntry(countryCode: string): CountryHotlineEntry | undefined {
  return CRISIS_HOTLINES_BY_COUNTRY[countryCode.toUpperCase()];
}

export function buildCrisisResourcesForCountry(countryCode: string): CrisisResourceDto[] {
  const config = getCountryHotlineEntry(countryCode);
  if (!config) return [];

  const region = countryCode.toUpperCase();
  const resources: CrisisResourceDto[] = [];

  if (config.emergencyPhone) {
    resources.push({
      id: `${region.toLowerCase()}_emergency`,
      type: 'emergency',
      name: 'Emergency Services',
      description: 'For immediate life-threatening emergencies',
      phone: config.emergencyPhone,
      availability: AVAILABILITY_247,
      region,
    });
  }

  resources.push({
    id: `${region.toLowerCase()}_crisis`,
    type: 'crisis_line',
    name: config.crisisLine.name,
    description: config.crisisLine.description ?? '24/7 crisis and suicide prevention support',
    phone: config.crisisLine.phone,
    url: config.crisisLine.url,
    availability: AVAILABILITY_247,
    region,
  });

  if (config.extras?.length) {
    for (const extra of config.extras) {
      resources.push({
        ...extra,
        availability: AVAILABILITY_247,
        region,
      });
    }
  }

  return resources;
}

export const SUPPORTED_CRISIS_COUNTRY_CODES = Object.keys(CRISIS_HOTLINES_BY_COUNTRY).sort();
