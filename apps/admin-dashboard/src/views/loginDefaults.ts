export interface LoginCredentials {
  username: string;
  password: string;
}

export function getInitialLoginCredentials(): LoginCredentials {
  if (import.meta.env.DEV) {
    return {
      username: "admin",
      password: "admin123",
    };
  }

  return {
    username: "",
    password: "",
  };
}
