type GuestLike = {
  user_id: string;
  balances?: { display_name: string | null; username?: string | null } | null;
};

/**
 * Filter event guests for the tag picker dropdown.
 * - Excludes the current user
 * - When query is empty, shows all guests
 * - When query is set, matches display_name or username (case-insensitive substring)
 * - Guests with no searchable name (null display_name + null username) always show
 */
export function filterTagPickerGuests<T extends GuestLike>(
  guests: T[],
  userId: string,
  query: string,
): T[] {
  const q = query.toLowerCase();
  return guests.filter((g) => {
    if (g.user_id === userId) return false;
    if (!q) return true;
    const name = g.balances?.display_name;
    const uname = g.balances?.username;
    if (!name && !uname) return true;
    return name?.toLowerCase().includes(q) || uname?.toLowerCase().includes(q);
  });
}
