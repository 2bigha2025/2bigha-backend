import axios from "axios";

const baseURL = process.env.WHATSAPP_DOMAIN || "";

const whatsAppInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Basic ${process.env.WHATSAPP_SECRET_KEY}`,
  },
});

// Optional: interceptors for logging / error handling
whatsAppInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("WhatsApp API Error:", error.response?.data);
    return Promise.reject(error.response?.data);
  }
);

export default whatsAppInstance;
