
class Payment {
    constructor (paymentMethod, lineItems, mode, success_url, cancel_url) {
        this.payment_method_types = paymentMethod,
        this.line_items = lineItems,
        this.mode = mode,
        this.success_url = success_url,
        this.cancel_url = cancel_url
    }

    static session (paymentMethod, lineItems, mode, success_url, cancel_url) {
        return new Payment(paymentMethod, lineItems, mode, success_url, cancel_url)
    }
}

module.exports = Payment