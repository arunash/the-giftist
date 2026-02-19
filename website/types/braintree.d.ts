declare module 'braintree' {
  export const Environment: {
    Production: any
    Sandbox: any
  }

  export class BraintreeGateway {
    constructor(config: {
      environment: any
      merchantId: string
      publicKey: string
      privateKey: string
    })
    clientToken: {
      generate(options: Record<string, any>): Promise<{ clientToken: string }>
    }
    transaction: {
      sale(options: {
        amount: string
        paymentMethodNonce: string
        options?: { submitForSettlement?: boolean }
      }): Promise<{
        success: boolean
        message?: string
        transaction: { id: string; status: string }
      }>
    }
    webhookNotification: {
      parse(signature: string, payload: string): Promise<{
        kind: string
        transaction?: { id: string }
        dispute?: { id: string; transaction?: { id: string } }
      }>
    }
  }

  const braintree: {
    Environment: typeof Environment
    BraintreeGateway: typeof BraintreeGateway
  }
  export default braintree
}
