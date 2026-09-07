/**
 * Shared header matching for the import wizards.
 *
 * Clubs import rosters exported from other systems (Swim England lists,
 * Swim Central "Full Members Report", ad-hoc spreadsheets) whose column
 * headers we cannot rely on. Headers are matched case-insensitively,
 * ignoring spaces, underscores, hyphens and a leading BOM, against a
 * dictionary of known synonyms. Unknown columns are never an error; they
 * are simply left unmapped and ignored.
 *
 * The dictionary also covers the incumbent exports catalogued in
 * docs/04-Incumbent-Landscape-Pricing-and-Exports.md: a club's own
 * GoCardless dashboard exports, the per-screen ClassForKids spreadsheets
 * (that vendor publishes no customer or family export at all), and the
 * field-selectable Thrive4 / LoveAdmin contact and payment reports.
 */

/**
 * Canonical concepts a spreadsheet column can represent. Each import page
 * maps these onto its own field keys, so the synonym dictionary lives in
 * one place.
 */
export type CanonicalImportField =
  | 'first_name'
  | 'last_name'
  | 'member_full_name'
  | 'date_of_birth'
  | 'gender'
  | 'registration_number'
  | 'governing_body'
  | 'squad'
  | 'family'
  | 'medical_notes'
  | 'emergency_contact'
  | 'parent_name'
  | 'parent_email'
  | 'parent_phone'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'postcode'
  | 'venue'
  | 'day'
  // Payment-provider concepts, used by the GoCardless takeover wizard.
  | 'provider_customer_id'
  | 'provider_mandate_id'
  | 'provider_payment_id'
  | 'mandate_status'
  | 'mandate_scheme'
  | 'mandate_reference'
  | 'payment_status'
  | 'amount'
  | 'currency'
  | 'charge_date'
  | 'created_at'
  | 'description';

/**
 * Normalise a header for matching: strip any BOM, lowercase, and drop
 * every non-alphanumeric character. "Member Number", "member_number",
 * "member-number" and "MemberNumber" all normalise to "membernumber".
 */
