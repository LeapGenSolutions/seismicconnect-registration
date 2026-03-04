import { LogLevel } from "@azure/msal-browser";
import { REDIRECT_URI, MSAL_CLIENT_ID, MSAL_AUTHORITY } from './constants';


export const msalConfig = {
    auth: {
        clientId: MSAL_CLIENT_ID,
        authority: MSAL_AUTHORITY,
        redirectUri: REDIRECT_URI
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

export const loginRequest = {
    scopes: ["openid", "profile", "User.Read", "Directory.Read.All", "Group.Read.All", "User.Read.All"]
};
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};
