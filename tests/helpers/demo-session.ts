/** Explicit signed-in fixture for workflow tests that previously assumed a demo login. */
export function authenticateDemoFixture() {
  // Identity/context switching now emits browser events. Node fixtures need the
  // same event contract as a browser, even when they only stub localStorage.
  if (typeof window.dispatchEvent !== "function") {
    const events = new EventTarget();
    Object.assign(window, {
      dispatchEvent: events.dispatchEvent.bind(events),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
  }
  window.localStorage.setItem("5s-auth-session", JSON.stringify({ authenticated: true, username: "admin", version: 1 }));
}
