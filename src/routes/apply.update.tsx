import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';

// This used to render a separate, disconnected "Request Order Revision"
// form (manual PO entry, no live order list) — a second, inferior
// implementation of the exact same feature the real Apply wizard already
// has (Live Order Sync, real order list, real stage-based gating) once a
// customer picks the "Order Update" classification there. Rather than
// maintain two copies that can drift apart, this route now sends the
// customer straight into that one real flow, pre-selected to Order Update
// — forwarding a specific PO/reference code along if one was given (e.g.
// "Request Change" on that order's own detail page).
const searchSchema = z.object({
  po: z.string().optional(),
});

export const Route = createFileRoute('/apply/update')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyUpdateRedirect,
});

function ApplyUpdateRedirect() {
  const navigate = useNavigate();
  const { po } = Route.useSearch();

  useEffect(() => {
    navigate({
      to: '/apply/new',
      search: { type: 'update_existing', ...(po ? { ref: po } : {}) },
      replace: true,
    });
  }, [navigate, po]);

  return null;
}
