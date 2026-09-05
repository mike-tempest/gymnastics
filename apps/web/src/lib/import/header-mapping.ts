/**
 * Shared header matching for the member import wizards.
 *
 * Clubs import rosters exported from other systems (Swim England lists,
 * Swim Central "Full Members Report", ad-hoc spreadsheets) whose column
 * headers we cannot rely on. Headers are matched case-insensitively,
 * ignoring spaces, underscores, hyphens and a leading BOM, against a
 * dictionary of known synonyms. Unknown columns are never an error; they
 * are simply left unmapped and ignored.
 */

/**
 * Canonical concepts a spreadsheet column can represent. Each import page
 * maps these onto its own field keys, so the synonym dictionary lives in
 * one place.
 */
export type CanonicalImportField =
  | 'first_name'
  | 'last_name'
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
  | 'postcode';

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
  // Last name
  lastname: 'last_name',
  surname: 'last_name',
  familyname: 'last_name',
  memberlastname: 'last_name',
  swimmerlastname: 'last_name',
  gymnastlastname: 'last_name',
  childlastname: 'last_name',
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
  memberid: 'registration_number',
  usaswimmingid: 'registration_number',
  // Governing body
  governingbody: 'governing_body',
  nationalgoverningbody: 'governing_body',
  ngb: 'governing_body',
  // Squad
  squad: 'squad',
  squadname: 'squad',
  group: 'squad',
  traininggroup: 'squad',
  trainingsquad: 'squad',
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
  // Parent email
  parentemail: 'parent_email',
  email: 'parent_email',
  emailaddress: 'parent_email',
  contactemail: 'parent_email',
  guardianemail: 'parent_email',
  parentemailaddress: 'parent_email',
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
