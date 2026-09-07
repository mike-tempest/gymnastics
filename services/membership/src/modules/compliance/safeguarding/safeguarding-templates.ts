import { GoverningBody, governingBodyConfig } from '@club-manager/shared-types';

/**
 * A single safeguarding checklist requirement, before it is persisted for a
 * club. Only the human-readable fields live here; the id, club_id, completed
 * flag and timestamps are supplied by the database when the template is seeded.
 */
export interface SafeguardingChecklistTemplateItem {
  requirement: string;
  description: string;
}

/**
 * Swim England Wavepower checklist. These strings are the regression bar for
 * existing GB clubs: they reproduce, verbatim, the requirement and description
 * text that the service previously returned as hardcoded mock data. Do not
 * reword them without a migration plan for clubs already seeded from this list.
 */
const SWIM_ENGLAND_TEMPLATE: SafeguardingChecklistTemplateItem[] = [
  {
    requirement: 'Swim England Wavepower 2024-2028 Policy Review',
    description:
      'Annual review and acknowledgement of Swim England Wavepower safeguarding policies and procedures',
  },
  {
    requirement: 'Welfare Officer Appointment',
    description: 'Designated Welfare Officer appointed and contact details published to members',
  },
  {
    requirement: 'DBS Checks for All Coaches',
    description:
      'Enhanced DBS checks completed for all coaches and volunteers working with children',
  },
  {
    requirement: 'Safeguarding Training Completion',
    description:
      'All coaches and committee members to complete Swim England safeguarding training (Time to Listen)',
  },
  {
    requirement: 'Photography and Filming Consent',
    description: 'Parental consent obtained for photography/filming at training and competitions',
  },
  {
    requirement: 'Changing Room Supervision Policy',
    description: 'Clear policy in place for changing room supervision and adult-to-child ratios',
  },
  {
    requirement: 'Incident Reporting Procedure',
    description:
      'Documented procedure for reporting safeguarding concerns and incidents to Swim England',
  },
  {
    requirement: 'Code of Conduct Acknowledgement',
    description:
      'All members, parents, and coaches to sign and acknowledge the club Code of Conduct',
  },
];

/**
 * USA Swimming SafeSport-aligned checklist. Wording follows the MAAPP
 * (Minor Athlete Abuse Prevention Policy) and the U.S. Center for SafeSport
 * requirements that USA Swimming clubs are held to.
 */
const USA_SWIMMING_TEMPLATE: SafeguardingChecklistTemplateItem[] = [
  {
    requirement: 'MAAPP Policy Review',
    description:
      'Annual review and acknowledgement of the Minor Athlete Abuse Prevention Policy and USA Swimming Safe Sport procedures',
  },
  {
    requirement: 'SafeSport Certification for Coaches',
    description:
      'Current U.S. Center for SafeSport training certification completed for all coaches and non-athlete members',
  },
  {
    requirement: 'Background Checks for All Coaches',
    description:
      'USA Swimming background checks completed for all coaches and volunteers working with athletes',
  },
  {
    requirement: 'Athlete Protection Training',
    description:
      'All coaches and committee members to complete USA Swimming athlete-protection training',
  },
  {
    requirement: 'Photography and Filming Consent',
    description:
      'Parental consent obtained for photography and filming at training and competitions',
  },
  {
    requirement: 'Locker Room Supervision Policy',
    description: 'Clear policy in place for locker-room supervision consistent with MAAPP',
  },
  {
    requirement: 'Incident Reporting Procedure',
    description:
      'Documented procedure for reporting safeguarding concerns and incidents to the U.S. Center for SafeSport and USA Swimming',
  },
  {
    requirement: 'Code of Conduct Acknowledgement',
    description:
      'All members, parents, and coaches to sign and acknowledge the club Code of Conduct',
  },
];

/**
 * Swimming Australia checklist. Australian clubs sit under Sport Integrity
 * Australia's National Integrity Framework: the Child Safeguarding Policy,
 * an appointed MPIO (Member Protection Information Officer), state and
 * territory Working With Children Checks, and the national Child Safe
 * Standards.
 */
const SWIMMING_AUSTRALIA_TEMPLATE: SafeguardingChecklistTemplateItem[] = [
  {
    requirement: 'Child Safeguarding Policy Review',
    description:
      "Annual review and acknowledgement of the Swimming Australia Child Safeguarding Policy under Sport Integrity Australia's National Integrity Framework",
  },
  {
    requirement: 'MPIO Appointment',
    description:
      'Member Protection Information Officer (MPIO) appointed and contact details published to members',
  },
  {
    requirement: 'WWCC Verification for All Coaches and Volunteers',
    description:
      'Current state or territory Working With Children Check (or equivalent) verified and recorded for all coaches and volunteers working with children',
  },
  {
    requirement: 'Safe Sport Training Completion',
    description:
      'All coaches and committee members to complete Sport Integrity Australia Safe Sport or Play by the Rules child-safeguarding training',
  },
  {
    requirement: 'Photography and Filming Consent',
    description:
      'Parental consent obtained for photography and filming at training and competitions',
  },
  {
    requirement: 'Changing Room Supervision Policy',
    description: 'Clear policy in place for changing-room supervision and adult-to-child ratios',
  },
  {
    requirement: 'Incident Reporting Procedure',
    description:
      'Documented procedure for reporting safeguarding concerns and incidents to Swimming Australia and Sport Integrity Australia',
  },
  {
    requirement: 'Code of Conduct Acknowledgement',
    description:
      'All members, parents, and coaches to sign and acknowledge the club Code of Conduct',
  },
  {
    requirement: 'Member Protection Policy Acknowledgement',
    description:
      'All members, parents, and coaches to acknowledge the Swimming Australia Member Protection Policy',
  },
  {
    requirement: 'Child Safe Standards Self-Assessment',
    description:
      'Annual self-assessment against the National Principles for Child Safe Organisations',
  },
];

