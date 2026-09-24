// owner: web-auth-rbac — W-26 `Profile` card. `PATCH /me/profile` takes firstName, lastName,
// jobTitle and phone (UpdateMyProfileDto, B-51 shipped); the photo is `POST/DELETE /me/avatar`
// (PNG/JPG, ≥ 256 × 256 px, ≤ 5 MB — checked here first, the server re-checks). Every change
// re-reads `GET /auth/me` so the topbar chip follows. `Work email` is managed by the admin.
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseQueryResult } from '@tanstack/react-query';
import { Mail, Phone, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isApiError, toUserMessage } from '@/shared/api/errors';
import { useDeleteAvatar, useUploadAvatar } from '@/shared/api/me';
import { useAuth } from '@/shared/auth/AuthProvider';
import { fields, inputFilters, profileSchema } from '@/shared/forms';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { TOAST_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { useUpdateProfile, type MyProfile } from '../api';
import { avatarProblem } from '../avatar';

const JOB_TITLE_MAX = 120;
const schema = profileSchema.extend({
  jobTitle: z.string().max(JOB_TITLE_MAX, `Job title must be ${JOB_TITLE_MAX} characters or fewer.`),
  phone: z.union([z.literal(''), fields.phone()]),
});
type ProfileValues = z.infer<typeof schema>;
const EDITABLE = ['firstName', 'lastName', 'jobTitle', 'phone'] as const;

function ProfilePhoto({ profile }: { profile: MyProfile }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();
  const [problem, setProblem] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;

  const done = () => {
    setProblem(null);
    toast({ kind: 'success', ...TOAST_COPY.settingsSaved });
    void refreshUser?.().catch(() => undefined);
  };

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again must fire `change` again
    if (!file) return;
    const local = await avatarProblem(file);
    if (local) {
      setProblem(local);
      return;
    }
    upload.mutate(file, { onSuccess: done, onError: (error) => setProblem(toUserMessage(error)) });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={`${profile.firstName} ${profile.lastName}`}
        src={profile.avatarUrl ?? undefined}
        size="xl"
      />
      <div className="min-w-0 flex-1">
        <p className="text-body-strong text-text">Profile photo</p>
        <p className="text-caption text-text-muted">
          PNG or JPG, at least 256 × 256 px. Appears on your signature block.
        </p>
        {problem ? (
          <p id={errorId} role="alert" className="mt-1 text-caption text-danger">
            {problem}
          </p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="avatar-file-input"
        onChange={(event) => void onFile(event)}
      />
      <div className="flex shrink-0 gap-2">
        <Button
          variant="secondary"
          iconLeft={<Upload size={16} strokeWidth={1.75} aria-hidden="true" />}
          loading={upload.isPending}
          disabled={busy && !upload.isPending}
          aria-describedby={problem ? errorId : undefined}
          onClick={() => inputRef.current?.click()}
        >
          Upload
        </Button>
        {profile.avatarUrl ? (
          <Button
            variant="danger-outline"
            iconLeft={<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />}
            loading={remove.isPending}
            disabled={busy && !remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: done,
                onError: (error) => setProblem(toUserMessage(error)),
              })
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const INPUT =
  'h-input w-full rounded-md border bg-bg-surface px-3 text-body text-text disabled:bg-bg-subtle read-only:bg-bg-subtle read-only:text-text-secondary';

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-text-secondary">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ProfileForm({ profile }: { profile: MyProfile }) {
  const uid = useId();
  const { toast } = useToast();
  const update = useUpdateProfile();
  const { refreshUser } = useAuth();
  const [banner, setBanner] = useState<string | null>(null);
  const defaults: ProfileValues = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    jobTitle: profile.jobTitle ?? '',
    phone: profile.phone ?? '',
  };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  });
  const phoneField = register('phone');

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      const saved = await update.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        jobTitle: values.jobTitle.trim(),
        phone: values.phone,
      });
      reset({
        firstName: saved.firstName,
        lastName: saved.lastName,
        jobTitle: saved.jobTitle ?? '',
        phone: saved.phone ?? '',
      });
      toast({ kind: 'success', ...TOAST_COPY.settingsSaved });
      void refreshUser?.().catch(() => undefined);
    } catch (error) {
      const fieldErrors = isApiError(error) ? error.fieldErrors : {};
      const mapped = EDITABLE.filter((key) => fieldErrors[key]);
      mapped.forEach((key) => setError(key, { message: fieldErrors[key] }));
      if (mapped.length === 0) setBanner(toUserMessage(error));
    }
  });

  const describe = (key: string, hasError: boolean, hasHint = false) =>
    hasError ? `${uid}-${key}-error` : hasHint ? `${uid}-${key}-hint` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {banner ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
          {banner}
        </p>
      ) : null}

      <ProfilePhoto profile={profile} />

      <fieldset disabled={isSubmitting} className="contents">
        <div className="grid grid-cols-3 gap-4">
          <Field id={`${uid}-firstName`} label="First name" required error={errors.firstName?.message}>
            <input
              id={`${uid}-firstName`}
              autoComplete="given-name"
              aria-invalid={errors.firstName ? true : undefined}
              aria-describedby={describe('firstName', Boolean(errors.firstName))}
              className={cn(INPUT, errors.firstName ? 'border-danger' : 'border-border')}
              {...register('firstName')}
            />
          </Field>
          <Field id={`${uid}-lastName`} label="Last name" required error={errors.lastName?.message}>
            <input
              id={`${uid}-lastName`}
              autoComplete="family-name"
              aria-invalid={errors.lastName ? true : undefined}
              aria-describedby={describe('lastName', Boolean(errors.lastName))}
              className={cn(INPUT, errors.lastName ? 'border-danger' : 'border-border')}
              {...register('lastName')}
            />
          </Field>
          <Field id={`${uid}-jobTitle`} label="Job title" error={errors.jobTitle?.message}>
            <input
              id={`${uid}-jobTitle`}
              autoComplete="organization-title"
              maxLength={JOB_TITLE_MAX}
              aria-invalid={errors.jobTitle ? true : undefined}
              aria-describedby={describe('jobTitle', Boolean(errors.jobTitle))}
              className={cn(INPUT, errors.jobTitle ? 'border-danger' : 'border-border')}
              {...register('jobTitle')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${uid}-email`} label="Work email" hint="Managed by your administrator">
            <div className="relative">
              <Mail
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
              />
              <input
                id={`${uid}-email`}
                type="email"
                disabled
                value={profile.email}
                aria-describedby={`${uid}-email-hint`}
                className={cn(INPUT, 'border-border pl-9 text-text-secondary')}
              />
            </div>
          </Field>
          <Field id={`${uid}-phone`} label="Mobile number" error={errors.phone?.message}>
            <div className="relative">
              <Phone
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
              />
              <input
                id={`${uid}-phone`}
                type="tel"
                autoComplete="tel"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={describe('phone', Boolean(errors.phone))}
                maxLength={inputFilters.PHONE_MAX_LENGTH}
                className={cn(INPUT, 'tabular pl-9', errors.phone ? 'border-danger' : 'border-border')}
                {...phoneField}
                onChange={(e) => {
                  // Letters and other symbols are dropped as typed or pasted — only a phone number fits.
                  const clean = inputFilters.phone(e.target.value);
                  if (clean !== e.target.value) e.target.value = clean;
                  return phoneField.onChange(e);
                }}
              />
            </div>
          </Field>
        </div>
      </fieldset>

      {isDirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="lg" disabled={isSubmitting} onClick={() => reset(defaults)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function ProfileCard({ query }: { query: UseQueryResult<MyProfile, Error> }) {
  return (
    <section
      id="account-section-profile"
      tabIndex={-1}
      aria-labelledby="account-profile-title"
      className="scroll-mt-page focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card padded={false}>
        <div className="border-b border-border px-card py-4">
          <SectionHeader
            title={<span id="account-profile-title">Profile</span>}
            subtitle="Shown to your team and on records you sign"
          />
        </div>
        <div className="p-card">
          {query.isPending ? (
            <LoadingState rows={3} />
          ) : query.isError ? (
            <ErrorState
              title="Could not load your profile"
              description="Try again in a moment."
              onRetry={() => void query.refetch()}
            />
          ) : (
            <ProfileForm profile={query.data} />
          )}
        </div>
      </Card>
    </section>
  );
}
