"use client";

import { defaultGoverningBodyForCountry, governingBodyConfig } from "@club-manager/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { useClubRegion } from "@/hooks/useClubRegion";
import {
  onboardingExited,
  onboardingLaunched,
  onboardingStarted,
  onboardingStepCompleted,
  onboardingStepSkipped,
  onboardingStepViewed,
  type OnboardingStep,
} from "@/lib/analytics";
import { createMember } from "@/lib/api/members";
import { updateClubSettings } from "@/lib/api/settings";
import { createSquad } from "@/lib/api/squads";
import { BRAND } from "@/lib/brand";
import { isValidPhone } from "@/lib/utils/postal";
import { countyLabel } from "@/lib/utils/region-labels";

// Typed step names that mirror STEP_LABELS, used in analytics events.
const STEP_NAMES: OnboardingStep["name"][] = [
  "club_details",
  "venues",
  "squads",
  "import_members",
  "invite_staff",
  "review",
];

function stepFor(index: number): OnboardingStep {
  return { index, name: STEP_NAMES[index] ?? "review" };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Venue {
  id: string;
  name: string;
  address: string;
  laneCount: number;
  poolLength: number;
}

interface Squad {
  id: string;
  name: string;
  minAge: number | "";
  maxAge: number | "";
  description: string;
  trainingTimes: string;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "COACH";
}

interface ClubData {
  clubName: string;
  affiliationNumber: string;
  county: string;
  contactEmail: string;
  phone: string;
  website: string;
}

// ---------------------------------------------------------------------------
// Zod schemas (per step)
// ---------------------------------------------------------------------------

const clubSchema = z.object({
  clubName: z.string().min(1, "Please enter your club name"),
  affiliationNumber: z.string(),
  county: z.string(),
  contactEmail: z.string().min(1, "Please enter a contact email address").email("Please enter a valid email address"),
  phone: z.string().refine((val) => {
    if (!val || val.trim() === "") return true;
    return isValidPhone(val);
  }, "Please enter a valid phone number"),
  website: z.string().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
      const url = val.startsWith("http") ? val : `https://${val}`;
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, "Please enter a valid website address (e.g. www.yourclub.co.uk)"),
});

const venueSchema = z.object({
  name: z.string().min(1, "Please enter the venue name"),
});

const squadSchema = z.object({
  name: z.string().min(1, "Please enter the squad name"),
});

const staffEmailSchema = z.string().min(1, "Please enter an email address").email("Please enter a valid email address");

// ---------------------------------------------------------------------------
// CSV column mapping types
// ---------------------------------------------------------------------------

type CsvMappableField = "first_name" | "last_name" | "dob" | "gender";

const CSV_FIELDS: { key: CsvMappableField; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "dob", label: "Date of birth" },
  { key: "gender", label: "Gender" },
];

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const INPUT_CLASS =
  "w-full min-h-[48px] bg-dark-primary border border-white/20 text-white rounded-button px-4 py-3 text-base focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all";

const LABEL_CLASS = "block text-sm font-bold text-white/90 mb-2";

const primaryBtnClass = "min-h-[48px] bg-brand text-dark-primary font-bold rounded-button px-6 py-3 cursor-pointer hover:bg-brand-dark transition-colors focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50";
const backBtnClass = "min-h-[48px] border border-white/20 text-white rounded-button px-6 py-3 bg-transparent cursor-pointer hover:bg-white/5 transition-colors";

const STEP_LABELS = [
  "Club Details",
  "Venues",
  "Squads",
  "Import Members",
  "Invite Staff",
  "Review",
];

// ---------------------------------------------------------------------------
// Helper: generate ID
// ---------------------------------------------------------------------------

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString();
}

