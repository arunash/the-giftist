import braintree from 'braintree'

let _gateway: any = null

function getGateway() {
  if (!_gateway) {
    const environment = process.env.BRAINTREE_ENVIRONMENT === 'production'
      ? braintree.Environment.Production
      : braintree.Environment.Sandbox

    _gateway = new braintree.BraintreeGateway({
      environment,
      merchantId: process.env.BRAINTREE_MERCHANT_ID || '',
      publicKey: process.env.BRAINTREE_PUBLIC_KEY || '',
      privateKey: process.env.BRAINTREE_PRIVATE_KEY || '',
    })
  }
  return _gateway
}

// Lazy proxy so the gateway is only created at first use (not at import/build time)
export const gateway = new Proxy({} as any, {
  get(_target, prop) {
    return getGateway()[prop]
  },
})
