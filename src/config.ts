// Pro backend configuration. Fill these in after deploying backend/ and
// creating the subscription product in Dodo Payments (see backend/README.md).

// Cloudflare Worker URL from `wrangler deploy`.
export const BACKEND_URL = "https://avc-api.example.workers.dev";

// Dodo Payments checkout link for the Pro subscription product.
export const CHECKOUT_URL = "https://checkout.dodopayments.com/buy/REPLACE_PRODUCT_ID";

// Shown in the options page; keep in sync with backend CAP_MINUTES.
export const PRO_HOURS_PER_MONTH = 45;
export const PRO_PRICE_LABEL = "$10/month or $84/year";
