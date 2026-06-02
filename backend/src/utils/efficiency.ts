/**
 * Calculates the efficiency percentage.
 * Formula: Efficiency = (production sum) / (target sum) * 100
 * 
 * If total target is 0 or negative, it returns 'N/A' (not 0 and not an error).
 * Over-performance values (above 100%) are allowed and uncapped.
 *
 * @param totalProduction Sum of production amounts for the period
 * @param totalTarget Sum of daily targets for the period
 * @returns Formatted percentage string (e.g. '85.5', '125.0') or 'N/A'
 */
export function calculateEfficiency(totalProduction: number, totalTarget: number): string {
  if (totalTarget <= 0) {
    return 'N/A';
  }
  return ((totalProduction / totalTarget) * 100).toFixed(1);
}
