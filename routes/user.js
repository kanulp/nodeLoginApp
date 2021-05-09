const express = require("express");
const { check, validationResult } = require("express-validator/check");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const auth = require("../middleware/auth");
const crypto = require("crypto");
const User = require("../model/User");
const Payment = require("../model/Payment");
const stripe = require('stripe')('sk_test_51IZNXDEpsLVtl1KC3UHkBvlRNc1bhFK7PHAs8H7b24VVCqaO3CIUbHM93flnbuE5rg2uVf6wRWTYwppDTLOq20A100FgCBhYyo');
const sgMail = require('@sendgrid/mail')

/**
 * @method - POST
 * @param - /signup
 * @description - User SignUp
 */

router.post(
    "/signup", [
        check("username", "Please Enter a Valid Username")
        .not()
        .isEmpty(),
        check("email", "Please enter a valid email").isEmail(),
        check("password", "Please enter a valid password").isLength({
            min: 6
        })
    ],
    async(req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { username, email, password } = req.body;
        try {
            let user = await User.findOne({
                email
            });
            if (user) {
                return res.status(400).json({
                    msg: "User Already Exists"
                });
            }

            user = new User({
                username,
                email,
                password
            });

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);

            await user.save();

            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                "randomString", {
                    expiresIn: 10000
                },
                (err, token) => {
                    if (err) throw err;
                    res.status(200).json({
                        token
                    });
                }
            );
        } catch (err) {
            console.log(err.message);
            res.status(500).send("Error in Saving");
        }
    }
);

router.post(
    "/login", [
        check("email", "Please enter a valid email").isEmail(),
        check("password", "Please enter a valid password").isLength({
            min: 6
        })
    ],
    async(req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        try {
            let user = await User.findOne({
                email
            });
            if (!user)
                return res.status(200).json({
                    message: "User Not Exist"
                });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch)
                return res.status(200).json({
                    message: "Incorrect Password !"
                });

            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                "randomString", {
                    expiresIn: 3600
                },
                (err, token) => {
                    if (err) throw err;
                    res.status(200).json({
                        token
                    });
                }
            );
        } catch (e) {
            console.error(e);
            res.status(500).json({
                message: "Server Error"
            });
        }
    }
);
router.post(
    "/forgetPassword", [
        check("email", "Please enter a valid email").isEmail(),
    ],
    async(req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { email } = req.body;
        console.log("Sending forget password for :"+req.body.email);
        try {
            let user = await User.findOne({
                email
            });
            if (!user)
                return res.status(200).json({
                    message: "User Not Exist"
                });

            let resetToken = crypto.randomBytes(4).toString("hex");
            const salt = await bcrypt.genSalt(10);
            var newPassword = await bcrypt.hash(resetToken, salt);
            await User.updateOne({ "email": email }, { $set: { "password": newPassword } });
            sendForgotPassEmail(email, resetToken)
            res.status(200).json({
                "message": "Your Password is set to temporary. Please check your email for the new Password. It is recommended that you reset password.",
                "password": resetToken
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({
                message: "Server Error"
            });
        }
    }
);

router.post(
    "/resetPassword", [
        check("password", "Please enter an old password").isLength({
            min: 6
        }),
        check("newPassword", "Please enter a new password").isLength({
            min: 6
        })
    ],
    async(req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { email, password, newPassword } = req.body;
        try {
            let user = await User.findOne({
                email
            });
            if (!user)
                return res.status(200).json({
                    message: "User Not Exist"
                });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch)
                return res.status(200).json({
                    message: "Incorrect Password !"
                });

            const payload = {
                user: {
                    id: user.id
                }
            };
            const salt = await bcrypt.genSalt(10);
            var newHashPassword = await bcrypt.hash(newPassword, salt);

            await User.updateOne({ "email": email }, { $set: { "password": newHashPassword } });
            sendResetPassword(email)
            jwt.sign(
                payload,
                "randomString", {
                    expiresIn: 3600
                },
                (err, token) => {
                    if (err) throw err;
                    res.status(200).json({
                        token
                    });
                }
            );
        } catch (e) {
            console.error(e);
            res.status(500).json({
                message: "Server Error"
            });
        }
    }
);

/**
 * @method - POST
 * @description - Get LoggedIn User
 * @param - /user/me
 */

router.get("/me", auth, async(req, res) => {
    try {
        // request.user is getting fetched from Middleware after token authentication
        const user = await User.findById(req.user.id);
        res.json(user);
    } catch (e) {
        res.send({ message: "Error in Fetching user" });
    }
});

router.post("/payment", async(req, res) => {
    try {
        console.log('data from client : amount : ' + req.body.amount + ' ' + req.body.currency);
        stripe.paymentIntents.create({
                amount: req.body.amount,
                currency: 'cad',
                payment_method_types: ['card'],
            }).then((charge) => {
                // asynchronously called

                // await payment.save();
                savePaymentToMongo(req.body.email, req.body.amount, charge["id"]);
                //console.log('data from client : ' + req.body.amount + ' ' + req.body.currency + " email : " + req.body.email);
                res.send({
                    "message":"Your Payment is successfully Accepted.Please check your email for a receipt.",
                    "success":"true"
                })
                //res.send(charge);
                //console.log('Response from function : ' + charge["id"]);
            })
            .catch(err => {
                console.log(err);
            });
    } catch (e) {
        res.send({ message: "Error in Fetching " });
    }
});

async function savePaymentToMongo(email, amount, paymentId) {
    let payment = new Payment({
        email: email,
        amount: amount,
        payment_id: paymentId
    });
    await payment.save();
    sendPaymentEmail(email, amount)
}

function sendPaymentEmail(email, amount) {
    amount = amount.substring(0, str.length - 2) + "." + str.substring(str.length - 2);
    //sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    sgMail.setApiKey("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")
    const msg = {
        to: email, // Change to your recipient
        from: 'daryoush.mortazavi@gmail.com', // Change to your verified sender
        subject: 'You Gas Station bill amount is $' + amount,
        text: '. Your bill amount is ' + amount,
        html: 'This is an autogenerated email for your invoice. <br/><strong>You bill amount is ' + amount + '</strong><br/>Thank you for using Gas Dispenser App.',
    }
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
            console.error(error)
        })
}

function sendResetPassword(email) {
    //sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    sgMail.setApiKey("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")
    const msg = {
        to: email, // Change to your recipient
        from: 'daryoush.mortazavi@gmail.com', // Change to your verified sender
        subject: 'Password reset for Gas Dispenser.',
        text: 'Password Reset',
        html: '<br/><strong>Your password has been reseted successfully.</strong><br/><br/>Thank you for using Gas Dispenser App.',
    }
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
            console.error(error)
        })
}

function sendForgotPassEmail(email, password) {


    //sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    sgMail.setApiKey("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")
    const msg = {
        to: email, // Change to your recipient
        from: 'daryoush.mortazavi@gmail.com', // Change to your verified sender
        subject: 'Password Forget Request for your Gas Station App',
        text: 'This is an autogenerated email for your invoice.',
        html: '<strong>You have requested for password forget.</strong><br/>Your new password is <strong>' + password + '<strong>.<br/><br/>If you have not requested this please let us know.',
    }
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent for forgot pass.')
        })
        .catch((error) => {
            console.error(error)
        })
}

module.exports = router;