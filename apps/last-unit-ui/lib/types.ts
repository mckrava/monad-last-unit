export type Hex = `0x${string}`;

export type Claim = {
  rank: number;
  supply: number;
  player: Hex;
  tokenId: string;
  chainMs: number; // submit -> receipt
  endToEndMs: number; // scan -> confirmed
  challengeBlock: number;
  claimBlock: number;
};

export type ClaimFailureCode =
  | 'SoldOut'
  | 'StaleChallenge'
  | 'AlreadyClaimed'
  | 'BadSignature'
  | 'UnknownCheckpoint'
  | 'DropInactive'
  | 'Reverted';

export type FailureDetail = {
  age?: number; // StaleChallenge: blocks between issue and arrival
  max?: number; // StaleChallenge: freshness limit in blocks
  challengeBlock?: number;
  supply?: number;
};

export type ClaimResult =
  | { status: 'submitting' }
  | { status: 'success'; claim: Claim; txHash: Hex }
  | { status: 'failed'; code: ClaimFailureCode; detail?: FailureDetail; txHash?: Hex };

/** Contract custom error -> design failure code. */
export function toFailureCode(errorName: string): ClaimFailureCode {
  switch (errorName) {
    case 'SoldOut':
      return 'SoldOut';
    case 'StaleChallenge':
      return 'StaleChallenge';
    case 'AlreadyClaimed':
      return 'AlreadyClaimed';
    case 'BadPlayerSig':
    case 'BadSigLength':
      return 'BadSignature';
    case 'BadBeaconSig':
      return 'UnknownCheckpoint';
    case 'DropInactive':
      return 'DropInactive';
    default:
      return 'Reverted';
  }
}

// Branding for the demo drop. Supply/claimed always come from the chain.
export const DROP = {
  name: 'PHANTOM TRAIL 002',
  edition: '“EMBER”',
  venue: 'NORTHSIDE / QUEEN W',
  supply: 50,
} as const;

export const EXPLORER = 'https://testnet.monadvision.com';
