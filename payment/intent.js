const config = require('../lib/config')


class Intent {
    constructor(amount, currency, paymentMethod, email) {
        this.amount = amount
        this.currency = currency
        this.payment_method_types = paymentMethod
        this.receipt_email = email
    }

    static pay(amount, currency, paymentMethod, email) {
        return new Intent(amount, currency, paymentMethod, email);
    }
}

module.exports = Intent

