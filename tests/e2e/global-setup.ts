async function globalSetup() {
  // Intentionally empty.
  //
  // The local E2E flow expects callers to start the required dev servers and
  // seed any target data explicitly. Keeping this hook present but side-effect
  // free lets Playwright load the shared config without taking ownership of
  // local service lifecycle.
}

export default globalSetup;
