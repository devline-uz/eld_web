// owner: web-settings-admin — W-25 Support · Feedback (web/tz.md §10 W-25). Perm `support`.
// Design: web/roles and screens/admin panel/Feedback survey, satisfaction, driver comments.jpg
import { useState } from 'react';
import { Send, Star } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Avatar } from '@/shared/ui/Avatar';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useSubmitFeedback } from '@/shared/api/settingsAdmin';
import { usePermission } from '@/shared/auth/usePermission';
import { SUPPORT_REASON } from './lib/copy';

type Tab = 'send' | 'driver' | 'requests';

const QUESTIONS: { id: string; question: string; options: string[] }[] = [
  { id: 'tenure', question: 'How long have you been using OneBook ELD?', options: ['< 1 year', '1–2 years', '3–5 years', '5+ years'] },
  { id: 'dashboard', question: 'How easy is the fleet dashboard to use?', options: ['Very easy', 'Easy', 'Difficult', 'Very difficult'] },
  {
    id: 'hos',
    question: 'How satisfied are you with HOS logging and certification?',
    options: ['Very satisfied', 'Satisfied', 'Unsatisfied', 'Not used'],
  },
  { id: 'speed', question: 'How fast does the dashboard feel?', options: ['Very fast', 'Fast', 'Average', 'Slow'] },
  { id: 'recommend', question: 'Would you recommend OneBook ELD to another carrier?', options: ['Strongly', 'Recommend', 'Neutral', 'No'] },
];

const SATISFACTION = [
  { label: 'Ease of use', value: 4.6 },
  { label: 'Reliability', value: 4.3 },
  { label: 'Support', value: 4.7 },
  { label: 'Value for money', value: 3.9 },
];

const DRIVER_FEEDBACK = [
  { name: 'John Smith', rating: 5, quote: 'The 8-day recap view is exactly what we needed.', when: '2 days ago' },
  { name: 'Maria Lopez', rating: 4, quote: 'App is fast, would like offline mode for dead zones.', when: '5 days ago' },
  { name: 'Tom Baker', rating: 5, quote: 'Certifying logs at the end of shift takes seconds now.', when: '1 week ago' },
];

function satisfactionTone(value: number): 'success' | 'warning' {
  return value >= 4.0 ? 'success' : 'warning';
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const submitFeedback = useSubmitFeedback();
  // WB-250 — B-12 shipped: `POST /feedback` now only needs `support:READ`. A `support:NONE`
  // role never reaches this page (route + nav gated on `support`), so any role that can see
  // this screen can submit. The inline 403 below stays as a fallback for a server-side refusal.
  const { can } = usePermission();
  const canSubmit = can('support', 'READ');
  const [tab, setTab] = useState<Tab>('send');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [contactMe, setContactMe] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    submitFeedback.mutate(
      { answers: { ...answers, contactMe }, comment: comment || undefined },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 403) {
            setError(err.userMessage);
            return;
          }
          toast({ kind: 'error', title: err instanceof ApiError ? err.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-page-title text-text">Support · Feedback</h1>
        <p className="text-page-sub text-text-muted">
          Help us improve OneBook ELD · your answers stay anonymous to other carriers
        </p>
      </div>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
        {(
          [
            ['send', 'Send feedback'],
            ['driver', `Driver feedback ${DRIVER_FEEDBACK.length}`],
            ['requests', 'Feature requests 7'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={tab === value ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse' : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="grid grid-cols-[1fr_348px] gap-4">
          <Card>
            <SectionHeader title="Send feedback" subtitle="Takes about two minutes" className="mb-4" />
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-card-title font-semibold text-text">Thank you — your feedback was sent.</p>
                <Button variant="secondary" onClick={() => setSubmitted(false)}>
                  Send another
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {error && (
                  <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
                    {error}
                  </p>
                )}
                {QUESTIONS.map((q) => (
                  <div key={q.id}>
                    <p className="mb-2 text-body-strong text-text">{q.question}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className={
                            'rounded-md border px-2 py-2 text-center text-caption ' +
                            (answers[q.id] === opt ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-secondary hover:bg-bg-subtle')
                          }
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <p className="mb-2 text-body-strong text-text">Anything else you would like us to know?</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    aria-label="Anything else you would like us to know?"
                    className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
                  />
                </div>
                <label className="flex items-center gap-2 text-body text-text">
                  <input type="checkbox" checked={contactMe} onChange={(e) => setContactMe(e.target.checked)} />
                  You may contact me about this feedback
                </label>
                {!canSubmit && (
                  <p id="feedback-submit-forbidden" className="rounded-md bg-bg-subtle px-3 py-2 text-caption text-text-secondary">
                    {SUPPORT_REASON.feedbackForbidden}
                  </p>
                )}
                <Button
                  variant="primary"
                  className="w-full"
                  iconLeft={<Send size={16} strokeWidth={1.75} />}
                  loading={submitFeedback.isPending}
                  disabled={!canSubmit}
                  title={canSubmit ? undefined : SUPPORT_REASON.feedbackForbidden}
                  aria-describedby={canSubmit ? undefined : 'feedback-submit-forbidden'}
                  onClick={handleSubmit}
                >
                  Submit feedback
                </Button>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <SectionHeader title="Fleet satisfaction" className="mb-3" />
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-kpi font-semibold text-text">4.6</span>
                <span className="text-body text-text-muted">/ 5</span>
              </div>
              <div className="mt-1 flex gap-0.5 text-warning">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={16} strokeWidth={1.75} fill={i < 4 ? 'currentColor' : 'none'} />
                ))}
              </div>
              <p className="mt-1 text-caption text-text-muted">Based on 24 responses in the last 90 days</p>
              <div className="mt-4 flex flex-col gap-3">
                {SATISFACTION.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex justify-between text-caption text-text-secondary">
                      <span>{s.label}</span>
                      <span className="tabular-nums">{s.value}</span>
                    </div>
                    <ProgressBar ratio={s.value / 5} tone={satisfactionTone(s.value)} label={s.label} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Recent driver feedback" subtitle="From the mobile app" className="mb-3" />
              <div className="flex flex-col gap-3">
                {DRIVER_FEEDBACK.map((f) => (
                  <div key={f.name} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Avatar name={f.name} size="sm" />
                        <span className="text-body-strong text-text">{f.name}</span>
                      </span>
                      <span className="flex gap-0.5 text-warning">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={12} strokeWidth={1.75} fill={i < f.rating ? 'currentColor' : 'none'} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-caption italic text-text-secondary">&ldquo;{f.quote}&rdquo;</p>
                    <p className="mt-1 text-caption text-text-muted">{f.when}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'driver' && (
        <Card>
          <div className="flex flex-col gap-3">
            {DRIVER_FEEDBACK.map((f) => (
              <div key={f.name} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Avatar name={f.name} size="sm" />
                    <span className="text-body-strong text-text">{f.name}</span>
                  </span>
                  <span className="flex gap-0.5 text-warning">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={12} strokeWidth={1.75} fill={i < f.rating ? 'currentColor' : 'none'} />
                    ))}
                  </span>
                </div>
                <p className="mt-1 text-caption italic text-text-secondary">&ldquo;{f.quote}&rdquo;</p>
                <p className="mt-1 text-caption text-text-muted">{f.when}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'requests' && (
        <Card>
          <p className="text-body text-text-muted">Feature requests are collected in the mobile app and shown here read-only.</p>
        </Card>
      )}
    </div>
  );
}
