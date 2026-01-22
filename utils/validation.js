import axios from 'axios';

export function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export async function validatePhoneNumber(phoneNumber, countryCode) {
    try {
        const apiKey = process.env.BIGDATACLOUD_API_KEY;
        const response = await axios.get('https://api-bdc.net/data/phone-number-validate', {
            params: {
                number: phoneNumber,
                countryCode: countryCode,
                localityLanguage: 'en',
                key: apiKey
            }
        });
        return response.data;
    } catch (error) {
        console.error('Phone validation error:', error.message);
        return null;
    }
}