export function normaliseHeader(header: string): string {
  // The catch-all character class also strips a leading BOM (U+FEFF),
  // which Excel prepends to the first header of UTF-8 CSV exports.
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Synonym dictionary keyed on normalised headers. Includes the historical
 * Swimly template headers plus names plausible in Swim England and Swim
 * Central exports.
 */
const HEADER_SYNONYMS: Record<string, CanonicalImportField> = {
  // First name
  firstname: 'first_name',
  givenname: 'first_name',
  preferredname: 'first_name',
  forename: 'first_name',
  memberfirstname: 'first_name',
  // Data-facing synonyms: headers in files clubs already have. Legacy
  // Swimly and Swim Central exports use the old sport-specific noun and
  // gymnastics rosters use theirs; neither can be renamed in the wild.
  swimmerfirstname: 'first_name',
  gymnastfirstname: 'first_name',
  childfirstname: 'first_name',
  // Thrive4 / LoveAdmin contact exports name the participant "Contact";
  // the payer is a separate "Account holder" column (mapped below).
  contactfirstname: 'first_name',
  participantfirstname: 'first_name',
  // Last name
  lastname: 'last_name',
  surname: 'last_name',
  familyname: 'last_name',
  memberlastname: 'last_name',
  swimmerlastname: 'last_name',
  gymnastlastname: 'last_name',
  childlastname: 'last_name',
  contactlastname: 'last_name',
  participantlastname: 'last_name',
  // Combined member name in one column. ClassForKids register and financial
  // spreadsheets carry the child as a single "Child Name" cell, so the
  // importer has to split it rather than read separate name columns.
  // Deliberately no bare 'name' synonym: it is ambiguous in every export
  // that also carries a class, venue or parent name column.
  childname: 'member_full_name',
  childsname: 'member_full_name',
  participantname: 'member_full_name',
  attendeename: 'member_full_name',
  studentname: 'member_full_name',
  pupilname: 'member_full_name',
  gymnastname: 'member_full_name',
  membername: 'member_full_name',
  // Date of birth
  dateofbirth: 'date_of_birth',
  dob: 'date_of_birth',
  birthdate: 'date_of_birth',
  birthday: 'date_of_birth',
  // Gender
  gender: 'gender',
  sex: 'gender',
  // Registration / membership number
  registrationnumber: 'registration_number',
  registrationno: 'registration_number',
  registrationid: 'registration_number',
  senumber: 'registration_number',
  asanumber: 'registration_number',
  asano: 'registration_number',
  membershipnumber: 'registration_number',
  membershipno: 'registration_number',
  membershipid: 'registration_number',
  membernumber: 'registration_number',
  memberno: 'registration_number',
  // Deliberately no 'memberid' synonym: member_id is this platform's own
  // primary-key column in exports, and auto-mapping its UUIDs onto
  // registration_number would silently corrupt re-imported rosters.
  usaswimmingid: 'registration_number',
  // Governing body
  governingbody: 'governing_body',
  nationalgoverningbody: 'governing_body',
  ngb: 'governing_body',
  // Squad. ClassForKids and Thrive4 organise gymnasts by class or group
  // rather than squad; both land on the same concept, and the members
  // import can create a missing squad from the name.
  squad: 'squad',
  squadname: 'squad',
  group: 'squad',
  groups: 'squad',
  groupname: 'squad',
  membergroup: 'squad',
  traininggroup: 'squad',
  trainingsquad: 'squad',
  class: 'squad',
  classname: 'squad',
  classtitle: 'squad',
  session: 'squad',
  sessionname: 'squad',
  // Family / household grouping
  family: 'family',
  household: 'family',
  householdname: 'family',
  // Medical notes
  medicalnotes: 'medical_notes',
  medical: 'medical_notes',
  medicalconditions: 'medical_notes',
  medicalinfo: 'medical_notes',
  // Emergency contact
  emergencycontact: 'emergency_contact',
  emergencycontactname: 'emergency_contact',
  emergencycontactdetails: 'emergency_contact',
  emergencycontactnumber: 'emergency_contact',
  // Parent / guardian name
  parentname: 'parent_name',
  parent: 'parent_name',
  guardian: 'parent_name',
  guardianname: 'parent_name',
  parentguardianname: 'parent_name',
  contactname: 'parent_name',
  // Thrive4 / LoveAdmin and GoCardless call the bill payer the account
  // holder or payer; ClassForKids financial spreadsheets say "Parent".
  accountholder: 'parent_name',
  accountholdername: 'parent_name',
  payer: 'parent_name',
  payername: 'parent_name',
  billingcontact: 'parent_name',
  billingcontactname: 'parent_name',
  // Parent email
  parentemail: 'parent_email',
  email: 'parent_email',
  emailaddress: 'parent_email',
  contactemail: 'parent_email',
  guardianemail: 'parent_email',
  parentemailaddress: 'parent_email',
  accountholderemail: 'parent_email',
  payeremail: 'parent_email',
  billingemail: 'parent_email',
  // Parent phone
  parentphone: 'parent_phone',
  phone: 'parent_phone',
  phonenumber: 'parent_phone',
  mobile: 'parent_phone',
  mobilenumber: 'parent_phone',
  mobilephone: 'parent_phone',
  telephone: 'parent_phone',
  contactnumber: 'parent_phone',
  parentmobile: 'parent_phone',
  accountholdermobile: 'parent_phone',
  payermobile: 'parent_phone',
  homephone: 'parent_phone',
  homephonenumber: 'parent_phone',
  daytimephone: 'parent_phone',
  // Address
  addressline1: 'address_line1',
  address1: 'address_line1',
  address: 'address_line1',
  streetaddress: 'address_line1',
  street: 'address_line1',
  addressline2: 'address_line2',
  address2: 'address_line2',
  city: 'city',
  town: 'city',
  towncity: 'city',
  suburb: 'city',
  locality: 'city',
  postcode: 'postcode',
  postalcode: 'postcode',
  zip: 'postcode',
  zipcode: 'postcode',
  // Venue and day. ClassForKids spreadsheets carry both; neither maps onto
  // a field yet, so they are surfaced in the preview as context that helps
  // a club recognise its own classes.
  venue: 'venue',
  location: 'venue',
  centre: 'venue',
  venuename: 'venue',
  day: 'day',
  dayofweek: 'day',
  classday: 'day',
  // GoCardless dashboard exports. The bare "id" column means a different
  // thing in each of the three files, so it is deliberately absent here and
  // resolved per file by the takeover wizard instead.
  customerid: 'provider_customer_id',
  customersid: 'provider_customer_id',
  gocardlesscustomerid: 'provider_customer_id',
  customer: 'provider_customer_id',
  mandateid: 'provider_mandate_id',
  mandatesid: 'provider_mandate_id',
  gocardlessmandateid: 'provider_mandate_id',
  mandate: 'provider_mandate_id',
  paymentid: 'provider_payment_id',
  paymentsid: 'provider_payment_id',
  mandatestatus: 'mandate_status',
  scheme: 'mandate_scheme',
  mandatescheme: 'mandate_scheme',
  reference: 'mandate_reference',
  mandatereference: 'mandate_reference',
  paymentstatus: 'payment_status',
  createdat: 'created_at',
  datecreated: 'created_at',
  created: 'created_at',
  chargedate: 'charge_date',
  paymentdate: 'charge_date',
  datepaid: 'charge_date',
  currency: 'currency',
  description: 'description',
  paymentdescription: 'description',
  // Money columns. ClassForKids financial spreadsheets carry several; they
  // feed no field yet (there is no fee import) and are shown as
  // informational totals only.
  amount: 'amount',
  amountpaid: 'amount',
  amountdue: 'amount',
  totalpaid: 'amount',
  outstanding: 'amount',
  balance: 'amount',
  income: 'amount',
  price: 'amount',
};

/** The canonical concept a header refers to, or null when unknown. */
export function matchHeader(header: string): CanonicalImportField | null {
  return HEADER_SYNONYMS[normaliseHeader(header)] ?? null;
}

/** One target field of an import page, for auto-mapping. */
export interface AutoMapField<F extends string> {
  /** The page's own field key (also matched verbatim against headers). */
  key: F;
  /** The canonical concept this field represents, if any. */
  canonical: CanonicalImportField | null;
}

/**
 * Guess a mapping from target fields to uploaded column headers.
 *
 * Two passes: exact matches on the page's own field keys win first (so a
 * file built from the Swimly template always maps to itself), then
 * synonyms claim the remaining headers in file order. Each header is used
 * at most once and headers that match nothing are ignored.
 */
export function autoMapHeaders<F extends string>(
  headers: readonly string[],
  fields: readonly AutoMapField<F>[],
): Partial<Record<F, string>> {
  const mapping: Partial<Record<F, string>> = {};
  const claimed = new Set<string>();

  for (const field of fields) {
    const exact = headers.find(
      (h) => !claimed.has(h) && normaliseHeader(h) === normaliseHeader(field.key),
    );
    if (exact !== undefined) {
      mapping[field.key] = exact;
      claimed.add(exact);
    }
  }

  for (const header of headers) {
    if (claimed.has(header)) continue;
    const canonical = matchHeader(header);
    if (!canonical) continue;
    const field = fields.find((f) => f.canonical === canonical && mapping[f.key] === undefined);
    if (!field) continue;
    mapping[field.key] = header;
    claimed.add(header);
  }

  return mapping;
}

/**
 * Normalise a gender value to one of the allowed codes, or null.
 * Accepts the code itself or common words (male, female, other) in any case.
 */
export function normaliseGender(
  value: string,
  allowed: readonly string[] = ['M', 'F', 'X'],
): string | null {
  const lower = value.trim().toLowerCase();
  let code: string | null = null;
  if (lower === 'm' || lower === 'male' || lower === 'boy') code = 'M';
  else if (lower === 'f' || lower === 'female' || lower === 'girl') code = 'F';
  else if (lower === 'x' || lower === 'other' || lower === 'non-binary' || lower === 'nonbinary') {
    code = 'X';
  }
  return code && allowed.includes(code) ? code : null;
}
