'use client';

import { useState } from 'react';

import { isValidPhone, isValidPostalCode } from '@/lib/utils/postal';

export interface ProfileFormData {
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
}

interface ProfileEditFormProps {
  initialData: ProfileFormData;
  onSave: (data: ProfileFormData) => Promise<void>;
  isLoading: boolean;
}

interface FormErrors {
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

function validate(data: ProfileFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.primary_contact_name.trim()) {
    errors.primary_contact_name = 'Contact name is required';
  } else if (data.primary_contact_name.length > 200) {
    errors.primary_contact_name = 'Name is too long (max 200 characters)';
  }

  if (!data.primary_contact_email.trim()) {
    errors.primary_contact_email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primary_contact_email.trim())) {
    errors.primary_contact_email = 'Please enter a valid email address';
  }

  if (data.primary_contact_phone.trim() && !isValidPhone(data.primary_contact_phone)) {
    errors.primary_contact_phone = 'Please enter a valid phone number';
  }

  if (data.address_line1.length > 200) {
    errors.address_line1 = 'Address is too long (max 200 characters)';
  }

  if (data.address_line2.length > 200) {
    errors.address_line2 = 'Address is too long (max 200 characters)';
  }

  if (data.city.length > 100) {
    errors.city = 'City name is too long (max 100 characters)';
  }

  if (data.postcode.trim() && !isValidPostalCode(data.postcode)) {
    errors.postcode = 'Please enter a valid postcode or ZIP code';
  }

  return errors;
}

export default function ProfileEditForm({ initialData, onSave, isLoading }: ProfileEditFormProps) {
  const [formData, setFormData] = useState<ProfileFormData>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const inputCls = (hasError?: boolean) =>
    `w-full px-4 py-3 bg-white/10 text-white rounded-xl border ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'border-white/10 focus:border-brand focus:ring-brand'
    } focus:ring-2 focus:ring-opacity-50 transition-all outline-none`;

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const busy = isLoading || isSaving;

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Contact Name */}
        <div>
          <label
            htmlFor="profile_contact_name"
            className="block text-sm font-semibold text-white mb-2"
          >
            Contact Name <span className="text-brand">*</span>
          </label>
          <input
            id="profile_contact_name"
            type="text"
            autoComplete="name"
            value={formData.primary_contact_name}
            onChange={(e) => handleChange('primary_contact_name', e.target.value)}
            className={inputCls(!!errors.primary_contact_name)}
            placeholder="Enter contact name"
            disabled={busy}
          />
          {errors.primary_contact_name && (
            <p className="mt-2 text-sm text-red-400">{errors.primary_contact_name}</p>
          )}
        </div>

        {/* Email and Phone Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="profile_email" className="block text-sm font-semibold text-white mb-2">
              Email <span className="text-brand">*</span>
            </label>
            <input
              id="profile_email"
              type="email"
              autoComplete="email"
              value={formData.primary_contact_email}
              onChange={(e) => handleChange('primary_contact_email', e.target.value)}
              className={inputCls(!!errors.primary_contact_email)}
              placeholder="email@example.com"
              disabled={busy}
            />
            {errors.primary_contact_email && (
              <p className="mt-2 text-sm text-red-400">{errors.primary_contact_email}</p>
            )}
          </div>

          <div>
            <label htmlFor="profile_phone" className="block text-sm font-semibold text-white mb-2">
              Phone <span className="text-text-tertiary font-normal">(Optional)</span>
            </label>
            <input
              id="profile_phone"
              type="tel"
              autoComplete="tel"
              value={formData.primary_contact_phone}
              onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
              className={inputCls(!!errors.primary_contact_phone)}
              placeholder="07700 900000"
              disabled={busy}
            />
            {errors.primary_contact_phone && (
              <p className="mt-2 text-sm text-red-400">{errors.primary_contact_phone}</p>
            )}
          </div>
        </div>

        {/* Address Line 1 */}
        <div>
          <label htmlFor="profile_address1" className="block text-sm font-semibold text-white mb-2">
            Address Line 1 <span className="text-text-tertiary font-normal">(Optional)</span>
          </label>
          <input
            id="profile_address1"
            type="text"
            autoComplete="address-line1"
            value={formData.address_line1}
            onChange={(e) => handleChange('address_line1', e.target.value)}
            className={inputCls(!!errors.address_line1)}
            placeholder="Street address"
            disabled={busy}
          />
          {errors.address_line1 && (
            <p className="mt-2 text-sm text-red-400">{errors.address_line1}</p>
          )}
        </div>

        {/* Address Line 2 */}
        <div>
          <label htmlFor="profile_address2" className="block text-sm font-semibold text-white mb-2">
            Address Line 2 <span className="text-text-tertiary font-normal">(Optional)</span>
          </label>
          <input
            id="profile_address2"
            type="text"
            autoComplete="address-line2"
            value={formData.address_line2}
            onChange={(e) => handleChange('address_line2', e.target.value)}
            className={inputCls(!!errors.address_line2)}
            placeholder="Flat, suite, etc."
            disabled={busy}
          />
          {errors.address_line2 && (
            <p className="mt-2 text-sm text-red-400">{errors.address_line2}</p>
          )}
        </div>

        {/* City and Postcode Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="profile_city" className="block text-sm font-semibold text-white mb-2">
              City <span className="text-text-tertiary font-normal">(Optional)</span>
            </label>
            <input
              id="profile_city"
              type="text"
              autoComplete="address-level2"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className={inputCls(!!errors.city)}
              placeholder="City"
              disabled={busy}
            />
            {errors.city && <p className="mt-2 text-sm text-red-400">{errors.city}</p>}
          </div>

          <div>
            <label
              htmlFor="profile_postcode"
              className="block text-sm font-semibold text-white mb-2"
            >
              Postcode <span className="text-text-tertiary font-normal">(Optional)</span>
            </label>
            <input
              id="profile_postcode"
              type="text"
              autoComplete="postal-code"
              value={formData.postcode}
              onChange={(e) => handleChange('postcode', e.target.value)}
              className={inputCls(!!errors.postcode)}
              placeholder="e.g. SW1A 1AA or 90210"
              disabled={busy}
            />
            {errors.postcode && <p className="mt-2 text-sm text-red-400">{errors.postcode}</p>}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8">
        <button
          type="submit"
          disabled={busy}
          className="px-8 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isSaving ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            <span>Save contact details</span>
          )}
        </button>
      </div>
    </form>
  );
}
