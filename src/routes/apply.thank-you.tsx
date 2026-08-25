import { createFileRoute } from '@tanstack/react-router';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { ThankYouPage } from '../components/apply-portal/ThankYouPage';
import { z } from 'zod';

const searchSchema = z.object({
  referenceCode: z.string().optional(),
  email: z.string().optional(),
  pendingCustomerReview: z.boolean().optional(),
});

export const Route = createFileRoute('/apply/thank-you')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyThankYouRoutePage,
});

function ApplyThankYouRoutePage() {
  const search = Route.useSearch();

  return (
    <ApplyLayout title="Order Submitted Successfully">
      <ThankYouPage
        referenceCode={search?.referenceCode}
        email={search?.email}
        pendingCustomerReview={search?.pendingCustomerReview}
      />
    </ApplyLayout>
  );
}
