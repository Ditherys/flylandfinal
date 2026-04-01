import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdOHQaTZOVAGiwIHSdBP8AvJ_00_zgXqU",
  authDomain: "flylandkpi.firebaseapp.com",
  projectId: "flylandkpi",
  storageBucket: "flylandkpi.firebasestorage.app",
  messagingSenderId: "126154290277",
  appId: "1:126154290277:web:f8475c853421287ceb428c",
  measurementId: "G-N2QK2VETKL",
};

const allowedDomain = "allianceglobalsolutions.com";

const elements = {
  authGate: document.querySelector("#authGate"),
  authStatus: document.querySelector("#authStatus"),
  loginButton: document.querySelector("#googleLogin"),
  logoutButton: document.querySelector("#googleLogout"),
  mobileLogoutButton: document.querySelector("#mobileMoreLogout"),
  appShell: document.querySelector("#appShell"),
  mobileTopbar: document.querySelector("#mobileTopbar"),
  authSessionPill: document.querySelector("#authSessionPill"),
  authUserEmail: document.querySelector("#authUserEmail"),
};

window.__flylandAuthState = {
  authorized: false,
  email: "",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function isAllowedEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  return normalizedEmail.endsWith(`@${allowedDomain}`);
}

function setAuthorizedUi(user) {
  const email = user?.email || "";
  document.body?.setAttribute("data-authenticated", "true");
  window.__flylandAuthState = {
    authorized: true,
    email,
  };

  if (elements.authGate) {
    elements.authGate.hidden = true;
  }
  if (elements.appShell) {
    elements.appShell.hidden = false;
  }
  if (elements.mobileTopbar) {
    elements.mobileTopbar.hidden = false;
  }
  if (elements.authSessionPill) {
    elements.authSessionPill.hidden = false;
  }
  if (elements.authUserEmail) {
    elements.authUserEmail.textContent = email;
  }
  if (elements.authStatus) {
    elements.authStatus.textContent = `Signed in as ${email}`;
    elements.authStatus.classList.remove("is-error");
  }

  window.dispatchEvent(
    new CustomEvent("flyland:auth-granted", {
      detail: { email },
    })
  );
}

function setSignedOutUi(message, isError = false) {
  document.body?.setAttribute("data-authenticated", "false");
  window.__flylandAuthState = {
    authorized: false,
    email: "",
  };

  if (elements.authGate) {
    elements.authGate.hidden = false;
  }
  if (elements.appShell) {
    elements.appShell.hidden = true;
  }
  if (elements.mobileTopbar) {
    elements.mobileTopbar.hidden = true;
  }
  if (elements.authSessionPill) {
    elements.authSessionPill.hidden = true;
  }
  if (elements.authUserEmail) {
    elements.authUserEmail.textContent = "--";
  }
  if (elements.authStatus) {
    elements.authStatus.textContent = message;
    elements.authStatus.classList.toggle("is-error", isError);
  }
}

function describeAuthError(error) {
  const code = error?.code || "unknown-error";

  switch (code) {
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase yet. Add localhost or your site domain in Firebase Authentication settings.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled yet in Firebase Authentication.";
    case "auth/popup-blocked":
      return "The browser blocked the Google sign-in popup. Allow popups for this site and try again.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled before completion.";
    case "auth/cancelled-popup-request":
      return "Another sign-in popup was already in progress. Try again once.";
    default:
      return `Google sign-in failed (${code}).`;
  }
}

async function handleUnauthorizedUser(user) {
  setSignedOutUi("This account is not allowed for this dashboard.", true);
  if (user) {
    await signOut(auth);
  }
}

elements.loginButton?.addEventListener("click", async () => {
  if (elements.authStatus) {
    elements.authStatus.textContent = "Opening Google sign-in...";
    elements.authStatus.classList.remove("is-error");
  }

  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user?.email || "";

    if (!isAllowedEmail(email)) {
      await handleUnauthorizedUser(result.user);
      return;
    }

    setAuthorizedUi(result.user);
  } catch (error) {
    console.error(error);
    setSignedOutUi(describeAuthError(error), true);
  }
});

async function handleSignOut() {
  await signOut(auth);
  setSignedOutUi("Signed out. Please sign in again to open the dashboard.");
}

elements.logoutButton?.addEventListener("click", handleSignOut);
elements.mobileLogoutButton?.addEventListener("click", handleSignOut);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setSignedOutUi("Please sign in to open the dashboard.");
    return;
  }

  if (!isAllowedEmail(user.email)) {
    await handleUnauthorizedUser(user);
    return;
  }

  setAuthorizedUi(user);
});
