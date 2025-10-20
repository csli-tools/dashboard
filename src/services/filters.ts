export interface CompiledFilter {
  signer?: string;
  receiver?: string;
  method?: string;
  action?: string;
  isEmpty: boolean;
}

export function compileFilter(query: string): CompiledFilter {
  const trimmed = query.trim();

  if (!trimmed) {
    return { isEmpty: true };
  }

  const result: CompiledFilter = { isEmpty: false };

  // Parse simple key:value syntax
  // Examples: "signer:alice.near", "receiver:game.hot.tg", "method:transfer", "action:Transfer"
  const parts = trimmed.split(/\s+/);

  for (const part of parts) {
    const [key, value] = part.split(':');

    if (!key || !value) continue;

    const k = key.toLowerCase();
    const v = value.toLowerCase();

    if (k === 'signer' || k === 's') result.signer = v;
    else if (k === 'receiver' || k === 'r') result.receiver = v;
    else if (k === 'method' || k === 'm') result.method = v;
    else if (k === 'action' || k === 'a') result.action = v;
  }

  return result;
}

export function txMatchesFilter(tx: any, filter: CompiledFilter): boolean {
  if (filter.isEmpty) return true;

  // Check signer
  if (filter.signer) {
    const signer = (tx.signer_id || '').toLowerCase();
    if (!signer.includes(filter.signer)) return false;
  }

  // Check receiver
  if (filter.receiver) {
    const receiver = (tx.receiver_id || '').toLowerCase();
    if (!receiver.includes(filter.receiver)) return false;
  }

  // Check method (FunctionCall actions)
  if (filter.method) {
    const actions = tx.actions || [];
    const hasFunctionCall = actions.some((a: any) => {
      if (!a.FunctionCall) return false;
      const method = (a.FunctionCall.method_name || '').toLowerCase();
      return method.includes(filter.method!);
    });

    if (!hasFunctionCall) return false;
  }

  // Check action type
  if (filter.action) {
    const actions = tx.actions || [];
    const hasActionType = actions.some((a: any) => {
      const keys = Object.keys(a);
      if (keys.length === 0) return false;
      const actionType = keys[0].toLowerCase();
      return actionType.includes(filter.action!);
    });

    if (!hasActionType) return false;
  }

  return true;
}
