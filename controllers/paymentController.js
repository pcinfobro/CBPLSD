import crypto from 'crypto';
import axios from 'axios';
import Deposit from '../models/depositModel.js';
import User from '../models/userModel.js';
import CryptoConverter from '../utils/cryptoConverter.js';


const MERCHANT_ID = "ca85dfd1-6508-4cb3-ba3c-fbd5af6082c5";
const API_KEY = "gslwlRD8vbZERq8A9Huqd1SPx7AkwUsta4YlNppZ9WnSyiULUsallZyCfgCwEzdYETUmA4HcYR924Cs74cdDzFQQMa1wwZKqjcuYW82vo7Vu5JPgAtfle7bYAZrmxcI7";
class PaymentController {
    createPayment = async (req, res) => {
        try {
            const { amount, currency, network } = req.body;
            const user = await User.findOne({ email: req.session.userEmail });
            
            if (!user) {
                return res.status(401).json({ error: true, message: "Unauthorized" });
            }

            // Validate input
            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                return res.status(422).json({ error: true, message: "Invalid amount" });
            }

            if (!currency || !['BTC', 'ETH', 'USDT', 'LTC', 'USDC'].includes(currency)) {
    return res.status(422).json({ error: true, message: "Invalid currency" });
}
// Validate network based on currency
const validNetworks = {
    BTC: ['BTC'],
    ETH: ['ETH'],
    LTC: ['LTC'],
    USDT: ['ETH', 'TRC20', 'POLYGON'],
    USDC: ['ETH', 'POLYGON']
};

if (!validNetworks[currency]?.includes(network)) {
    return res.status(422).json({ 
        error: true, 
        message: `Invalid network for ${currency}` 
    });
}
// Update network validation
if (!network) {
    return res.status(422).json({ error: true, message: "Network is required" });
}

            // Convert USD amount to crypto amount
            let cryptoAmount;
            if (currency === 'USDT') {
                // USDT is 1:1 with USD
                cryptoAmount = parseFloat(amount);
            } else {
                cryptoAmount = await CryptoConverter.convertUsdToCrypto(parseFloat(amount), currency);
            }

            const orderId = crypto.randomBytes(12).toString("hex");
            
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            
            const payload = {
                amount: cryptoAmount.toFixed(8), // Use crypto amount instead of USD
                currency,
                network,
                order_id: orderId,
                url_callback: `${baseUrl}/user/payment/webhook`,
                url_return: `${baseUrl}/user/deposit`,
                url_success: `${baseUrl}/user/deposit/success`,
                is_payment_multiple: false,
                lifetime: 1800 // 30 minutes
            };

            const base64data = Buffer.from(JSON.stringify(payload)).toString('base64');
            const sign = crypto.createHash('md5').update(base64data + API_KEY).digest("hex");

            console.log("Sending payload to Cryptomus:", payload);

            const response = await axios.post('https://api.cryptomus.com/v1/payment', payload, {
                headers: {  
                    'merchant': MERCHANT_ID,
                    'sign': sign,
                    'Content-Type': 'application/json'
                }
            });

            // Create deposit record
            const newDeposit = new Deposit({
                userId: user._id,
                amount: parseFloat(amount),
                method: `${currency} (${network})`,
                status: 'pending',
                transactionId: orderId,
                paymentUrl: response.data.result.url,
                paymentData: response.data.result
            });

            await newDeposit.save();

            res.status(200).json({
                success: true,
                message: "Payment initiated successfully",
                deposit: newDeposit
            });
            
        } catch (err) {
            console.error('Payment error:', err.response?.data || err.message);
            
            let errorMessage = 'Payment processing failed';
            if (err.response?.data?.errors) {
                const errors = err.response.data.errors;
                if (errors.url_callback) {
                    errorMessage = `Invalid callback URL: ${errors.url_callback.join(', ')}`;
                } else if (errors.url_return) {
                    errorMessage = `Invalid return URL: ${errors.url_return.join(', ')}`;
                } else {
                    errorMessage = Object.values(errors).flat().join(', ');
                }
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }

            res.status(err.response?.status || 500).json({ 
                error: true, 
                message: errorMessage,
                details: err.response?.data || null
            });
        }
    }


  paymentWebhook = async (req, res) => {
    try {
        const sign = req.headers['sign'];
        const requestBody = req.body;
        
        // Verify signature
        const base64data = Buffer.from(JSON.stringify(requestBody)).toString('base64');
        const expectedSign = crypto.createHash('md5').update(base64data + API_KEY).digest("hex");
        
        if (sign !== expectedSign) {
            console.error('Invalid webhook signature');
            return res.status(400).send('Invalid signature');
        }

        const { order_id, status, amount } = requestBody;
        
        // Find the deposit record
        const deposit = await Deposit.findOne({ transactionId: order_id });
        if (!deposit) {
            console.error('Deposit not found for order:', order_id);
            return res.status(404).send('Deposit not found');
        }

        // Only process if status changed to paid
        if (status === 'paid' && deposit.status !== 'completed') {
            // Start a transaction to ensure atomic updates
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                // Update deposit status
                deposit.status = 'completed';
                deposit.paymentData = requestBody;
                deposit.date = new Date();
                await deposit.save({ session });

                // Update user balance (convert amount to USD if needed)
                const usdAmount = deposit.amount; // Since we stored the USD amount initially
                await User.findByIdAndUpdate(
                    deposit.userId,
                    { $inc: { balance: usdAmount } },
                    { session }
                );
                
                await session.commitTransaction();
                console.log(`Deposit completed for user ${deposit.userId}, amount: ${usdAmount} USD`);
            } catch (err) {
                await session.abortTransaction();
                console.error('Transaction error:', err);
                throw err;
            } finally {
                session.endSession();
            }
        } else {
            // Update deposit status even if not paid (failed, etc.)
            deposit.status = status === 'paid' ? 'completed' : status;
            deposit.paymentData = requestBody;
            await deposit.save();
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error processing webhook');
    }
}
   getDeposits = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.userEmail });
        if (!user) {
            return res.status(401).json({ error: true, message: "Unauthorized" });
        }

        const deposits = await Deposit.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            deposits: deposits.map(deposit => ({
                ...deposit,
                amount: (deposit.amount || 0).toFixed(2), // Handle undefined amount
                date: deposit.createdAt || deposit.date || new Date()
            }))
        });
    } catch (err) {
        console.error('Deposit history error:', err);
        res.status(500).json({ 
            error: true, 
            message: err.message 
        });
    }
}
}

export const paymentController = new PaymentController();