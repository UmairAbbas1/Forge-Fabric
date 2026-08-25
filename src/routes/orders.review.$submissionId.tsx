import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { SubmissionReview } from '../components/portal/SubmissionReview';

export const Route = createFileRoute('/orders/review/$submissionId')({
  component: OrderReviewRoutePage,
});

function OrderReviewRoutePage() {
  const { submissionId } = Route.useParams();
  return (
    <AppShell>
      <SubmissionReview submissionId={submissionId} />
    </AppShell>
  );
}
