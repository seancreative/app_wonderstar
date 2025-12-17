export const formatCurrency = (amount: number, includeRM: boolean = true): string => {
  const formatted = amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return includeRM ? `RM${formatted}` : formatted;
};

export const formatCurrencyWhole = (amount: number, includeRM: boolean = true): string => {
  const formatted = amount.toLocaleString('en-MY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return includeRM ? `RM${formatted}` : formatted;
};
