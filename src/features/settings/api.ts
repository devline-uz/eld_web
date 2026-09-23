// owner: web-settings-admin — feature-local mutations for W-18..W-24 that
// `shared/api/settingsAdmin.ts` does not expose. Same rules as the shared layer: URLs come from
// `endpoints`, cache keys from `qk`/`qkRoot`, never a literal.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qkRoot } from '@/shared/api/queryKeys';

/**
 * `DELETE /users/:id` — W-18 `Revoke invitation`. An INVITED row has never signed in, so the
 * revoke really is a delete of the pending account; the backend refuses `409 LAST_ADMIN` for the
 * last active administrator and the screen surfaces that message.
 */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<{ success: boolean }>(endpoints.users.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.users }),
  });
}
