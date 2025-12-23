import axios from "axios";
import { kommunoConfig } from "../config/kommuno";

export const kommunoInstance = axios.create({
  baseURL: kommunoConfig.domain || "",
  headers: {
    "Content-Type": "application/json",
    accesskey: kommunoConfig.accessKey || "",
    accesstoken: kommunoConfig.accessToken || "",
  },
});

// Optional: Add response interceptor for debugging
kommunoInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("Kommuno Axios Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default kommunoInstance;