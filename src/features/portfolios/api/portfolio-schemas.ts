import { z } from 'zod';

/**
 * The portfolio half of the API contract, mirroring the Java DTOs in
 * `infrastructure/web/dto`.
 *
 * These schemas are the boundary: every response is parsed through one, so a field the backend
 * renames shows up as a loud parse error naming the field rather than as `undefined` rendered into
 * a table cell.
 */

export const stockSchema = z.object({
  ticker: z.string(),
  shares: z.number().int(),
});

export const portfolioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  stockCount: z.number().int(),
  totalShares: z.number().int(),
});

export const portfolioSchema = portfolioSummarySchema.extend({
  stocks: z.array(stockSchema),
});

export const portfolioListSchema = z.array(portfolioSummarySchema);

export type Stock = z.infer<typeof stockSchema>;
export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;

/**
 * Client-side limits, kept in step with the bean-validation annotations on the Java records.
 *
 * Duplicated deliberately: validating in the browser turns a round trip into instant feedback, and
 * the server still enforces the same rules for anything that bypasses the form.
 */
export const PORTFOLIO_NAME_MAX_LENGTH = 100;
export const TICKER_MAX_LENGTH = 16;
