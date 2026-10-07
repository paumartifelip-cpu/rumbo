// Fusión de datos remotos con el estado local. Pura y sin dependencias de React
// para poder probarla: aquí vivieron varios bugs de pérdida de datos.

// Order-independent content signature of a list. Used to detect when a remote
// pull carries the exact same data we already have, so we can skip replacing
// state entirely. This is what prevents the UI from flickering / reordering
// every time the 30s poll or a realtime echo fires with unchanged data.
//
// IMPORTANT: every USER-EDITABLE field must be listed here. A field missing
// from the signature makes remote edits to it invisible ("unchanged") — the
// stale device keeps its old copy and overwrites the edit on its next push.
// Deliberately excluded: ai_priority_score / ai_reason / amount_in_primary,
// which are recomputed locally and would cause endless pull/push churn.
export function listSignature(arr: Array<Record<string, any>>): string {
  return arr
    .map((x) =>
      [
        x.id, x.title, x.amount, x.currency, x.category, x.date, x.type,
        x.recurrence, x.last_generated_date, x.status, x.progress,
        x.current_amount, x.target_amount, x.deadline, x.importance,
        x.total, x.note, x.name, x.cost, x.rating, x.icon, x.is_favorite,
        x.highlight, x.order_index, x.updated_at,
        x.description, x.timeframe, x.unit, x.due_date, x.goal_id,
        x.manual_order_index, x.estimated_minutes, x.energy_level,
        x.difficulty, x.urgency, x.money_impact, x.url, x.month, x.payment_method, x.payment_account,
      ].join("")
    )
    .sort()
    .join("");
}


/**
 * Une local y remoto por id. El remoto es la fuente de verdad para los ids que
 * conoce (salvo los borrados localmente, "tombstones"). Lo que solo existe en
 * local se conserva si nunca hubo sync, o si se creó DESPUÉS del último sync:
 * si es anterior y el remoto ya no lo tiene, se borró en otro dispositivo.
 */
export function mergeRowsById<T extends { id: string; created_at?: string }>(
  local: T[],
  remote: T[],
  tombstoned: Set<string>,
  lastSyncAt?: string
): T[] {
  const map = new Map<string, T>();
  for (const r of remote) {
    if (tombstoned.has(r.id)) continue;
    map.set(r.id, r);
  }
  for (const l of local) {
    if (map.has(l.id)) continue;
    const createdAfterSync = !lastSyncAt || !l.created_at || l.created_at >= lastSyncAt;
    if (createdAfterSync) map.set(l.id, l);
  }
  return Array.from(map.values());
}

/** Como mergeRowsById, pero para ids en AMBOS lados gana el `updated_at` más nuevo. */
export function mergeRowsByUpdated<T extends { id: string; created_at?: string; updated_at?: string }>(
  local: T[],
  remote: T[],
  tombstoned: Set<string>,
  lastSyncAt?: string
): T[] {
  const map = new Map<string, T>();
  const ts = (t: T) => t.updated_at || t.created_at || "";
  for (const r of remote) {
    if (tombstoned.has(r.id)) continue;
    map.set(r.id, r);
  }
  for (const l of local) {
    const r = map.get(l.id);
    if (!r) {
      const createdAfterSync = !lastSyncAt || !l.created_at || l.created_at >= lastSyncAt;
      if (createdAfterSync) map.set(l.id, l);
    } else if (ts(l) > ts(r)) {
      map.set(l.id, l);
    }
  }
  return Array.from(map.values());
}
