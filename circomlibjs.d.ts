declare module 'circomlibjs' {
  export interface PoseidonHash {
    (inputs: bigint[]): bigint;
    F: {
      toString(x: bigint, radix?: number): string;
      toObject(x: bigint): bigint;
      e(x: string | number | bigint): bigint;
    };
  }
  
  export interface Mimc7Hash {
    (left: bigint, right: bigint): bigint;
    multiHash(arr: bigint[], key?: bigint): bigint;
    F: {
      toString(x: bigint, radix?: number): string;
      e(x: string | number | bigint): bigint;
    };
  }
  
  export interface BabyJub {
    F: any;
    p: bigint;
    pm1d2: bigint;
    Generator: [bigint, bigint];
    Base8: [bigint, bigint];
    order: bigint;
    subOrder: bigint;
    A: bigint;
    D: bigint;
    inCurve(point: [bigint, bigint]): boolean;
    inSubgroup(point: [bigint, bigint]): boolean;
    packPoint(point: [bigint, bigint]): Buffer;
    unpackPoint(packed: Buffer): [bigint, bigint];
    mulPointEscalar(point: [bigint, bigint], scalar: bigint): [bigint, bigint];
    addPoint(p1: [bigint, bigint], p2: [bigint, bigint]): [bigint, bigint];
  }
  
  export function buildPoseidon(): Promise<PoseidonHash>;
  export function buildMimc7(): Promise<Mimc7Hash>;
  export function buildBabyJub(): Promise<BabyJub>;
}

