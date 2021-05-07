const mongoose = require("mongoose");

const PaymentSchema = mongoose.Schema({
    payment_id: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    amount: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

// export model user with PaymentSchema
module.exports = mongoose.model("payments", PaymentSchema);