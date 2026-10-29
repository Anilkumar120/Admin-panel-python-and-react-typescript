export interface User {
  id: string;

  name: string;

  email: string;

  role: string;

  is_active: boolean;

  profile_image?: string;
  first_name?: string;
  last_name?: string;
  media_id?: string;
}

export interface LoginResponse {
  message: string;

  access_token: string;

  refresh_token: string;

  token_type: string;

  user: User;
}
