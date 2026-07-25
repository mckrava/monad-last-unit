export function errorCopy(errorName: string, args?: unknown[]): string {
  switch (errorName) {
    case 'StaleChallenge': {
      const [age, max] = (args ?? []) as [unknown, unknown];
      return `Code expired — ${age ?? '?'} blocks old, limit ${max ?? '?'}. Scan again.`;
    }
    case 'SoldOut':
      return 'Gone. All units claimed.';
    case 'AlreadyClaimed':
      return 'This device already claimed this drop.';
    case 'DropInactive':
      return "This drop isn't live.";
    case 'BadBeaconSig':
      return 'Invalid code — not issued by this store.';
    case 'BadPlayerSig':
    case 'BadSigLength':
      return 'Signature error. Reload and scan again.';
    case 'FutureChallenge':
      return 'Clock skew — challenge is ahead of the chain. Scan again.';
    default:
      return `Claim failed: ${errorName}`;
  }
}
