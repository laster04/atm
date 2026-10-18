/**
 * Whether a competition's sign-up form takes applications, shared by the form
 * itself and the public lists that badge competitions open for applications.
 */

export type FormState = 'OPEN' | 'CLOSED' | 'PAST_DEADLINE';

interface WindowLike {
  open: boolean;
  deadline: Date | null;
}

/** Whether the form takes applications right now, and if not, why. */
export const registrationFormState = (window: WindowLike | null | undefined, archived: boolean, now = new Date()): FormState => {
  if (!window?.open || archived) return 'CLOSED';
  if (window.deadline && window.deadline < now) return 'PAST_DEADLINE';
  return 'OPEN';
};

export const takesApplications = (window: WindowLike | null | undefined, archived: boolean, now = new Date()): boolean =>
  registrationFormState(window, archived, now) === 'OPEN';
