// Type declarations for @stripe/stripe-js (legacy payment component)
// Payment system was removed from the project, but this component remains for reference
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
    unmount: () => void;
    destroy: () => void;
    on: (event: string, handler: (event: any) => void) => void;
    update: (options: any) => void;
  }

  export function loadStripe(publishableKey: string): Promise<Stripe | null>;
}
