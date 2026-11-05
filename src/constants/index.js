const DEFAULT_BACKEND_URL =
  "https://seismic-backend-04272025-bjbxatgnadguabg9.centralus-01.azurewebsites.net/";
export const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8080/"
    : DEFAULT_BACKEND_URL);
export const DOCTOR_PORTAL_URL = "https://patient-dev.seismicconnect.com/"
export const SOS_URL = "https://seismicdockerbackend-test-e0ducsgtggh7ftat.centralus-01.azurewebsites.net/"
export const STREAM_API_KEY = "72499ykcfb3z"
// export const REDIRECT_URI = "http://localhost:3000/"
export const REDIRECT_URI = "https://dev.seismicconnect.com/"
export const CHATBOT_URL = "https://chat-strlit-gva3h7ekahgdctgk.centralus-01.azurewebsites.net"
export const CIAM_AUTH_URL = "https://leapgenaiexternal.ciamlogin.com/526922da-32fc-472e-a268-3875f1d50517/oauth2/v2.0/authorize"
export const CIAM_CLIENT_ID = "e8f47d33-02b8-4467-b0d8-8f705b07a463"
const DEFAULT_CIAM_REDIRECT_URI =
  "https://polite-mushroom-0a1a2b60f.1.azurestaticapps.net/standalone/registration";
export const CIAM_REDIRECT_URI =
  process.env.REACT_APP_CIAM_REDIRECT_URI ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000/standalone/registration"
    : DEFAULT_CIAM_REDIRECT_URI);
