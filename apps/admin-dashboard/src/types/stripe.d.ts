// Type declarations for @stripe/stripe-js
declare module '@stripe/stripe-js' {
  export interface Stripe {
    elements: (options?: any) => StripeElements;
    confirmCardPayment: (clientSecret: string, data?: any) => Promise<any>;
  }

  export interface StripeElements {
    create: (type: string, options?: any) => StripeCardElement;
    update: (options: any) => void;
  }

  export interface StripeCardElement {
    mount: (element: string | HTMLElement) => void;
    on: (event: string, callback: (event: any) => void) => void;
    confirmPayment: (options: any) => Promise<any>;
    destroy: () => void;
  }

  export function loadStripe(key: string): Promise<Stripe | null>;
}