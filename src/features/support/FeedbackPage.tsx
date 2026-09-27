// owner: web-settings-admin — W-25 Support · Feedback (web/tz.md §10 W-25). Perm `support`.
// Design: web/roles and screens/admin panel/Feedback survey, satisfaction, driver comments.jpg
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useSubmitFeedback } from '@/shared/api/settingsAdmin';
import { usePermission } from '@/shared/auth/usePermission';
import { SUPPORT_REASON } from './lib/copy';
import { usePageHeader } from '@/app/layouts/Topbar';

const QUESTIONS: { id: string; question: string; options: string[] }[] = [
  {
    id: 'tenure',
    question: 'How long have you been using OneBook ELD?',
    options: ['< 1 year', '1–2 years', '3–5 years', '5+ years'],
  },
  {
    id: 'dashboard',
    question: 'How easy is the fleet dashboard to use?',
    options: ['Very easy', 'Easy', 'Difficult', 'Very difficult'],
  },
  {
    id: 'hos',
    question: 'How satisfied are you with HOS logging and certification?',
    options: ['Very satisfied', 'Satisfied', 'Unsatisfied', 'Not used'],
  },
  {
    id: 'speed',
    question: 'How fast does the dashboard feel?',
    options: ['Very fast', 'Fast', 'Average', 'Slow'],
  },
  {
    id: 'recommend',
    question: 'Would you recommend OneBook ELD to another carrier?',
    options: ['Strongly', 'Recommend', 'Neutral', 'No'],
  },
];

export default function FeedbackPage() {
  const { toast } = useToast();
  const submitFeedback = useSubmitFeedback();
  // WB-250 — B-12 shipped: `POST /feedback` now only needs `support:READ`. A `support:NONE`
  // role never reaches this page (route + nav gated on `support`), so any role that can see
  // this screen can submit. The inline 403 below stays as a fallback for a server-side refusal.
  const { can } = usePermission();
  const canSubmit = can('support', 'READ');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [contactMe, setContactMe] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!canSubmit || submitFeedback.isPending) return;
    setError(null);
    // An untouched form used to post `{ answers: { contactMe: false } }` — an empty response
    // stored as real feedback.
    if (Object.keys(answers).length === 0 && comment.trim() === '') {
      setError('Answer at least one question or add a comment.');
      return;
    }
    submitFeedback.mutate(
      { answers: { ...answers, contactMe }, comment: comment.trim() || undefined },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 403) {
            setError(err.userMessage);
            return;
          }
          toast({
            kind: 'error',
            title: err instanceof ApiError ? err.userMessage : 'Something went wrong.',
          });
        },
      },
    );
  }

  usePageHeader({ title: 'Support · Feedback', subtitle: 'Help us improve OneBook ELD · your answers stay anonymous to other carriers' });

  return (
    <div className="flex flex-col gap-4">

      {/* No endpoint serves fleet satisfaction scores, driver feedback or feature requests yet,
          so the page is the survey form alone — nothing on it is invented. */}
      <div className="max-w-3xl">
        <Card>
          <SectionHeader
            title="Send feedback"
            subtitle="Takes about two minutes"
            className="mb-4"
          />
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-card-title font-semibold text-text">
                Thank you — your feedback was sent.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  // `Send another` used to reopen the form with the previous answers still picked.
                  setAnswers({});
                  setComment('');
                  setContactMe(false);
                  setSubmitted(false);
                }}
              >
                Send another
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger"
                >
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
                        aria-pressed={answers[q.id] === opt}
                        onClick={() => {
                          setError(null);
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                        }}
                        className={
                          'rounded-md border px-2 py-2 text-center text-caption ' +
                          (answers[q.id] === opt
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border text-text-secondary hover:bg-bg-subtle')
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-2 text-body-strong text-text">
                  Anything else you would like us to know?
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  aria-label="Anything else you would like us to know?"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
                />
              </div>
              <label className="flex items-center gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={contactMe}
                  onChange={(e) => setContactMe(e.target.checked)}
                />
                You may contact me about this feedback
              </label>
              {!canSubmit && (
                <p
                  id="feedback-submit-forbidden"
                  className="rounded-md bg-bg-subtle px-3 py-2 text-caption text-text-secondary"
                >
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
      </div>
    </div>
  );
}
