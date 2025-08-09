import axios from 'axios';

const BINANCE_API_KEY = '7JH3oKKkSVLbShGeVAA3pC9RzZPbF6ibFPIT52nqL9Dn2bYln1W8Rl05944BPJoC';

class CryptoConverter {
   // In cryptoConverter.js
static async getCryptoPrice(currency) {
    try {
        let symbol;
        
        // Handle stablecoins differently since they're 1:1 with USD
        if (['USDT', 'USDC'].includes(currency)) {
            return 1; // 1 USDT/USDC = 1 USD
        }
        
        // For other cryptocurrencies, use their trading pairs
        symbol = `${currency}USDT`;
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`Error fetching ${currency} price:`, error);
        throw new Error(`Failed to get ${currency} price`);
    }
}

    static async convertUsdToCrypto(usdAmount, currency) {
        try {
            const price = await this.getCryptoPrice(currency);
            return usdAmount / price;
        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    }
}

export default CryptoConverter;