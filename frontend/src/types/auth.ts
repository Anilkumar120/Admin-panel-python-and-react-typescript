export interface User {
  id: string;

  name: string;

  email: string;

  role: string;

  is_active: boolean;

  profile_image?: string;
}

export interface LoginResponse {
  message: string;

  access_token: string;

  refresh_token: string;

  token_type: string;

  user: User;
}
