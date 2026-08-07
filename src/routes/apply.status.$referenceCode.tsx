import { createFileRoute } from '@tanstack/react-router';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { StatusTracker } from '../components/apply-portal/StatusTracker';
import { z } from 'zod';

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute('/apply/status/$referenceCode')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyStatusPage,
});

function ApplyStatusPage() {
  const { referenceCode } = Route.useParams();
  const search = Route.useSearch();

  const cleanRef = referenceCode === 'lookup' ? '' : referenceCode;

  return (
    <ApplyLayout title="Order Intake Status">
      <StatusTracker
        initialReferenceCode={cleanRef}
        initialEmail={search?.email || ''}
      />
    </ApplyLayout>
  );
}
