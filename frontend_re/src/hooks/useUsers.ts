export { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../api/queries";
export type { UserRecord } from "../api/queries";

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "#6366F1",
  level_1: "#14B8A6",
  level_2: "#0EA5E9",
  level_3: "#7C89A0",
};
