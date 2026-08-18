export interface ApiUser {
  id: number;
  username: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: number;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  profileImageUrl?: string | null;
}

export function mapApiUser(user: ApiUser) {
  const isActive = user.isActive !== false;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    role: user.role,
    status: isActive ? ("active" as const) : ("inactive" as const),
    isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    profileImageUrl: user.profileImageUrl ?? undefined,
  };
}