/**
 * British Gymnastics checklist. BG publishes no Wavepower-style branded
 * suite: the governing document is the Safeguarding and Protecting Children
 * Policy, sitting under BG's "Safe & Fair Sport" programme. Every registered
 * club must nominate a Welfare Officer, and criminal record checks are
 * administered through British Gymnastics using the home-nation scheme (DBS
 * in England and Wales, PVG in Scotland, AccessNI in Northern Ireland).
 */
const BRITISH_GYMNASTICS_TEMPLATE: SafeguardingChecklistTemplateItem[] = [
  {
    requirement: 'Safeguarding and Protecting Children Policy Review',
    description:
      'Annual review and acknowledgement of the British Gymnastics Safeguarding and Protecting Children Policy under Safe & Fair Sport',
  },
  {
    requirement: 'Welfare Officer Appointment',
    description: 'Nominated Welfare Officer appointed and contact details published to members',
  },
  {
    requirement: 'Criminal Record Checks for All Coaches',
    description:
      'Criminal record checks (DBS, PVG or AccessNI as applicable) completed through British Gymnastics for all coaches and volunteers working with children',
  },
  {
    requirement: 'Safeguarding Training Completion',
    description:
      'All coaches and committee members to complete British Gymnastics safeguarding training',
  },
  {
    requirement: 'Photography and Filming Consent',
    description:
      'Parental consent obtained for photography and filming at training and competitions',
  },
  {
    requirement: 'Changing Room Supervision Policy',
    description: 'Clear policy in place for changing-room supervision and adult-to-child ratios',
  },
  {
    requirement: 'Incident Reporting Procedure',
    description:
      'Documented procedure for reporting safeguarding concerns and incidents to the British Gymnastics Safe & Fair Sport team',
  },
  {
    requirement: 'Code of Conduct Acknowledgement',
    description:
      'All members, parents, and coaches to sign and acknowledge the club Code of Conduct',
  },
];

/**
 * Generic template for governing bodies without a hand-authored checklist.
 * The framework name and label come from the body's config, so each body
 * reports its own safeguarding framework, background-check regime and name.
 */
function genericTemplate(body: GoverningBody): SafeguardingChecklistTemplateItem[] {
  const config = governingBodyConfig(body);
  return [
    {
      requirement: `${config.safeguardingFramework} Policy Review`,
      description: `Annual review and acknowledgement of ${config.label} ${config.safeguardingFramework} safeguarding policies and procedures`,
    },
    {
      requirement: 'Welfare Officer Appointment',
      description: 'Designated welfare officer appointed and contact details published to members',
    },
    {
      requirement: 'Background Checks for All Coaches',
      description: `${config.backgroundCheckFramework} background checks completed for all coaches and volunteers working with children`,
    },
    {
      requirement: 'Safeguarding Training Completion',
      description: `All coaches and committee members to complete ${config.label} safeguarding training`,
    },
    {
      requirement: 'Photography and Filming Consent',
      description:
        'Parental consent obtained for photography and filming at training and competitions',
    },
    {
      requirement: 'Changing Room Supervision Policy',
      description: 'Clear policy in place for changing-room supervision and adult-to-child ratios',
    },
    {
      requirement: 'Incident Reporting Procedure',
      description: `Documented procedure for reporting safeguarding concerns and incidents to ${config.label}`,
    },
    {
      requirement: 'Code of Conduct Acknowledgement',
      description:
        'All members, parents, and coaches to sign and acknowledge the club Code of Conduct',
    },
  ];
}

/**
 * Returns the safeguarding checklist template for a governing body. Swim
 * England, USA Swimming, Swimming Australia and British Gymnastics have
 * hand-authored lists; every other body gets a generic list adapted to its
 * own framework and label. An unknown or null body falls back to Swim
 * England, matching governingBodyConfig's fallback. Templates seed persisted
 * rows per club on first read, so changes affect newly seeded clubs only.
 */
export function getSafeguardingTemplate(
  body?: GoverningBody | string | null,
): SafeguardingChecklistTemplateItem[] {
  switch (body) {
    case GoverningBody.SWIM_ENGLAND:
      return SWIM_ENGLAND_TEMPLATE;
    case GoverningBody.USA_SWIMMING:
      return USA_SWIMMING_TEMPLATE;
    case GoverningBody.SWIMMING_AUSTRALIA:
      return SWIMMING_AUSTRALIA_TEMPLATE;
    case GoverningBody.BRITISH_GYMNASTICS:
      return BRITISH_GYMNASTICS_TEMPLATE;
    case GoverningBody.SCOTTISH_SWIMMING:
    case GoverningBody.SWIM_WALES:
    case GoverningBody.SWIM_IRELAND:
    case GoverningBody.SWIMMING_CANADA:
      return genericTemplate(body);
    default:
      // British Gymnastics is this product's default governing body, so an
      // unset or unknown body seeds the BG checklist rather than Wavepower.
      return BRITISH_GYMNASTICS_TEMPLATE;
  }
}
