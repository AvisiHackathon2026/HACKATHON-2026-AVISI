export interface CalculatorInput {
  mode: 1 | 2;
  targetMonthlySalary?: number;
  maxClientRate?: number;
  travelCostsHourly?: number;
  desiredMargin: number;
  costFactor: number;
  hoursPerWeek: number;
}

export interface CalculatorResult {
  mode: 1 | 2;
  grossWeeklySalary: number;
  grossHourlyWage: number;
  costPrice: number;
  clientRateOrMaxSalary: number;
  breakdown: string[];
}

export function calculateVanguardMetrics(data: CalculatorInput): CalculatorResult {
  const {
    mode,
    targetMonthlySalary = 0,
    maxClientRate = 0,
    travelCostsHourly = 0,
    desiredMargin,
    costFactor,
    hoursPerWeek,
  } = data;

  if (hoursPerWeek <= 0) {
    throw new Error('Hours per week must be greater than zero.');
  }

  if (mode === 1) {
    const grossWeeklySalary = (targetMonthlySalary * 3) / 13;
    const grossHourlyWage = grossWeeklySalary / hoursPerWeek;
    const costPrice = grossHourlyWage * costFactor;
    const allInCost = costPrice + travelCostsHourly;
    const finalClientRate = allInCost + desiredMargin;

    return {
      mode: 1,
      grossWeeklySalary: Number(grossWeeklySalary.toFixed(2)),
      grossHourlyWage: Number(grossHourlyWage.toFixed(2)),
      costPrice: Number(allInCost.toFixed(2)),
      clientRateOrMaxSalary: Number(finalClientRate.toFixed(2)),
      breakdown: [
        '1. Gross Weekly Salary: (\u20AC' + targetMonthlySalary + ' * 3) / 13 = \u20AC' + grossWeeklySalary.toFixed(2) + ' / week',
        '2. Gross Hourly Wage: \u20AC' + grossWeeklySalary.toFixed(2) + ' / ' + hoursPerWeek + ' hours = \u20AC' + grossHourlyWage.toFixed(2),
        '3. Cost Price: \u20AC' + grossHourlyWage.toFixed(2) + ' * ' + costFactor + ' factor = \u20AC' + (grossHourlyWage * costFactor).toFixed(2),
        '4. All-in Cost: \u20AC' + (grossHourlyWage * costFactor).toFixed(2) + ' + \u20AC' + travelCostsHourly + ' travel = \u20AC' + allInCost.toFixed(2),
        '5. Final Client Rate: \u20AC' + allInCost.toFixed(2) + ' + \u20AC' + desiredMargin + ' margin = \u20AC' + finalClientRate.toFixed(2),
      ],
    };
  } else {
    const targetCostPrice = maxClientRate - desiredMargin;
    const grossHourlyWage = targetCostPrice / costFactor;
    const grossWeeklySalary = grossHourlyWage * hoursPerWeek;
    const maxMonthlySalary = (grossWeeklySalary * 13) / 3;

    return {
      mode: 2,
      grossWeeklySalary: Number(grossWeeklySalary.toFixed(2)),
      grossHourlyWage: Number(grossHourlyWage.toFixed(2)),
      costPrice: Number(targetCostPrice.toFixed(2)),
      clientRateOrMaxSalary: Number(maxMonthlySalary.toFixed(2)),
      breakdown: [
        '1. Target Cost Price: \u20AC' + maxClientRate + ' - \u20AC' + desiredMargin + ' margin = \u20AC' + targetCostPrice.toFixed(2) + ' / hour',
        '2. Gross Hourly Wage: \u20AC' + targetCostPrice.toFixed(2) + ' / ' + costFactor + ' factor = \u20AC' + grossHourlyWage.toFixed(2),
        '3. Gross Weekly Salary: \u20AC' + grossHourlyWage.toFixed(2) + ' * ' + hoursPerWeek + ' hours = \u20AC' + grossWeeklySalary.toFixed(2),
        '4. Max Monthly Salary: (\u20AC' + grossWeeklySalary.toFixed(2) + ' * 13) / 3 = \u20AC' + maxMonthlySalary.toFixed(2),
      ],
    };
  }
}
