import { createFileRoute } from '@tanstack/react-router';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { UpdateRequestForm } from '../components/apply-portal/UpdateRequestForm';

export const Route = createFileRoute('/apply/update')({
  component: ApplyUpdatePage,
});

function ApplyUpdatePage() {
  return (
    <ApplyLayout title="Request Order Revision">
      <UpdateRequestForm />
    </ApplyLayout>
  );
}