// ---------------------------------------------------------------------------
// Stepper component
// ---------------------------------------------------------------------------

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full mb-10">
      {/* Mobile: simple "Step X of Y" */}
      <p className="text-center text-white/70 text-sm mb-4 sm:hidden">
        Step {current + 1} of {total}
      </p>

      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-center justify-between">
        {STEP_LABELS.map((label, idx) => {
          const isCompleted = idx < current;
          const isCurrent = idx === current;
          return (
            <div key={label} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 ${idx <= current ? "bg-brand" : "bg-white/15"}`}
                />
              )}

              {/* Circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isCurrent || isCompleted
                    ? "bg-brand text-dark-primary"
                    : "border-2 border-white/30 text-white/70"
                }`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-xs text-center ${isCurrent ? "text-brand" : "text-white/70"}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  // Region-aware copy. Defaults to GB (Swim England, "County") while the club
  // region loads or for clubs on older backends without a country.
  const { country } = useClubRegion();
  const governingBody = governingBodyConfig(defaultGoverningBodyForCountry(country));
  const regionFieldLabel = countyLabel(country);
  const isGB = country === "GB";
  const regionFieldHelp = isGB
    ? "Your county association, e.g. Kent County ASA"
    : `Your ${regionFieldLabel.toLowerCase()} swimming association, if you have one.`;

  // Analytics: timing + tally for the funnel events.
  const wizardStartedAt = useRef<number>(Date.now());
  const stepStartedAt = useRef<number>(Date.now());
  const stepsCompleted = useRef<number>(0);
  const stepsSkipped = useRef<number>(0);

  // Fire onboarding_started once, and onboarding_step_viewed each time the
  // visible step changes.
  useEffect(() => {
    onboardingStarted();
  }, []);
  useEffect(() => {
    onboardingStepViewed(stepFor(step));
    stepStartedAt.current = Date.now();
  }, [step]);

  // Step 1: Club details
  const [clubData, setClubData] = useState<ClubData>({
    clubName: "",
    affiliationNumber: "",
    county: "",
    contactEmail: "",
    phone: "",
    website: "",
  });

  // Step 2: Venues
  const [venues, setVenues] = useState<Venue[]>([]);

  // Step 3: Squads
  const [squads, setSquads] = useState<Squad[]>([]);

  // Step 4: Members
  const [members, setMembers] = useState<Member[]>([]);
  const [importTab, setImportTab] = useState<"csv" | "manual">("csv");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<CsvMappableField, string>>({
    first_name: "",
    last_name: "",
    dob: "",
    gender: "",
  });
  const [manualMember, setManualMember] = useState({ firstName: "", lastName: "", dob: "", gender: "M" });

  // Step 5: Staff
  const [staff, setStaff] = useState<StaffMember[]>([]);

  // Step errors (supports nested keys like "venue-<id>" and "squad-<id>")
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------- Validation ----------

  const validateStep = useCallback((): boolean => {
    setErrors({});
    const fieldErrors: Record<string, string> = {};

    if (step === 0) {
      const result = clubSchema.safeParse(clubData);
      if (!result.success) {
        result.error.errors.forEach((e) => {
          const field = e.path[0];
          if (typeof field === "string") fieldErrors[field] = e.message;
        });
        setErrors(fieldErrors);
        return false;
      }
    }

    if (step === 1) {
      let hasError = false;
      for (const venue of venues) {
        const result = venueSchema.safeParse(venue);
        if (!result.success) {
          fieldErrors[`venue-${venue.id}-name`] = "Please enter a name for this venue";
          hasError = true;
        }
      }
      if (hasError) {
        setErrors(fieldErrors);
        return false;
      }
    }

    if (step === 2) {
      let hasError = false;
      for (const squad of squads) {
        const result = squadSchema.safeParse(squad);
        if (!result.success) {
          fieldErrors[`squad-${squad.id}-name`] = "Please enter a name for this squad";
          hasError = true;
        }
        if (squad.minAge !== "" && squad.maxAge !== "" && Number(squad.minAge) > Number(squad.maxAge)) {
          fieldErrors[`squad-${squad.id}-age`] = "Minimum age cannot be greater than maximum age";
          hasError = true;
        }
      }
      if (hasError) {
        setErrors(fieldErrors);
        return false;
      }
    }

    // Step 3 (members) is optional

    if (step === 4) {
      let hasError = false;
      for (const member of staff) {
        const result = staffEmailSchema.safeParse(member.email);
        if (!result.success) {
          fieldErrors[`staff-${member.id}-email`] = result.error.errors[0]?.message || "Please enter a valid email address";
          hasError = true;
        }
      }
      if (hasError) {
        setErrors(fieldErrors);
        return false;
      }
    }

    return true;
  }, [step, clubData, venues, squads, staff]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    onboardingStepCompleted(stepFor(step), Date.now() - stepStartedAt.current);
    stepsCompleted.current += 1;
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }, [validateStep, step]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // ---------- Venue helpers ----------

  const addVenue = () =>
    setVenues((prev) => [...prev, { id: genId(), name: "", address: "", laneCount: 0, poolLength: 0 }]);

  const removeVenue = (id: string) => setVenues((prev) => prev.filter((v) => v.id !== id));

  const updateVenue = (id: string, field: keyof Venue, value: string | number) =>
    setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));

  // ---------- Squad helpers ----------

  const addSquad = () =>
    setSquads((prev) => [...prev, { id: genId(), name: "", minAge: "", maxAge: "", description: "", trainingTimes: "" }]);

  const removeSquad = (id: string) => setSquads((prev) => prev.filter((s) => s.id !== id));

  const updateSquad = (id: string, field: keyof Squad, value: string | number) =>
    setSquads((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  // ---------- CSV helpers ----------

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data;
        if (rows.length < 2) {
          toast.error("CSV must have a header row and at least one data row.");
          return;
        }
        const headers = rows[0];
        setCsvHeaders(headers);
        setCsvRows(rows.slice(1));

        // Auto-map columns by common names
        const autoMap: Record<CsvMappableField, string> = { first_name: "", last_name: "", dob: "", gender: "" };
        headers.forEach((h) => {
          const lower = h.toLowerCase().replace(/[^a-z]/g, "");
          if (lower.includes("first")) autoMap.first_name = h;
          else if (lower.includes("last") || lower.includes("surname")) autoMap.last_name = h;
          else if (lower.includes("dob") || lower.includes("birth") || lower.includes("date")) autoMap.dob = h;
          else if (lower.includes("gender") || lower.includes("sex")) autoMap.gender = h;
        });
        setCsvMapping(autoMap);
      },
      error(err) {
        toast.error(`CSV parse error: ${err.message}`);
      },
    });
  };

  const applyCsvMapping = () => {
    if (!csvMapping.first_name || !csvMapping.last_name) {
      toast.error("Please map at least first name and last name columns.");
      return;
    }
    const headerIndex = (col: string) => csvHeaders.indexOf(col);
    const mapped: Member[] = csvRows
      .map((row) => ({
        id: genId(),
        firstName: row[headerIndex(csvMapping.first_name)] ?? "",
        lastName: row[headerIndex(csvMapping.last_name)] ?? "",
        dob: csvMapping.dob ? (row[headerIndex(csvMapping.dob)] ?? "") : "",
        gender: csvMapping.gender ? (row[headerIndex(csvMapping.gender)] ?? "") : "",
      }))
      .filter((s) => s.firstName || s.lastName);

    setMembers((prev) => [...prev, ...mapped]);
    toast.success(`Imported ${mapped.length} member${mapped.length === 1 ? "" : "s"}.`);
    setCsvHeaders([]);
    setCsvRows([]);
  };

  // ---------- Manual member ----------

  const addManualMember = () => {
    if (!manualMember.firstName || !manualMember.lastName) {
      toast.error("First name and last name are required.");
      return;
    }
    setMembers((prev) => [...prev, { id: genId(), ...manualMember }]);
    setManualMember({ firstName: "", lastName: "", dob: "", gender: "M" });
  };

  const removeMember = (id: string) => setMembers((prev) => prev.filter((s) => s.id !== id));

  // ---------- Staff helpers ----------

  const addStaff = () =>
    setStaff((prev) => [...prev, { id: genId(), firstName: "", lastName: "", email: "", role: "COACH" }]);

  const removeStaff = (id: string) => setStaff((prev) => prev.filter((s) => s.id !== id));

  const updateStaff = (id: string, field: keyof StaffMember, value: string) =>
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  // ---------- Launch ----------

  const handleLaunch = async () => {
    setLaunching(true);

    try {
      // 1. Club settings
      await updateClubSettings({
        club_name: clubData.clubName,
        contact_email: clubData.contactEmail,
        phone: clubData.phone,
        website: clubData.website,
        swim_england: {
          affiliationNumber: clubData.affiliationNumber,
          county: clubData.county,
        },
        locations: venues.map((v) => ({
          id: "",
          name: v.name,
          address: v.address,
          laneCount: v.laneCount,
        })),
      });

      // 2. Squads
      for (const squad of squads) {
        await createSquad({
          squad_name: squad.name,
          description: squad.description || undefined,
          min_age: squad.minAge === "" ? null : squad.minAge,
          max_age: squad.maxAge === "" ? null : squad.maxAge,
          training_times: squad.trainingTimes || undefined,
        });
      }

      // 3. Members
      for (const member of members) {
        await createMember({
          first_name: member.firstName,
          last_name: member.lastName,
          dob: member.dob,
          gender: member.gender,
        });
      }

      // 4. Staff invitations (queued for sending once staff invitation API is available)
      if (staff.length > 0) {
        toast.info(`${staff.length} staff invitation${staff.length === 1 ? "" : "s"} will be sent shortly.`);
      }

      onboardingLaunched({
        ms_total: Date.now() - wizardStartedAt.current,
        steps_completed: stepsCompleted.current,
        steps_skipped: stepsSkipped.current,
      });

      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setLaunching(false);
    }
  };

  // ---------- Review summary helpers ----------

  const summaryItems = useMemo(
    () => [
      { label: "Club name", value: clubData.clubName },
      { label: "Contact email", value: clubData.contactEmail },
      { label: "Phone", value: clubData.phone || "Not set" },
      { label: "Website", value: clubData.website || "Not set" },
      { label: "Affiliation number", value: clubData.affiliationNumber || "Not set" },
      { label: regionFieldLabel, value: clubData.county || "Not set" },
    ],
    [clubData, regionFieldLabel],
  );

  // ---------- Render helpers ----------

  const renderClubDetails = () => (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-white tracking-tight mb-4">Club Details</h2>

      <div>
        <label className={LABEL_CLASS}>Club name *</label>
        <input
          className={INPUT_CLASS}
          value={clubData.clubName}
          placeholder="e.g. RTW Monson Swimming Club"
          onChange={(e) => setClubData((d) => ({ ...d, clubName: e.target.value }))}
        />
        {errors.clubName && <p className="text-danger text-sm mt-1">{errors.clubName}</p>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Affiliation number</label>
        <input
          className={INPUT_CLASS}
          value={clubData.affiliationNumber}
          onChange={(e) => setClubData((d) => ({ ...d, affiliationNumber: e.target.value }))}
        />
        <p className="text-white/50 text-xs mt-1">Your {governingBody.label} club affiliation number (if known). You can add this later.</p>
      </div>

      <div>
        <label className={LABEL_CLASS}>{regionFieldLabel}</label>
        <input
          className={INPUT_CLASS}
          value={clubData.county}
          onChange={(e) => setClubData((d) => ({ ...d, county: e.target.value }))}
        />
        <p className="text-white/50 text-xs mt-1">{regionFieldHelp}</p>
      </div>

      <div>
        <label className={LABEL_CLASS}>Contact email *</label>
        <input
          type="email"
          autoComplete="email"
          className={INPUT_CLASS}
          value={clubData.contactEmail}
          onChange={(e) => setClubData((d) => ({ ...d, contactEmail: e.target.value }))}
        />
        {errors.contactEmail && <p className="text-danger text-sm mt-1">{errors.contactEmail}</p>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Phone</label>
        <input
          type="tel"
          autoComplete="tel"
          className={INPUT_CLASS}
          value={clubData.phone}
          onChange={(e) => setClubData((d) => ({ ...d, phone: e.target.value }))}
        />
        {errors.phone && <p className="text-danger text-sm mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Website</label>
        <input
          className={INPUT_CLASS}
          value={clubData.website}
          placeholder="e.g. www.yourclub.co.uk"
          onChange={(e) => setClubData((d) => ({ ...d, website: e.target.value }))}
        />
        {errors.website && <p className="text-danger text-sm mt-1">{errors.website}</p>}
      </div>
    </div>
  );

  const renderVenues = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-2xl text-white tracking-tight">Venues</h2>
        <button type="button" className={primaryBtnClass} onClick={addVenue}>
          Add Venue
        </button>
      </div>
      <p className="text-white/50 text-sm mb-4">Add your pool or pools. You can always add more later.</p>

      {venues.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
          <p className="text-white/70 text-sm mb-4">
            Most clubs train at one or two pools. If you are not sure, skip this step and add venues later from Settings.
          </p>
          <button type="button" className={primaryBtnClass} onClick={addVenue}>
            Add Venue
          </button>
        </div>
      )}

      {venues.map((venue) => (
        <div key={venue.id} className="bg-dark-primary rounded-xl p-4 space-y-3 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">{venue.name || "New venue"}</span>
            <button
              type="button"
              className="text-danger hover:text-danger/80 text-sm cursor-pointer"
              onClick={() => removeVenue(venue.id)}
            >
              Remove
            </button>
          </div>

          <div>
            <label className={LABEL_CLASS}>Name *</label>
            <input
              className={INPUT_CLASS}
              value={venue.name}
              onChange={(e) => updateVenue(venue.id, "name", e.target.value)}
            />
            {errors[`venue-${venue.id}-name`] && <p className="text-danger text-sm mt-1">{errors[`venue-${venue.id}-name`]}</p>}
          </div>

          <div>
            <label className={LABEL_CLASS}>Address</label>
            <input
              className={INPUT_CLASS}
              value={venue.address}
              onChange={(e) => updateVenue(venue.id, "address", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Lane count</label>
              <input
                type="number"
                min={0}
                className={INPUT_CLASS}
                value={venue.laneCount || ""}
                onChange={(e) => updateVenue(venue.id, "laneCount", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Pool length (m)</label>
              <input
                type="number"
                min={0}
                className={INPUT_CLASS}
                value={venue.poolLength || ""}
                onChange={(e) => updateVenue(venue.id, "poolLength", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSquads = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-2xl text-white tracking-tight">Squads</h2>
        <button type="button" className={primaryBtnClass} onClick={addSquad}>
          Add Squad
        </button>
      </div>
      <p className="text-white/50 text-sm mb-4">Squads help you organise members by age or ability. e.g. Learn to Swim, Development, Competition.</p>

      {squads.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
          <p className="text-white/70 text-sm mb-4">
            Squads help organise members by age or ability. Common examples: Learn to Swim, Development, Competition, Masters.
          </p>
          <button type="button" className={primaryBtnClass} onClick={addSquad}>
            Add Squad
          </button>
        </div>
      )}

      {squads.map((squad) => (
        <div key={squad.id} className="bg-dark-primary rounded-xl p-4 space-y-3 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">{squad.name || "New squad"}</span>
            <button
              type="button"
              className="text-danger hover:text-danger/80 text-sm cursor-pointer"
              onClick={() => removeSquad(squad.id)}
            >
              Remove
            </button>
          </div>

          <div>
            <label className={LABEL_CLASS}>Name *</label>
            <input
              className={INPUT_CLASS}
              value={squad.name}
              onChange={(e) => updateSquad(squad.id, "name", e.target.value)}
            />
            {errors[`squad-${squad.id}-name`] && <p className="text-danger text-sm mt-1">{errors[`squad-${squad.id}-name`]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Min age</label>
              <input
                type="number"
                min={0}
                className={INPUT_CLASS}
                value={squad.minAge}
                onChange={(e) => updateSquad(squad.id, "minAge", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Max age</label>
              <input
                type="number"
                min={0}
                className={INPUT_CLASS}
                value={squad.maxAge}
                onChange={(e) => updateSquad(squad.id, "maxAge", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              />
            </div>
            {errors[`squad-${squad.id}-age`] && <p className="text-danger text-sm mt-1 col-span-2">{errors[`squad-${squad.id}-age`]}</p>}
          </div>

          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={squad.description}
              onChange={(e) => updateSquad(squad.id, "description", e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Training times</label>
            <input
              className={INPUT_CLASS}
              placeholder="e.g. Mon/Wed 18:00-19:30"
              value={squad.trainingTimes}
              onChange={(e) => updateSquad(squad.id, "trainingTimes", e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderImportMembers = () => (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-white tracking-tight mb-1">Import Members</h2>
      <p className="text-white/50 text-sm mb-1">Import your existing member list from a CSV, or add them manually. You can skip this for now and add members later.</p>
      <p className="text-white/50 text-xs mb-4">
        You can also import members, squads, staff and fees later from the{" "}
        <Link
          href="/admin/import"
          className="inline-block py-4 -my-4 align-baseline text-white/70 underline hover:text-white transition-colors"
        >
          Import hub
        </Link>
        .
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["csv", "manual"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`min-h-[48px] px-4 py-2 rounded-button text-sm font-semibold cursor-pointer transition-colors ${
              importTab === tab
                ? "bg-brand text-dark-primary"
                : "text-white/70 border border-white/20 hover:text-white hover:border-white/40"
            }`}
            onClick={() => setImportTab(tab)}
          >
            {tab === "csv" ? "CSV Upload" : "Manual Add"}
          </button>
        ))}
      </div>

      {importTab === "csv" && (
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Upload CSV file</label>
            <input
              type="file"
              accept=".csv"
              className="text-white text-sm file:mr-3 file:min-h-[48px] file:py-2 file:px-4 file:rounded-button file:border-0 file:bg-brand file:text-dark-primary file:font-semibold file:cursor-pointer"
              onChange={handleCsvFile}
            />
          </div>

          {csvHeaders.length > 0 && (
            <>
              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="bg-white/5">
                      {csvHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-white/70">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-white/5">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 5 && (
                  <p className="text-white/70 text-xs p-2">Showing 5 of {csvRows.length} rows</p>
                )}
              </div>

              {/* Column mapping */}
              <div className="grid grid-cols-2 gap-3">
                {CSV_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className={LABEL_CLASS}>{label}</label>
                    <select
                      className={INPUT_CLASS}
                      value={csvMapping[key]}
                      onChange={(e) => setCsvMapping((m) => ({ ...m, [key]: e.target.value }))}
                    >
                      <option value="">-- Select column --</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button type="button" className={primaryBtnClass} onClick={applyCsvMapping}>
                Import Mapped Rows
              </button>
            </>
          )}
        </div>
      )}

      {importTab === "manual" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>First name *</label>
              <input
                className={INPUT_CLASS}
                value={manualMember.firstName}
                onChange={(e) => setManualMember((s) => ({ ...s, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Last name *</label>
              <input
                className={INPUT_CLASS}
                value={manualMember.lastName}
                onChange={(e) => setManualMember((s) => ({ ...s, lastName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Date of birth</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={manualMember.dob}
                onChange={(e) => setManualMember((s) => ({ ...s, dob: e.target.value }))}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Gender</label>
              <select
                className={INPUT_CLASS}
                value={manualMember.gender}
                onChange={(e) => setManualMember((s) => ({ ...s, gender: e.target.value }))}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="X">Other</option>
              </select>
            </div>
          </div>

          <button type="button" className={primaryBtnClass} onClick={addManualMember}>
            Add Member
          </button>
        </div>
      )}

      {/* Member list */}
      {members.length > 0 && (
        <div className="mt-4">
          <h3 className="text-white font-medium mb-2">
            Members ({members.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-dark-primary rounded-xl px-3 py-2 border border-white/10"
              >
                <span className="text-white text-sm">
                  {s.firstName} {s.lastName}
                  {s.dob && <span className="text-white/70 ml-2">{s.dob}</span>}
                  {s.gender && <span className="text-white/70 ml-2">({s.gender})</span>}
                </span>
                <button
                  type="button"
                  className="text-danger hover:text-danger/80 text-xs cursor-pointer"
                  onClick={() => removeMember(s.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderInviteStaff = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-2xl text-white tracking-tight">Invite Staff</h2>
        <button type="button" className={primaryBtnClass} onClick={addStaff}>
          Add Staff Member
        </button>
      </div>
      <p className="text-white/50 text-sm mb-4">Invite coaches and other admins so they can access {BRAND.name} too.</p>

      {staff.length === 0 && (
        <p className="text-white/70 text-sm">No staff added yet. You can always invite coaches and admins later from Settings.</p>
      )}

      {staff.map((member) => (
          <div key={member.id} className="bg-dark-primary rounded-xl p-4 space-y-3 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                {member.firstName || member.lastName
                  ? `${member.firstName} ${member.lastName}`.trim()
                  : "New staff member"}
              </span>
              <button
                type="button"
                className="text-danger hover:text-danger/80 text-sm cursor-pointer"
                onClick={() => removeStaff(member.id)}
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>First name</label>
                <input
                  className={INPUT_CLASS}
                  value={member.firstName}
                  onChange={(e) => updateStaff(member.id, "firstName", e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Last name</label>
                <input
                  className={INPUT_CLASS}
                  value={member.lastName}
                  onChange={(e) => updateStaff(member.id, "lastName", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Email *</label>
              <input
                type="email"
                autoComplete="email"
                className={INPUT_CLASS}
                value={member.email}
                onChange={(e) => updateStaff(member.id, "email", e.target.value)}
              />
              {errors[`staff-${member.id}-email`] && <p className="text-danger text-sm mt-1">{errors[`staff-${member.id}-email`]}</p>}
            </div>

            <div>
              <label className={LABEL_CLASS}>Role</label>
              <select
                className={INPUT_CLASS}
                value={member.role}
                onChange={(e) => updateStaff(member.id, "role", e.target.value)}
              >
                <option value="COACH">Coach</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
      ))}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-white tracking-tight mb-1">Ready to go</h2>
      <p className="text-white/50 text-sm mb-4">You can change any of these details later from Settings. Nothing is set in stone.</p>

      {/* Club details */}
      <div className="bg-dark-primary rounded-xl p-4 border border-white/10">
        <h3 className="text-brand font-medium mb-3">Club Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {summaryItems.map(({ label, value }) => (
            <div key={label}>
              <span className="text-white/70">{label}: </span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Venues */}
      <div className="bg-dark-primary rounded-xl p-4 border border-white/10">
        <h3 className="text-brand font-medium mb-3">
          Venues ({venues.length})
        </h3>
        {venues.length === 0 ? (
          <p className="text-white/70 text-sm">None added <span className="text-white/50">(you can add these later from Settings)</span></p>
        ) : (
          <ul className="space-y-1 text-sm text-white">
            {venues.map((v) => (
              <li key={v.id}>
                {v.name}
                {v.address && <span className="text-white/70"> - {v.address}</span>}
                {v.laneCount > 0 && <span className="text-white/70"> ({v.laneCount} lanes)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Squads */}
      <div className="bg-dark-primary rounded-xl p-4 border border-white/10">
        <h3 className="text-brand font-medium mb-3">
          Squads ({squads.length})
        </h3>
        {squads.length === 0 ? (
          <p className="text-white/70 text-sm">None added <span className="text-white/50">(you can add these later from Settings)</span></p>
        ) : (
          <ul className="space-y-1 text-sm text-white">
            {squads.map((s) => (
              <li key={s.id}>
                {s.name}
                {(s.minAge !== "" || s.maxAge !== "") && (
                  <span className="text-white/70">
                    {" "}(ages {s.minAge || "?"}-{s.maxAge || "?"})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Members */}
      <div className="bg-dark-primary rounded-xl p-4 border border-white/10">
        <h3 className="text-brand font-medium mb-3">
          Members ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="text-white/70 text-sm">None added <span className="text-white/50">(you can add these later from Settings)</span></p>
        ) : (
          <p className="text-white text-sm">
            {members.length} member{members.length === 1 ? "" : "s"} ready to import
          </p>
        )}
      </div>

      {/* Staff */}
      <div className="bg-dark-primary rounded-xl p-4 border border-white/10">
        <h3 className="text-brand font-medium mb-3">
          Staff ({staff.length})
        </h3>
        {staff.length === 0 ? (
          <p className="text-white/70 text-sm">None added <span className="text-white/50">(you can add these later from Settings)</span></p>
        ) : (
          <ul className="space-y-1 text-sm text-white">
            {staff.map((s) => (
              <li key={s.id}>
                {s.firstName} {s.lastName} - {s.email} ({s.role})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // ---------- Step rendering ----------

  const stepContent = [
    renderClubDetails,
    renderVenues,
    renderSquads,
    renderImportMembers,
    renderInviteStaff,
    renderReview,
  ];

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <div className="min-h-dvh bg-dark-secondary">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <h1 className="font-serif text-4xl text-white tracking-tight text-center mb-2">Welcome to {BRAND.name}</h1>
        <p className="text-white/70 text-center text-lg mb-4">
          Let&apos;s get your club up and running. This takes about 5 minutes, and you can change everything later.
        </p>
        <p className="text-center mb-8">
          <a
            href="/"
            className="text-white/50 hover:text-white/80 text-sm underline transition-colors"
            onClick={() =>
              onboardingExited({ step_index: step, exit_type: "skip_setup_and_explore" })
            }
          >
            Skip setup and explore
          </a>
        </p>

        {/* Stepper */}
        <Stepper current={step} total={STEP_LABELS.length} />

        {/* Card */}
        <div className="bg-dark-tertiary rounded-xl p-6">
          {stepContent[step]()}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button type="button" className={backBtnClass} onClick={handleBack}>
                Back
              </button>
            ) : (
              <div />
            )}

            {isLastStep ? (
              <button
                type="button"
                className={`${primaryBtnClass} ${launching ? "opacity-60" : ""}`}
                disabled={launching}
                onClick={handleLaunch}
              >
                {launching ? "Saving..." : "Launch Your Club"}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button type="button" className={primaryBtnClass} onClick={handleNext}>
                  Continue
                </button>
                {step >= 1 && step <= 4 && (
                  <button
                    type="button"
                    className="text-white/60 hover:text-white/80 text-sm underline bg-transparent border-none cursor-pointer"
                    onClick={() => {
                      onboardingStepSkipped(stepFor(step));
                      stepsSkipped.current += 1;
                      setStep((s) => s + 1);
                    }}
                  >
                    Skip for now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
