import { useAuth } from './useAuth';
import { hasPermission, type Module, type PermissionAction } from '../lib/permissions';

/**
 * Custom React hook to evaluate permission rules on the frontend.
 * Evaluates the current logged-in user's role against the single source-of-truth PERMISSION_MATRIX.
 *
 * @param module The target system module (e.g. 'orders', 'inventory', 'qc')
 * @param action The requested CRUD action ('create' | 'read' | 'update' | 'delete')
 * @returns boolean indicating if the current user has permission
 */
export function usePermission(module: Module, action: PermissionAction): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, module, action);
}
