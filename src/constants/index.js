const hostname = window.location.hostname;
const origin = window.location.origin;

// Default to production to be safe, but sniff for other environments
let ENV = "production";
if (hostname === "localhost" || hostname === "127.0.0.1") {
    ENV = "development";
} else if (hostname.includes("dev") || hostname.includes("jolly-forest")) {
    // "jolly-forest" is your Azure Dev Static Web App
    ENV = "development";
} else if (hostname.includes("test") || hostname.includes("brave-beach")) {
    // "brave-beach" is your Azure Test Static Web App
    ENV = "test";
} else if (hostname.includes("care") || hostname.includes("registration.seismicconnect.com") || hostname.includes("victorious-mushroom")) {
    ENV = "production";
}

console.log(`[Config] Automatically detected environment: ${ENV} based on hostname ${hostname}`);

const CONFIG = {
    development: {
        BACKEND_URL: "https://seismic-backend-04272025-bjbxatgnadguabg9.centralus-01.azurewebsites.net/",
        DOCTOR_PORTAL_URL: "https://patient-dev.seismicconnect.com/",
        SOS_URL: "https://seismicdockerbackend-test-e0ducsgtggh7ftat.centralus-01.azurewebsites.net/",
        STREAM_API_KEY: "72499ykcfb3z",
        CHATBOT_URL: "https://chat-strlit-gva3h7ekahgdctgk.centralus-01.azurewebsites.net",
    },
    test: {
        BACKEND_URL: "https://seismic-app-server-test-gqd5bjfmgabwa9he.centralus-01.azurewebsites.net/",
        DOCTOR_PORTAL_URL: "https://patient-test.seismicconnect.com/",
        SOS_URL: "https://seismicdockerbackend-test-e0ducsgtggh7ftat.centralus-01.azurewebsites.net/",
        STREAM_API_KEY: "qb4swzqqxr76",
        CHATBOT_URL: "https://sesmic-test.azurewebsites.net/",
    },
    production: {
        BACKEND_URL: "https://seismic-app-server-uat-gjdzdrewfmhscugq.westus-01.azurewebsites.net/",
        DOCTOR_PORTAL_URL: "https://care-patient.seismicconnect.com/",
        SOS_URL: "https://seismicdockerbackend-uat-gyauhkasbcdzenbt.westus-01.azurewebsites.net/",
        STREAM_API_KEY: "23dnbb2d3q8q",
        CHATBOT_URL: "https://sesmic-stg.azurewebsites.net/",
    }
};

const currentConfig = CONFIG[ENV];

export const BACKEND_URL = currentConfig.BACKEND_URL;
export const DOCTOR_PORTAL_URL = currentConfig.DOCTOR_PORTAL_URL;
export const SOS_URL = currentConfig.SOS_URL;
export const STREAM_API_KEY = currentConfig.STREAM_API_KEY;
export const CHATBOT_URL = currentConfig.CHATBOT_URL;

// Dynamic Configuration (works flawlessly in all environments)
export const REDIRECT_URI = origin + "/";
export const CIAM_REDIRECT_URI = origin + "/standalone/registration";

// Static Configuration (shared across all environments)
export const CIAM_AUTH_URL = "https://leapgenaiexternal.ciamlogin.com/526922da-32fc-472e-a268-3875f1d50517/oauth2/v2.0/authorize";
export const CIAM_CLIENT_ID = "e8f47d33-02b8-4467-b0d8-8f705b07a463";

export const MSAL_CLIENT_ID = "529bcde4-d3c1-4896-9277-b7d72ec4f57b";
export const MSAL_AUTHORITY = "https://login.microsoftonline.com/b3e3a3db-e3db-4f76-9a7c-5bca46062c8c";