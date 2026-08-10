import bcrypt from 'bcryptjs';
import { VIEW_PASSWORD_HEADER } from './view-password';

type PasswordProtectedView = {
  password_protected?: boolean | null;
  password_hash?: string | null;
};

/**
 * Whether the request carries the correct password for `view`.
 *
 * Unprotected views pass straight through. Protected ones require the plaintext
 * password in the `x-view-password` header and must bcrypt-match the stored
 * hash. Fails closed on a missing hash or a bcrypt error, so a half-configured
 * view denies access rather than granting it.
 *
 * Every public-view child endpoint must call this. The parent endpoint proves
 * the password once, but each child request is independent and unauthenticated
 * on its own, so skipping the check here lets a visitor who never saw the
 * password read the view's contents directly (CWE-862).
 */
export async function viewPasswordSatisfied(
  view: PasswordProtectedView,
  request: Request
): Promise<boolean> {
  if (!view.password_protected) return true;
  if (!view.password_hash) return false;

  const supplied = request.headers.get(VIEW_PASSWORD_HEADER);
  if (!supplied) return false;

  try {
    return await bcrypt.compare(supplied, view.password_hash);
  } catch {
    return false;
  }
}
