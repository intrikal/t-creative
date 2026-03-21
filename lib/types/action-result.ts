/**
 * Discriminated union for server action return values.
 *
 * All server action mutations should return `ActionResult<T>` so callers can
 * branch on `result.success` rather than catching thrown errors.
 *
 * @example
 * // Server action
 * export async function saveProfile(data: Profile): Promise<ActionResult<void>> {
 *   try {
 *     await upsert(data);
 *     return { success: true, data: undefined };
 *   } catch (err) {
 *     return { success: false, error: err instanceof Error ? err.message : "Save failed" };
 *   }
 * }
 *
 * // Client component
 * const result = await saveProfile(data);
 * if (result.success) triggerSaved();
 * else setError(result.error);
 */
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
