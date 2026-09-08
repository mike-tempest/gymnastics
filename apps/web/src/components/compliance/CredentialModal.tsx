'use client';

import { CREDENTIAL_TYPE_LABELS, CredentialType } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { createCredential, updateCredential, type CredentialRecord } from '@/lib/api/compliance';
import { getMembers } from '@/lib/api/members';
import { listUsers } from '@/lib/api/staff';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER } from '@/lib/brand';

const credentialSchema = z.object({
  subject_kind: z.enum(['user', 'member']),
  subject_id: z.string().min(1, 'Select who holds this credential'),
  credential_type: z.nativeEnum(CredentialType),
  title: z.string().min(1, 'Enter what the credential is'),
  issuing_body: z.string().optional(),
  reference_number: z.string().optional(),
  issue_date: z.string().min(1, 'Enter the issue date'),
  expiry_date: z.string().optional(),
  document_reference: z.string().optional(),
  notes: z.string().optional(),
});

type CredentialForm = z.infer<typeof credentialSchema>;

interface CredentialModalProps {
  /** Present when editing an existing record; absent when adding one. */
  credential?: CredentialRecord;
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTIONS = Object.values(CredentialType);

/**
 * Add or edit one credential. The subject is chosen once, on creation: a
 * credential that moves from one person to another is a different record, so
 * the subject fields are read-only while editing.
 */
export default function CredentialModal({ credential, onClose, onSaved }: CredentialModalProps) {
  const isEdit = Boolean(credential);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CredentialForm>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      subject_kind: credential?.member_id ? 'member' : 'user',
      subject_id: credential?.member_id ?? credential?.user_id ?? '',
      credential_type: credential?.credential_type ?? CredentialType.FIRST_AID,
      title: credential?.title ?? '',
      issuing_body: credential?.issuing_body ?? '',
      reference_number: credential?.reference_number ?? '',
      issue_date: credential?.issue_date?.slice(0, 10) ?? '',
      expiry_date: credential?.expiry_date?.slice(0, 10) ?? '',
      document_reference: credential?.document_reference ?? '',
      notes: credential?.notes ?? '',
    },
  });

  const subjectKind = watch('subject_kind');

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: listUsers,
    enabled: !isEdit && subjectKind === 'user',
    retry: false,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['members', 'list'],
    queryFn: () => getMembers(),
    enabled: !isEdit && subjectKind === 'member',
    retry: false,
  });

  const onSubmit = async (form: CredentialForm) => {
    setIsSubmitting(true);
    try {
      // Blank optional fields are sent as null, not omitted: JSON.stringify
      // drops undefined, so an omitted expiry date would silently leave the old
      // one in place when a welfare officer clears it.
      const payload = {
        credential_type: form.credential_type,
        title: form.title.trim(),
        issuing_body: form.issuing_body?.trim() || null,
        reference_number: form.reference_number?.trim() || null,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || null,
        document_reference: form.document_reference?.trim() || null,
        notes: form.notes?.trim() || null,
      };

      if (credential) {
        await updateCredential(credential.credential_id, payload);
        toast.success('Credential updated.');
      } else {
        await createCredential({
          ...payload,
          ...(form.subject_kind === 'member'
            ? { member_id: form.subject_id }
            : { user_id: form.subject_id }),
        });
        toast.success('Credential recorded.');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Could not save the credential. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all';
  const labelClass = 'block text-sm font-semibold text-white/80 mb-2';
  const optionClass = 'text-dark-primary';

  const holderName = credential?.user
    ? `${credential.user.first_name} ${credential.user.last_name}`
    : credential?.member
      ? `${credential.member.first_name} ${credential.member.last_name}`
      : 'Not recorded';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-dark-primary rounded-3xl border border-white/10 shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 id="credential-modal-title" className="font-serif text-2xl text-white">
            {isEdit ? 'Edit credential' : 'Add credential'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isEdit ? (
            <div>
              <p className={labelClass}>Held by</p>
              <p className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white">
                {holderName}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="credential-subject-kind" className={labelClass}>
                  Held by
                </label>
                <select
                  {...register('subject_kind')}
                  id="credential-subject-kind"
                  className={fieldClass}
                >
                  <option value="user" className={optionClass}>
                    Staff member or volunteer
                  </option>
                  <option value="member" className={optionClass}>
                    {MEMBER_NOUN}
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="credential-subject" className={labelClass}>
                  {subjectKind === 'member' ? MEMBER_NOUN : 'Staff member'}
                </label>
                <select
                  {...register('subject_id')}
                  id="credential-subject"
                  className={fieldClass}
                  disabled={usersLoading || membersLoading}
                >
                  <option value="" className={optionClass}>
                    {usersLoading || membersLoading
                      ? 'Loading...'
                      : `Select a ${subjectKind === 'member' ? MEMBER_NOUN_LOWER : 'staff member'}`}
                  </option>
                  {subjectKind === 'member'
                    ? (members ?? []).map((member) => (
                        <option
                          key={member.member_id}
                          value={member.member_id}
                          className={optionClass}
                        >
                          {member.first_name} {member.last_name}
                        </option>
                      ))
                    : (users ?? []).map((user) => (
                        <option key={user.user_id} value={user.user_id} className={optionClass}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                </select>
                {errors.subject_id && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.subject_id.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="credential-type" className={labelClass}>
              Credential type
            </label>
            <select {...register('credential_type')} id="credential-type" className={fieldClass}>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type} className={optionClass}>
                  {CREDENTIAL_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="credential-title" className={labelClass}>
              Credential
            </label>
            <input
              {...register('title')}
              id="credential-title"
              type="text"
              placeholder="Emergency First Aid at Work"
              className={fieldClass}
            />
            {errors.title && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="credential-issuing-body" className={labelClass}>
                Issued by <span className="font-normal text-white/50">(optional)</span>
              </label>
              <input
                {...register('issuing_body')}
                id="credential-issuing-body"
                type="text"
                placeholder="British Gymnastics"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="credential-reference" className={labelClass}>
                Reference number <span className="font-normal text-white/50">(optional)</span>
              </label>
              <input
                {...register('reference_number')}
                id="credential-reference"
                type="text"
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="credential-issue-date" className={labelClass}>
                Issue date
              </label>
              <input
                {...register('issue_date')}
                id="credential-issue-date"
                type="date"
                className={fieldClass}
              />
              {errors.issue_date && (
                <p className="mt-2 text-sm text-danger font-semibold">
                  {errors.issue_date.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="credential-expiry-date" className={labelClass}>
                Expiry date
              </label>
              <input
                {...register('expiry_date')}
                id="credential-expiry-date"
                type="date"
                className={fieldClass}
              />
              <p className="mt-2 text-xs text-white/50">
                Leave blank if this credential does not expire.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="credential-document" className={labelClass}>
              Certificate reference <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input
              {...register('document_reference')}
              id="credential-document"
              type="text"
              placeholder="Where the certificate is filed"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="credential-notes" className={labelClass}>
              Notes <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input
              {...register('notes')}
              id="credential-notes"
              type="text"
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save credential'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 min-h-[44px] rounded-button font-semibold bg-white/5 border border-white/10 text-white hover:border-brand transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
