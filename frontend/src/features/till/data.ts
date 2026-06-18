/** PKR notes + coins, highest first. */
export const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

export type DenominationCounts = Record<number, number>;
