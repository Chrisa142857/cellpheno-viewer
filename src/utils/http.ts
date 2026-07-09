import axios, {type AxiosInstance} from "axios";
import {message} from "antd";

console.log("import.meta.env.VITE_BASE_URL", import.meta.env.VITE_BASE_URL)

const http: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
    headers: {
        "Content-Type": "application/json"
    },
    timeout: 10000
});

http.interceptors.request.use((config) => {
    console.log("config", config.url)
    return config
}, (error) => {
    return Promise.reject(error)
});

http.interceptors.response.use((response) => {
    console.log("response", response)
    const {code} = response.data
    if (code === 2001 || code === 4001) {
        return response.data
    }
    return Promise.reject(response.data)

}, (error) => {
    console.log("error", error)
    const {status} = error.response;
    message.error("Something went wrong, please try again")
    if (status === 401) {
        console.log("401")
    }
    return Promise.reject(error)
});

export default http
